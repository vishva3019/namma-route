import prisma from '../db/prisma';
import cacheService from '../cache/cacheService';
import { vehicleService } from './vehicleService';
import { GeoUtils } from '../utils/geo';

export interface JourneyLeg {
  routeId: string;
  routeNumber: string;
  routeName: string;
  serviceType?: string | null;
  fromStop: { id: string; stopId: string; name: string; latitude: number; longitude: number };
  toStop: { id: string; stopId: string; name: string; latitude: number; longitude: number };
  stopCount?: number;
  nextDeparture?: string;
  intermediateStops: { id: string; stopId: string; name: string; latitude: number; longitude: number }[];
  durationMinutes: number;
  distanceKm: number;
  activeBusesCount: number;
  geometry: [number, number][];
}

export interface JourneyPlan {
  id: string;
  type: 'DIRECT' | 'TRANSFER';
  totalDurationMinutes: number;
  totalDistanceKm: number;
  transferCount: number;
  legs: JourneyLeg[];
  transferStop?: { id: string; stopId: string; name: string; latitude: number; longitude: number };
  hasLiveBuses: boolean;
}

export class JourneyService {
  /**
   * Resolve a query string (name, stopId, or landmark alias) to candidate Stop IDs
   */
  async resolveStopCandidates(query: string): Promise<{ primaryStop: any; candidateIds: string[] } | null> {
    const clean = query.trim();
    if (!clean) return null;

    const norm = clean.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const cacheKey = `stop_candidates:${norm}`;
    const cached = await cacheService.get<{ primaryStop: any; candidateIds: string[] }>(cacheKey);
    if (cached) return cached;

    // 1. Direct ID match
    let primaryStop = await prisma.stop.findFirst({
      where: {
        OR: [{ id: clean }, { stopId: clean }],
      },
    });

    // 2. Alias match
    if (!primaryStop) {
      const alias = await prisma.stopAlias.findFirst({
        where: {
          OR: [
            { normalizedAlias: norm },
            { normalizedAlias: { startsWith: norm } },
            { alias: { contains: clean } },
          ],
        },
        include: { stop: true },
      });
      if (alias?.stop) {
        primaryStop = alias.stop;
      }
    }

    // 3. Name match
    if (!primaryStop) {
      primaryStop = await prisma.stop.findFirst({
        where: {
          OR: [
            { normalizedName: norm },
            { normalizedName: { startsWith: norm } },
            { name: { contains: clean } },
            { nameKannada: { contains: clean } },
          ],
        },
      });
    }

    if (!primaryStop) return null;

    // Collect candidate stops (same station platforms or stops within 350m)
    const nearbyStationStops = await prisma.stop.findMany({
      where: {
        OR: [
          { id: primaryStop.id },
          { name: primaryStop.name },
          {
            latitude: { gte: primaryStop.latitude - 0.003, lte: primaryStop.latitude + 0.003 },
            longitude: { gte: primaryStop.longitude - 0.003, lte: primaryStop.longitude + 0.003 },
          },
        ],
      },
      select: { id: true },
    });

    const candidateIds = Array.from(new Set(nearbyStationStops.map((s) => s.id)));
    const result = { primaryStop, candidateIds };
    await cacheService.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * Plan sequence-aware journey between two stops
   */
  async planJourney(fromQuery: string, toQuery: string): Promise<JourneyPlan[]> {
    const journeyCacheKey = `journey_plan:${fromQuery.trim().toLowerCase()}:${toQuery.trim().toLowerCase()}`;
    const cachedPlan = await cacheService.get<JourneyPlan[]>(journeyCacheKey);
    if (cachedPlan) {
      return cachedPlan;
    }

    const [fromRes, toRes] = await Promise.all([
      this.resolveStopCandidates(fromQuery),
      this.resolveStopCandidates(toQuery),
    ]);

    if (!fromRes || !toRes) {
      return [];
    }

    if (fromRes.primaryStop.id === toRes.primaryStop.id) {
      return [];
    }

    const plans: JourneyPlan[] = [];
    const fromIdsList = fromRes.candidateIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    const toIdsList = toRes.candidateIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');

    // Fetch live vehicles to assign real bus counts
    let allVehicles: any[] = [];
    try {
      allVehicles = (await vehicleService.getAllVehicles()).vehicles || [];
    } catch {
      allVehicles = [];
    }

    const countBusesOnRoute = (routeId: string, routeNumber: string) => {
      const lower = routeNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      return allVehicles.filter(
        (v) =>
          v.routeId === routeId ||
          (v.routeNumber && v.routeNumber.toLowerCase().replace(/[^a-z0-9]/g, '') === lower)
      ).length;
    };

    // ----------------------------------------------------
    // 1. Direct Routes Search (Sequence-aware)
    // ----------------------------------------------------
    const directMatches: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        rs1.variantId,
        rs1.stopSequence as originSeq,
        rs2.stopSequence as destSeq,
        rs1.stopId as actualOriginStopId,
        rs2.stopId as actualDestStopId,
        r.id as routeId,
        r.routeShortName,
        r.routeLongName,
        r.routeFamily,
        r.serviceType,
        v.direction,
        v.directionName,
        v.shapeId,
        v.geometry as variantGeometry
      FROM RouteStop rs1
      JOIN RouteStop rs2 ON rs1.variantId = rs2.variantId
      JOIN RouteVariant v ON rs1.variantId = v.id
      JOIN Route r ON v.routeId = r.id
      WHERE rs1.stopId IN (${fromIdsList})
        AND rs2.stopId IN (${toIdsList})
        AND rs1.stopSequence < rs2.stopSequence
      ORDER BY (rs2.stopSequence - rs1.stopSequence) ASC
      LIMIT 15;
    `);

    // Process direct matches
    const seenDirectRoutes = new Set<string>();

    for (const match of directMatches) {
      if (seenDirectRoutes.has(match.routeId)) continue;
      seenDirectRoutes.add(match.routeId);

      // Fetch the intermediate stops between originSeq and destSeq
      const legRouteStops = await prisma.routeStop.findMany({
        where: {
          variantId: match.variantId,
          stopSequence: { gte: match.originSeq, lte: match.destSeq },
        },
        include: { stop: true },
        orderBy: { stopSequence: 'asc' },
      });

      if (legRouteStops.length < 2) continue;

      let distMeters = 0;
      for (let i = 0; i < legRouteStops.length - 1; i++) {
        distMeters += GeoUtils.haversineDistanceMeters(
          legRouteStops[i].stop.latitude,
          legRouteStops[i].stop.longitude,
          legRouteStops[i + 1].stop.latitude,
          legRouteStops[i + 1].stop.longitude
        );
      }

      const durationMin = GeoUtils.estimateBusTransitMinutes(distMeters, legRouteStops.length - 2);
      const activeBuses = countBusesOnRoute(match.routeId, match.routeShortName);

      let parsedGeom: [number, number][] = [];
      if (match.variantGeometry) {
        try {
          parsedGeom = JSON.parse(match.variantGeometry);
        } catch {
          parsedGeom = [];
        }
      }
      if (parsedGeom.length === 0) {
        parsedGeom = legRouteStops.map((rs) => [rs.stop.latitude, rs.stop.longitude]);
      }

      const originStopData = legRouteStops[0].stop;
      const destStopData = legRouteStops[legRouteStops.length - 1].stop;

      plans.push({
        id: `direct-${match.routeId}-${match.variantId}`,
        type: 'DIRECT',
        totalDurationMinutes: durationMin,
        totalDistanceKm: Number((distMeters / 1000).toFixed(1)),
        transferCount: 0,
        hasLiveBuses: activeBuses > 0,
        legs: [
          {
            routeId: match.routeId,
            routeNumber: match.routeShortName,
            routeName: match.routeLongName,
            serviceType: match.serviceType,
            fromStop: {
              id: originStopData.id,
              stopId: originStopData.stopId,
              name: originStopData.name,
              latitude: originStopData.latitude,
              longitude: originStopData.longitude,
            },
            toStop: {
              id: destStopData.id,
              stopId: destStopData.stopId,
              name: destStopData.name,
              latitude: destStopData.latitude,
              longitude: destStopData.longitude,
            },
            stopCount: legRouteStops.length,
            nextDeparture: 'Scheduled daily',
            intermediateStops: legRouteStops.slice(1, -1).map((rs) => ({
              id: rs.stop.id,
              stopId: rs.stop.stopId,
              name: rs.stop.name,
              latitude: rs.stop.latitude,
              longitude: rs.stop.longitude,
            })),
            durationMinutes: durationMin,
            distanceKm: Number((distMeters / 1000).toFixed(1)),
            activeBusesCount: activeBuses,
            geometry: parsedGeom,
          },
        ],
      });
    }

    // ----------------------------------------------------
    // 2. 1-Transfer Routes Search (If needed)
    // ----------------------------------------------------
    if (plans.length < 5) {
      // Step A: Find candidate transfer stops that have downstream connections to destination stops
      const destTransfers: any[] = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT rs_trans.stopId
        FROM RouteStop rs_dest
        JOIN RouteStop rs_trans ON rs_dest.variantId = rs_trans.variantId
        WHERE rs_dest.stopId IN (${toIdsList})
          AND rs_trans.stopSequence < rs_dest.stopSequence
      `);

      if (destTransfers.length > 0) {
        const transferStopIds = destTransfers.map((s) => `'${s.stopId.replace(/'/g, "''")}'`).join(',');

        // Step B: Find Leg 1 routes from origin to any candidate transfer stop
        const leg1Matches: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            rs_orig.variantId as v1Id,
            rs_orig.stopSequence as r1FromSeq,
            rs_trans.stopSequence as r1TransSeq,
            rs_trans.stopId as transferStopId,
            r1.id as r1Id,
            r1.routeShortName as r1ShortName,
            r1.routeLongName as r1LongName,
            r1.serviceType as r1ServiceType
          FROM RouteStop rs_orig
          JOIN RouteStop rs_trans ON rs_orig.variantId = rs_trans.variantId
          JOIN RouteVariant v1 ON rs_orig.variantId = v1.id
          JOIN Route r1 ON v1.routeId = r1.id
          WHERE rs_orig.stopId IN (${fromIdsList})
            AND rs_trans.stopId IN (${transferStopIds})
            AND rs_orig.stopSequence < rs_trans.stopSequence
          ORDER BY (rs_trans.stopSequence - rs_orig.stopSequence) ASC
          LIMIT 25;
        `);

        if (leg1Matches.length > 0) {
          const matchedTransfers = Array.from(
            new Set(leg1Matches.map((m) => `'${m.transferStopId.replace(/'/g, "''")}'`))
          ).join(',');

          // Step C: Find Leg 2 routes connecting those transfer stops to destination
          const leg2Matches: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
              rs_trans.variantId as v2Id,
              rs_trans.stopSequence as r2TransSeq,
              rs_dest.stopSequence as r2ToSeq,
              rs_trans.stopId as transferStopId,
              rs_dest.stopId as r2ToStopId,
              trans_stop.name as transferStopName,
              trans_stop.stopId as transferStopCode,
              trans_stop.latitude as transferLat,
              trans_stop.longitude as transferLon,
              r2.id as r2Id,
              r2.routeShortName as r2ShortName,
              r2.routeLongName as r2LongName,
              r2.serviceType as r2ServiceType
            FROM RouteStop rs_trans
            JOIN RouteStop rs_dest ON rs_trans.variantId = rs_dest.variantId
            JOIN RouteVariant v2 ON rs_trans.variantId = v2.id
            JOIN Route r2 ON v2.routeId = r2.id
            JOIN Stop trans_stop ON rs_trans.stopId = trans_stop.id
            WHERE rs_trans.stopId IN (${matchedTransfers})
              AND rs_dest.stopId IN (${toIdsList})
              AND rs_trans.stopSequence < rs_dest.stopSequence
            ORDER BY (rs_dest.stopSequence - rs_trans.stopSequence) ASC
            LIMIT 25;
          `);

          // Step D: Match Leg 1 and Leg 2 on shared transfer stop
          const candidatePairs: any[] = [];
          const seenPairs = new Set<string>();

          for (const m1 of leg1Matches) {
            for (const m2 of leg2Matches) {
              if (m1.transferStopId === m2.transferStopId && m1.r1Id !== m2.r2Id) {
                const pairKey = `${m1.r1Id}_${m2.r2Id}`;
                if (!seenPairs.has(pairKey)) {
                  seenPairs.add(pairKey);
                  candidatePairs.push({
                    r1: m1,
                    r2: m2,
                    totalStops: m1.r1TransSeq - m1.r1FromSeq + (m2.r2ToSeq - m2.r2TransSeq),
                  });
                }
              }
            }
          }

          candidatePairs.sort((a, b) => a.totalStops - b.totalStops);
          const topPairs = candidatePairs.slice(0, Math.max(2, 5 - plans.length));

          for (const pair of topPairs) {
            const tm1 = pair.r1;
            const tm2 = pair.r2;

            const [leg1RouteStops, leg2RouteStops] = await Promise.all([
              prisma.routeStop.findMany({
                where: {
                  variantId: tm1.v1Id,
                  stopSequence: { gte: tm1.r1FromSeq, lte: tm1.r1TransSeq },
                },
                include: { stop: true },
                orderBy: { stopSequence: 'asc' },
              }),
              prisma.routeStop.findMany({
                where: {
                  variantId: tm2.v2Id,
                  stopSequence: { gte: tm2.r2TransSeq, lte: tm2.r2ToSeq },
                },
                include: { stop: true },
                orderBy: { stopSequence: 'asc' },
              }),
            ]);

            if (leg1RouteStops.length < 2 || leg2RouteStops.length < 2) continue;

            let dist1 = 0;
            for (let i = 0; i < leg1RouteStops.length - 1; i++) {
              dist1 += GeoUtils.haversineDistanceMeters(
                leg1RouteStops[i].stop.latitude,
                leg1RouteStops[i].stop.longitude,
                leg1RouteStops[i + 1].stop.latitude,
                leg1RouteStops[i + 1].stop.longitude
              );
            }

            let dist2 = 0;
            for (let i = 0; i < leg2RouteStops.length - 1; i++) {
              dist2 += GeoUtils.haversineDistanceMeters(
                leg2RouteStops[i].stop.latitude,
                leg2RouteStops[i].stop.longitude,
                leg2RouteStops[i + 1].stop.latitude,
                leg2RouteStops[i + 1].stop.longitude
              );
            }

            const dur1 = GeoUtils.estimateBusTransitMinutes(dist1, leg1RouteStops.length - 2);
            const dur2 = GeoUtils.estimateBusTransitMinutes(dist2, leg2RouteStops.length - 2);
            const bufferMin = 8;
            const totalDuration = dur1 + bufferMin + dur2;
            const totalDistKm = Number(((dist1 + dist2) / 1000).toFixed(1));

            const activeBuses1 = countBusesOnRoute(tm1.r1Id, tm1.r1ShortName);
            const activeBuses2 = countBusesOnRoute(tm2.r2Id, tm2.r2ShortName);

            plans.push({
              id: `transfer-${tm1.r1Id}-${tm2.r2Id}`,
              type: 'TRANSFER',
              totalDurationMinutes: totalDuration,
              totalDistanceKm: totalDistKm,
              transferCount: 1,
              hasLiveBuses: activeBuses1 > 0 && activeBuses2 > 0,
              transferStop: {
                id: tm2.transferStopId,
                stopId: tm2.transferStopCode,
                name: tm2.transferStopName,
                latitude: tm2.transferLat,
                longitude: tm2.transferLon,
              },
              legs: [
                {
                  routeId: tm1.r1Id,
                  routeNumber: tm1.r1ShortName,
                  routeName: tm1.r1LongName,
                  serviceType: tm1.r1ServiceType,
                  fromStop: {
                    id: leg1RouteStops[0].stop.id,
                    stopId: leg1RouteStops[0].stop.stopId,
                    name: leg1RouteStops[0].stop.name,
                    latitude: leg1RouteStops[0].stop.latitude,
                    longitude: leg1RouteStops[0].stop.longitude,
                  },
                  toStop: {
                    id: leg1RouteStops[leg1RouteStops.length - 1].stop.id,
                    stopId: leg1RouteStops[leg1RouteStops.length - 1].stop.stopId,
                    name: leg1RouteStops[leg1RouteStops.length - 1].stop.name,
                    latitude: leg1RouteStops[leg1RouteStops.length - 1].stop.latitude,
                    longitude: leg1RouteStops[leg1RouteStops.length - 1].stop.longitude,
                  },
                  stopCount: leg1RouteStops.length,
                  nextDeparture: 'Scheduled daily',
                  intermediateStops: leg1RouteStops.slice(1, -1).map((rs) => ({
                    id: rs.stop.id,
                    stopId: rs.stop.stopId,
                    name: rs.stop.name,
                    latitude: rs.stop.latitude,
                    longitude: rs.stop.longitude,
                  })),
                  durationMinutes: dur1,
                  distanceKm: Number((dist1 / 1000).toFixed(1)),
                  activeBusesCount: activeBuses1,
                  geometry: leg1RouteStops.map((rs) => [rs.stop.latitude, rs.stop.longitude]),
                },
                {
                  routeId: tm2.r2Id,
                  routeNumber: tm2.r2ShortName,
                  routeName: tm2.r2LongName,
                  serviceType: tm2.r2ServiceType,
                  fromStop: {
                    id: leg2RouteStops[0].stop.id,
                    stopId: leg2RouteStops[0].stop.stopId,
                    name: leg2RouteStops[0].stop.name,
                    latitude: leg2RouteStops[0].stop.latitude,
                    longitude: leg2RouteStops[0].stop.longitude,
                  },
                  toStop: {
                    id: leg2RouteStops[leg2RouteStops.length - 1].stop.id,
                    stopId: leg2RouteStops[leg2RouteStops.length - 1].stop.stopId,
                    name: leg2RouteStops[leg2RouteStops.length - 1].stop.name,
                    latitude: leg2RouteStops[leg2RouteStops.length - 1].stop.latitude,
                    longitude: leg2RouteStops[leg2RouteStops.length - 1].stop.longitude,
                  },
                  stopCount: leg2RouteStops.length,
                  nextDeparture: 'Scheduled daily',
                  intermediateStops: leg2RouteStops.slice(1, -1).map((rs) => ({
                    id: rs.stop.id,
                    stopId: rs.stop.stopId,
                    name: rs.stop.name,
                    latitude: rs.stop.latitude,
                    longitude: rs.stop.longitude,
                  })),
                  durationMinutes: dur2,
                  distanceKm: Number((dist2 / 1000).toFixed(1)),
                  activeBusesCount: activeBuses2,
                  geometry: leg2RouteStops.map((rs) => [rs.stop.latitude, rs.stop.longitude]),
                },
              ],
            });
          }
        }
      }
    }

    // Sort: DIRECT first, then by duration
    const sortedPlans = plans.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'DIRECT' ? -1 : 1;
      return a.totalDurationMinutes - b.totalDurationMinutes;
    });

    await cacheService.set(journeyCacheKey, sortedPlans, 30);
    return sortedPlans;
  }
}

export const journeyService = new JourneyService();
export default journeyService;
