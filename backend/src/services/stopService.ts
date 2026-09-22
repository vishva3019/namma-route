import prisma from '../db/prisma';
import cacheService, { CacheService } from '../cache/cacheService';
import { GeoUtils } from '../utils/geo';
import { vehicleService } from './vehicleService';

export class StopService {
  /**
   * Search stops by query or list all stops with fuzzy alias & Kannada matching
   */
  async searchStops(query?: string, limit: number = 50, offset: number = 0) {
    const cleanQuery = query?.trim();

    if (!cleanQuery) {
      const [total, stops] = await Promise.all([
        prisma.stop.count(),
        prisma.stop.findMany({
          take: limit,
          skip: offset,
          orderBy: { name: 'asc' },
        }),
      ]);

      return {
        total,
        limit,
        offset,
        stops: stops.map((s) => ({
          id: s.id,
          stopId: s.stopId,
          name: s.name,
          nameKannada: s.nameKannada,
          latitude: s.latitude,
          longitude: s.longitude,
          platform: s.platformCode,
          routes: [],
        })),
      };
    }

    const normQuery = cleanQuery.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Check StopAlias
    const aliasMatches = await prisma.stopAlias.findMany({
      where: {
        OR: [
          { normalizedAlias: { contains: normQuery } },
          { alias: { contains: cleanQuery } },
        ],
      },
      include: {
        stop: true,
      },
      take: 10,
    });

    const canonicalStopIds = new Set<string>(aliasMatches.map((a) => a.canonicalStopId));

    // 2. Query Stop table directly
    const directStops = await prisma.stop.findMany({
      where: {
        OR: [
          { name: { contains: cleanQuery } },
          { nameKannada: { contains: cleanQuery } },
          { normalizedName: { contains: normQuery } },
          { stopId: cleanQuery },
        ],
      },
      take: limit,
      skip: offset,
      orderBy: { name: 'asc' },
    });

    // Merge results preserving alias matches at the top
    const combinedStopsMap = new Map<string, any>();

    for (const a of aliasMatches) {
      if (a.stop) {
        combinedStopsMap.set(a.stop.id, {
          id: a.stop.id,
          stopId: a.stop.stopId,
          name: a.stop.name,
          nameKannada: a.stop.nameKannada,
          latitude: a.stop.latitude,
          longitude: a.stop.longitude,
          platform: a.stop.platformCode,
          matchedAlias: a.alias,
        });
      }
    }

    for (const s of directStops) {
      if (!combinedStopsMap.has(s.id)) {
        combinedStopsMap.set(s.id, {
          id: s.id,
          stopId: s.stopId,
          name: s.name,
          nameKannada: s.nameKannada,
          latitude: s.latitude,
          longitude: s.longitude,
          platform: s.platformCode,
        });
      }
    }

    const resultStops = Array.from(combinedStopsMap.values()).slice(0, limit);

    // Fetch routes serving these stops using RouteStop
    const stopIds = resultStops.map((s) => s.id);
    const routeStops = await prisma.routeStop.findMany({
      where: { stopId: { in: stopIds } },
      include: {
        variant: {
          include: {
            route: {
              select: {
                id: true,
                routeShortName: true,
                routeLongName: true,
                routeFamily: true,
                serviceType: true,
              },
            },
          },
        },
      },
    });

    const stopToRoutesMap = new Map<string, Map<string, any>>();
    for (const rs of routeStops) {
      if (rs.variant?.route) {
        let m = stopToRoutesMap.get(rs.stopId);
        if (!m) {
          m = new Map();
          stopToRoutesMap.set(rs.stopId, m);
        }
        const r = rs.variant.route;
        if (!m.has(r.id)) {
          m.set(r.id, {
            id: r.id,
            routeNumber: r.routeShortName,
            routeName: r.routeLongName,
            routeFamily: r.routeFamily,
            serviceType: r.serviceType,
          });
        }
      }
    }

    const formatted = resultStops.map((s) => ({
      ...s,
      routes: Array.from(stopToRoutesMap.get(s.id)?.values() || []),
    }));

    return {
      total: formatted.length,
      limit,
      offset,
      stops: formatted,
    };
  }

