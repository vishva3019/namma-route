import prisma from '../db/prisma';
import cacheService, { CacheService } from '../cache/cacheService';
import { vehicleService } from './vehicleService';
import {
  normalizeRouteIdentifier,
  normalizeRouteSearchQuery,
  matchRouteNumber,
} from '../utils/routeNormalizer';

export class RouteService {
  private routesIndexCache: any[] | null = null;
  private routesIndexLoadedAt: number = 0;

  /**
   * Internal helper to get all routes cached in memory for sub-millisecond search
   */
  private async getRoutesIndex(): Promise<any[]> {
    const now = Date.now();
    // Cache for 10 minutes
    if (this.routesIndexCache && now - this.routesIndexLoadedAt < 10 * 60 * 1000) {
      return this.routesIndexCache;
    }

    const routes = await prisma.route.findMany({
      select: {
        id: true,
        routeId: true,
        routeShortName: true,
        routeLongName: true,
        routeDisplayName: true,
        routeFamily: true,
        serviceType: true,
        origin: true,
        destination: true,
        routeType: true,
        variants: {
          take: 1,
          select: {
            variantCode: true,
            direction: true,
          },
        },
      },
      orderBy: [{ routeShortName: 'asc' }],
    });

    this.routesIndexCache = routes;
    this.routesIndexLoadedAt = now;
    return routes;
  }