  /**
   * Get single stop details including routes serving it
   */
  async getStopById(stopId: string) {
    const clean = stopId.trim();
    const stop = await prisma.stop.findFirst({
      where: {
        OR: [{ id: clean }, { stopId: clean }],
      },
    });

    if (!stop) return null;

    const routeStops = await prisma.routeStop.findMany({
      where: { stopId: stop.id },
      include: {
        variant: {
          include: {
            route: true,
          },
        },
      },
    });

    const routesMap = new Map<string, any>();
    for (const rs of routeStops) {
      const r = rs.variant?.route;
      if (r && !routesMap.has(r.id)) {
        routesMap.set(r.id, {
          id: r.id,
          routeNumber: r.routeShortName,
          routeName: r.routeLongName,
          origin: r.origin,
          destination: r.destination,
          routeFamily: r.routeFamily,
          serviceType: r.serviceType,
        });
      }
    }

    return {
      id: stop.id,
      stopId: stop.stopId,
      name: stop.name,
      nameKannada: stop.nameKannada,
      latitude: stop.latitude,
      longitude: stop.longitude,
      platform: stop.platformCode,
      routesServing: Array.from(routesMap.values()),
    };
  }

  /**
   * Find stops near a coordinate, sorted by distance
   */
  async getNearbyStops(latitude: number, longitude: number, radiusMeters: number = 3000) {
    // 1 deg lat ~= 111km; 1 deg lon ~= 108km at lat 13
    const latDelta = (radiusMeters / 111000) * 1.2;
    const lonDelta = (radiusMeters / 108000) * 1.2;

    const candidateStops = await prisma.stop.findMany({
      where: {
        latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
        longitude: { gte: longitude - lonDelta, lte: longitude + lonDelta },
      },
    });

    const nearby: any[] = [];
    const stopIds: string[] = [];

    for (const s of candidateStops) {
      const dist = GeoUtils.haversineDistanceMeters(latitude, longitude, s.latitude, s.longitude);
      if (dist <= radiusMeters) {
        stopIds.push(s.id);
        const bearing = GeoUtils.calculateBearing(latitude, longitude, s.latitude, s.longitude);
        const walkingMin = GeoUtils.estimateWalkingMinutes(dist);

        nearby.push({
          id: s.id,
          stopId: s.stopId,
          name: s.name,
          nameKannada: s.nameKannada,
          latitude: s.latitude,
          longitude: s.longitude,
          distanceMeters: Math.round(dist),
          distanceKm: Number((dist / 1000).toFixed(2)),
          walkingMinutes: walkingMin,
          bearing: Math.round(bearing),
          routes: [],
        });
      }
    }

    if (stopIds.length > 0) {
      const routeStops = await prisma.routeStop.findMany({
        where: { stopId: { in: stopIds } },
        include: {
          variant: {
            include: {
              route: { select: { id: true, routeShortName: true } },
            },
          },
        },
      });

      const stopRoutesMap = new Map<string, Set<string>>();
      for (const rs of routeStops) {
        const rName = rs.variant?.route?.routeShortName;
        if (rName) {
          let set = stopRoutesMap.get(rs.stopId);
          if (!set) {
            set = new Set();
            stopRoutesMap.set(rs.stopId, set);
          }
          set.add(rName);
        }
      }

      for (const s of nearby) {
        s.routes = Array.from(stopRoutesMap.get(s.id) || []);
      }
    }

    return nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * Find vehicles near a coordinate
   */
  async getNearbyVehicles(latitude: number, longitude: number, radiusMeters: number = 3000) {
    let allVehicles: any[] = [];
    try {
      allVehicles = (await vehicleService.getAllVehicles()).vehicles || [];
    } catch {
      allVehicles = [];
    }

    const nearby: any[] = [];

    for (const v of allVehicles) {
      const dist = GeoUtils.haversineDistanceMeters(latitude, longitude, v.latitude, v.longitude);
      if (dist <= radiusMeters) {
        const bearing = GeoUtils.calculateBearing(latitude, longitude, v.latitude, v.longitude);
        nearby.push({
          ...v,
          distanceMeters: Math.round(dist),
          distanceKm: Number((dist / 1000).toFixed(2)),
          bearingFromUser: Math.round(bearing),
        });
      }
    }

    return nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}

export const stopService = new StopService();
export default stopService;