  /**
   * Search routes by query or list routes with pagination using normalized route matching
   */
  async searchRoutes(query?: string, limit: number = 50, offset: number = 0) {
    const cleanQuery = query?.trim();
    const cacheKey = `routes:list:${cleanQuery || 'all'}:${limit}:${offset}`;

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        let allVehicles: any[] = [];
        try {
          const res = await vehicleService.getAllVehicles();
          allVehicles = res.vehicles || [];
        } catch {
          allVehicles = [];
        }

        const allRoutes = await this.getRoutesIndex();

        let matchedRoutes: any[];

        if (!cleanQuery) {
          matchedRoutes = allRoutes;
        } else {
          const normQ = normalizeRouteSearchQuery(cleanQuery);
          const lowerQ = cleanQuery.toLowerCase();

          const scored: { r: any; score: number }[] = [];

          for (const r of allRoutes) {
            const match = matchRouteNumber(r.routeShortName, cleanQuery);
            let score = match.score;

            // Also check family match if not exact route match
            if (score < 100 && r.routeFamily) {
              const normFamily = normalizeRouteIdentifier(r.routeFamily);
              if (normFamily === normQ) {
                score = Math.max(score, 75);
              } else if (normFamily.startsWith(normQ)) {
                score = Math.max(score, 70);
              }
            }

            // Also check origin / destination / routeLongName text search
            if (score === 0) {
              if (
                r.origin?.toLowerCase().includes(lowerQ) ||
                r.destination?.toLowerCase().includes(lowerQ) ||
                r.routeLongName?.toLowerCase().includes(lowerQ) ||
                r.routeDisplayName?.toLowerCase().includes(lowerQ)
              ) {
                score = 50;
              }
            }

            if (score > 0) {
              scored.push({ r, score });
            }
          }

          // Sort by score DESC, then routeShortName length ASC, then alphabetical
          scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.r.routeShortName.length !== b.r.routeShortName.length) {
              return a.r.routeShortName.length - b.r.routeShortName.length;
            }
            return a.r.routeShortName.localeCompare(b.r.routeShortName);
          });

          matchedRoutes = scored.map((x) => x.r);
        }

        const total = matchedRoutes.length;
        const pageRoutes = matchedRoutes.slice(offset, offset + limit);

        const routesWithBusCount = pageRoutes.map((r) => {
          const normRoute = normalizeRouteIdentifier(r.routeShortName);
          const activeCount = allVehicles.filter((v) => {
            const vNorm = normalizeRouteIdentifier(v.routeNumber);
            return v.routeId === r.id || vNorm === normRoute;
          }).length;

          const primaryVariant = r.variants?.[0];

          return {
            id: r.id,
            routeNumber: r.routeShortName,
            routeShortName: r.routeShortName,
            routeLongName: r.routeLongName,
            routeName: r.routeLongName,
            routeDisplayName: r.routeDisplayName,
            routeFamily: r.routeFamily,
            family: r.routeFamily,
            serviceType: r.serviceType,
            origin: r.origin,
            destination: r.destination,
            direction: primaryVariant?.direction ?? 0,
            variant: primaryVariant?.variantCode ?? r.routeShortName,
            routeType: r.routeType,
            activeBusesCount: activeCount,
          };
        });

        return {
          total,
          limit,
          offset,
          routes: routesWithBusCount,
        };
      },
      CacheService.TTL_ROUTES
    );
  }

  /**
   * Find a route by ID, short name, or family with normalization support
   */
  async findRouteEntity(routeIdOrNumber: string) {
    const clean = routeIdOrNumber.trim();
    // 1. Direct match by id, routeId, or routeShortName
    let route = await prisma.route.findFirst({
      where: {
        OR: [
          { id: clean },
          { routeId: clean },
          { routeShortName: clean },
          { routeDisplayName: clean },
        ],
      },
    });

    if (route) return route;

    // 2. Normalized search (e.g. "600F" matches "600-F", "356M" matches "356-M")
    const normClean = normalizeRouteIdentifier(clean);
    const allRoutes = await this.getRoutesIndex();

    // Exact normalized match
    const exactMatch = allRoutes.find(
      (r) => normalizeRouteIdentifier(r.routeShortName) === normClean
    );
    if (exactMatch) {
      return prisma.route.findUnique({ where: { id: exactMatch.id } });
    }

    // Prefix match
    const prefixMatch = allRoutes.find(
      (r) => normalizeRouteIdentifier(r.routeShortName).startsWith(normClean)
    );
    if (prefixMatch) {
      return prisma.route.findUnique({ where: { id: prefixMatch.id } });
    }

    return null;
  }

  /**
   * Get complete route details including directions, geometry, stops, and live buses
   */
  async getRouteById(routeIdOrNumber: string) {
    const route = await this.findRouteEntity(routeIdOrNumber);
    if (!route) return null;

    // Fetch variants with stops
    const variants = await prisma.routeVariant.findMany({
      where: { routeId: route.id },
      include: {
        routeStops: {
          include: { stop: true },
          orderBy: { stopSequence: 'asc' },
        },
      },
      orderBy: [{ direction: 'asc' }, { stopCount: 'desc' }],
    });

    // Primary variant (dir 0)
    const primaryVariant = variants.find((v) => v.direction === 0) || variants[0];
    const parsedGeometry = primaryVariant?.geometry ? JSON.parse(primaryVariant.geometry) : null;

    let liveBuses: any[] = [];
    try {
      liveBuses = await vehicleService.getVehiclesByRoute(route.routeShortName);
    } catch {
      liveBuses = [];
    }

    const stops = primaryVariant?.routeStops.map((rs) => ({
      id: rs.stop.id,
      stopId: rs.stop.stopId,
      name: rs.stop.name,
      nameKannada: rs.stop.nameKannada,
      latitude: rs.stop.latitude,
      longitude: rs.stop.longitude,
      sequence: rs.stopSequence,
    })) || [];

    const directions = variants.map((v) => ({
      direction: v.direction,
      directionName: v.directionName || `${v.originName} → ${v.destinationName}`,
      originName: v.originName,
      destinationName: v.destinationName,
      stopCount: v.stopCount,
      shapeId: v.shapeId,
      geometry: v.geometry ? JSON.parse(v.geometry) : null,
    }));

    return {
      id: route.id,
      routeId: route.routeId,
      routeNumber: route.routeShortName,
      routeName: route.routeLongName,
      routeDisplayName: route.routeDisplayName,
      routeFamily: route.routeFamily,
      serviceType: route.serviceType,
      origin: route.origin,
      destination: route.destination,
      routeType: route.routeType,
      geometry: parsedGeometry,
      activeBusesCount: liveBuses.length,
      liveBuses,
      stops,
      directions,
    };
  }

  /**
   * Get directional variants for a route
   */
  async getRouteDirections(routeIdOrNumber: string) {
    const route = await this.findRouteEntity(routeIdOrNumber);
    if (!route) return [];

    const variants = await prisma.routeVariant.findMany({
      where: { routeId: route.id },
      orderBy: [{ direction: 'asc' }, { stopCount: 'desc' }],
    });

    return variants.map((v) => ({
      direction: v.direction,
      directionName: v.directionName || `${v.originName} → ${v.destinationName}`,
      originName: v.originName,
      destinationName: v.destinationName,
      originStopId: v.originStopId,
      destinationStopId: v.destinationStopId,
      stopCount: v.stopCount,
      shapeId: v.shapeId,
      geometry: v.geometry ? JSON.parse(v.geometry) : null,
    }));
  }

  /**
   * Get ordered stop sequence for a specific direction (default 0)
   */
  async getRouteStops(routeIdOrNumber: string, direction: number = 0) {
    const route = await this.findRouteEntity(routeIdOrNumber);
    if (!route) return [];

    const variant = await prisma.routeVariant.findFirst({
      where: { routeId: route.id, direction },
      include: {
        routeStops: {
          include: { stop: true },
          orderBy: { stopSequence: 'asc' },
        },
      },
      orderBy: { stopCount: 'desc' },
    });

    if (!variant) return [];

    return variant.routeStops.map((rs) => ({
      id: rs.stop.id,
      stopId: rs.stop.stopId,
      name: rs.stop.name,
      nameKannada: rs.stop.nameKannada,
      latitude: rs.stop.latitude,
      longitude: rs.stop.longitude,
      sequence: rs.stopSequence,
    }));
  }

  /**
   * Get timetable / scheduled trips for a route
   */
  async getRouteTimetable(routeIdOrNumber: string, direction: number = 0) {
    const route = await this.findRouteEntity(routeIdOrNumber);
    if (!route) return [];

    const trips = await prisma.trip.findMany({
      where: { routeId: route.id, direction },
      take: 50,
      include: {
        stopTimes: {
          orderBy: { stopSequence: 'asc' },
          take: 2, // First and last stop times
          include: { stop: true },
        },
      },
    });

    return trips.map((t) => {
      const firstSt = t.stopTimes[0];
      const lastSt = t.stopTimes[t.stopTimes.length - 1];
      return {
        tripId: t.tripId,
        direction: t.direction,
        tripHeadsign: t.tripHeadsign,
        departureTime: firstSt?.departureTime || null,
        arrivalTime: lastSt?.arrivalTime || null,
        originStop: firstSt?.stop?.name || null,
        destinationStop: lastSt?.stop?.name || null,
      };
    }).sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));
  }

  /**
   * Debug endpoint returning full route hierarchy
   */
  async debugRoute(routeIdOrNumber: string) {
    const route = await this.findRouteEntity(routeIdOrNumber);
    if (!route) return { found: false, query: routeIdOrNumber };

    const variants = await prisma.routeVariant.findMany({
      where: { routeId: route.id },
      include: {
        routeStops: {
          include: { stop: true },
          orderBy: { stopSequence: 'asc' },
        },
        trips: { take: 5 },
      },
      orderBy: { direction: 'asc' },
    });

    return {
      found: true,
      route: {
        id: route.id,
        routeId: route.routeId,
        routeShortName: route.routeShortName,
        routeLongName: route.routeLongName,
        routeFamily: route.routeFamily,
        serviceType: route.serviceType,
        origin: route.origin,
        destination: route.destination,
      },
      variants: variants.map((v) => ({
        id: v.id,
        direction: v.direction,
        directionName: v.directionName,
        originName: v.originName,
        destinationName: v.destinationName,
        stopCount: v.stopCount,
        shapeId: v.shapeId,
        hasGeometry: !!v.geometry,
        tripsCount: v.trips.length,
        firstStop: v.routeStops[0]?.stop?.name,
        lastStop: v.routeStops[v.routeStops.length - 1]?.stop?.name,
        stopsSample: v.routeStops.slice(0, 5).map((rs) => ({
          seq: rs.stopSequence,
          name: rs.stop.name,
        })),
      })),
    };
  }
}

export const routeService = new RouteService();
export default routeService;
