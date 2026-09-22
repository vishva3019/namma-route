import prisma from '../db/prisma';
import { GeoUtils } from '../utils/geo';
import {
  NormalizedVehicle,
  StopStatus,
  VehicleStopInfo,
} from '../providers/bmtc/RealtimeProvider';
import { normalizeRouteIdentifier } from '../utils/routeNormalizer';
import Logger from '../utils/logger';

export interface StopDetectionResult {
  currentStop: VehicleStopInfo | null;
  nextStop: VehicleStopInfo | null;
  stopStatus: StopStatus;
}

export interface OrderedStop {
  id: string;
  name: string;
  sequence: number;
  latitude: number;
  longitude: number;
}

export interface VariantStops {
  variantId: string;
  direction: number;
  originName: string;
  destinationName: string;
  stops: OrderedStop[];
}

export interface VehiclePreviousState {
  vehicleId?: string;
  lastAtStopId?: string;
  lastAtStopName?: string;
  lastAtStopSequence?: number;
  lastAtStopTimestamp?: number;
  lastStopStatus?: StopStatus;
  lastDirection?: number;
  lastNextStopSequence?: number;
  lastLatitude?: number;
  lastLongitude?: number;
  lastBearing?: number | null;
  lastSpeed?: number | null;
}

export class CurrentStopService {
  // Configurable thresholds from environment variables
  private get matchRadiusMeters(): number {
    const val = parseInt(process.env.BUS_STOP_MATCH_RADIUS_METERS || '75', 10);
    return isNaN(val) ? 75 : Math.max(10, val);
  }

  private get approachRadiusMeters(): number {
    const val = parseInt(process.env.BUS_STOP_APPROACH_RADIUS_METERS || '250', 10);
    return isNaN(val) ? 250 : Math.max(this.matchRadiusMeters, val);
  }

  private get hysteresisSeconds(): number {
    const val = parseInt(process.env.BUS_STOP_HYSTERESIS_SECONDS || '30', 10);
    return isNaN(val) ? 30 : Math.max(5, val);
  }

  // Cache of route variants and ordered stops
  private routeVariantsCache: Map<string, VariantStops[]> = new Map();
  private cacheExpiresAt: number = 0;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  // State tracker for live vehicles across polling cycles (for hysteresis and stationary resolution)
  private vehicleStateMap: Map<string, VehiclePreviousState> = new Map();

  /**
   * Reset all or specific vehicle history (useful for testing or cache clearing)
   */
  clearVehicleHistory(vehicleId?: string) {
    if (vehicleId) {
      this.vehicleStateMap.delete(vehicleId);
    } else {
      this.vehicleStateMap.clear();
    }
  }

  /**
   * Retrieve state for a given vehicle
   */
  getVehicleHistory(vehicleId: string): VehiclePreviousState | undefined {
    return this.vehicleStateMap.get(vehicleId);
  }

  /**
   * Fetch and cache ordered stops for all variants of a given route
   */
  async getRouteVariants(routeNumberOrId: string): Promise<VariantStops[]> {
    const norm = normalizeRouteIdentifier(routeNumberOrId);
    if (!norm) return [];

    const now = Date.now();
    if (this.routeVariantsCache.has(norm) && now < this.cacheExpiresAt) {
      return this.routeVariantsCache.get(norm)!;
    }

    try {
      const route = await prisma.route.findFirst({
        where: {
          OR: [
            { id: routeNumberOrId },
            { routeId: routeNumberOrId },
            { routeShortName: routeNumberOrId },
          ],
        },
        include: {
          variants: {
            include: {
              routeStops: {
                include: { stop: true },
                orderBy: { stopSequence: 'asc' },
              },
            },
            orderBy: [{ direction: 'asc' }, { stopCount: 'desc' }],
          },
        },
      });

      if (!route || !route.variants || route.variants.length === 0) {
        return [];
      }

      const variantStopsList: VariantStops[] = route.variants.map((v) => ({
        variantId: v.id,
        direction: v.direction,
        originName: v.originName || '',
        destinationName: v.destinationName || '',
        stops: v.routeStops.map((rs) => ({
          id: rs.stop.id,
          name: rs.stop.name,
          sequence: rs.stopSequence,
          latitude: rs.stop.latitude,
          longitude: rs.stop.longitude,
        })),
      }));

      this.routeVariantsCache.set(norm, variantStopsList);
      this.cacheExpiresAt = now + this.CACHE_TTL_MS;
      return variantStopsList;
    } catch (err) {
      Logger.error(`[CurrentStopService] Failed to load route variants for ${routeNumberOrId}`, err);
      return [];
    }
  }

  /**
   * Determine the best matching route variant/direction for a vehicle.
   * Handles stationary vehicles (speed=0, bearing=0) by preserving previous direction.
   */
  selectBestVariant(
    vehicle: {
      latitude: number;
      longitude: number;
      bearing?: number | null;
      speed?: number | null;
      destination?: string | null;
      previousDirection?: number | null;
    },
    variants: VariantStops[]
  ): VariantStops | null {
    if (!variants || variants.length === 0) return null;
    if (variants.length === 1) return variants[0];

    // 1. If stationary with bearing 0 (or null) and previous direction is known, retain previous direction
    const isStationary =
      (vehicle.speed === null || vehicle.speed === undefined || vehicle.speed <= 3) &&
      (vehicle.bearing === null || vehicle.bearing === undefined || vehicle.bearing === 0);

    if (isStationary && vehicle.previousDirection !== undefined && vehicle.previousDirection !== null) {
      const prevVariant = variants.find((v) => v.direction === vehicle.previousDirection);
      if (prevVariant) return prevVariant;
    }

    // 2. Check if vehicle destination string matches variant destination
    if (vehicle.destination) {
      const destNorm = vehicle.destination.toLowerCase();
      const match = variants.find(
        (v) =>
          v.destinationName.toLowerCase().includes(destNorm) ||
          destNorm.includes(v.destinationName.toLowerCase())
      );
      if (match) return match;
    }

    // 3. Score variants by minimum distance and heading consistency
    let bestVariant = variants[0];
    let minScore = Infinity;

    for (const v of variants) {
      if (v.stops.length === 0) continue;

      let closestDist = Infinity;
      let closestIdx = 0;

      for (let i = 0; i < v.stops.length; i++) {
        const d = GeoUtils.haversineDistanceMeters(
          vehicle.latitude,
          vehicle.longitude,
          v.stops[i].latitude,
          v.stops[i].longitude
        );
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }

      let headingPenalty = 0;
      if (
        vehicle.bearing !== null &&
        vehicle.bearing !== undefined &&
        vehicle.bearing > 0 &&
        v.stops.length > 1
      ) {
        const nextIdx = Math.min(v.stops.length - 1, closestIdx + 1);
        const prevIdx = Math.max(0, closestIdx - 1);
        const targetStop = v.stops[nextIdx];
        const fromStop = v.stops[prevIdx];

        const routeBearing = GeoUtils.calculateBearing(
          fromStop.latitude,
          fromStop.longitude,
          targetStop.latitude,
          targetStop.longitude
        );

        let angleDiff = Math.abs(vehicle.bearing - routeBearing);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        if (angleDiff > 90) {
          headingPenalty = 5000; // 5km penalty for heading opposite to route direction
        }
      }

      const score = closestDist + headingPenalty;
      if (score < minScore) {
        minScore = score;
        bestVariant = v;
      }
    }

    return bestVariant;
  }

  /**
   * Core stop detection algorithm with GPS jitter hysteresis and stationary handling
   */
  detectStop(
    vehicle: {
      id?: string;
      latitude?: number | null;
      longitude?: number | null;
      bearing?: number | null;
      speed?: number | null;
    },
    stops: OrderedStop[],
    options?: {
      matchRadiusMeters?: number;
      approachRadiusMeters?: number;
      hysteresisSeconds?: number;
      currentTimeMs?: number;
      previousState?: VehiclePreviousState | null;
    }
  ): StopDetectionResult {
    // Edge case H & G: No GPS coordinates or empty stops
    if (
      vehicle.latitude === undefined ||
      vehicle.latitude === null ||
      vehicle.longitude === undefined ||
      vehicle.longitude === null ||
      isNaN(vehicle.latitude) ||
      isNaN(vehicle.longitude) ||
      (vehicle.latitude === 0 && vehicle.longitude === 0) ||
      !stops ||
      stops.length === 0
    ) {
      return {
        currentStop: null,
        nextStop: null,
        stopStatus: 'UNKNOWN',
      };
    }

    const matchRadius = options?.matchRadiusMeters ?? this.matchRadiusMeters;
    const approachRadius = options?.approachRadiusMeters ?? this.approachRadiusMeters;
    const hysteresisMs = (options?.hysteresisSeconds ?? this.hysteresisSeconds) * 1000;
    const now = options?.currentTimeMs ?? Date.now();

    const prevState: VehiclePreviousState | null =
      options?.previousState !== undefined
        ? options.previousState
        : vehicle.id
        ? this.vehicleStateMap.get(vehicle.id) || null
        : null;

    const lat = vehicle.latitude;
    const lon = vehicle.longitude;
    const bearing =
      vehicle.bearing !== undefined && vehicle.bearing !== null ? vehicle.bearing : null;
    const speed = vehicle.speed !== undefined && vehicle.speed !== null ? vehicle.speed : null;
    const isStationary =
      (speed === null || speed <= 3) && (bearing === null || bearing === 0);

    // Calculate distance and bearing to all stops on this route variant
    const stopsWithDist = stops.map((stop) => {
      const dist = GeoUtils.haversineDistanceMeters(lat, lon, stop.latitude, stop.longitude);
      const bearingToStop = GeoUtils.calculateBearing(lat, lon, stop.latitude, stop.longitude);
      return {
        ...stop,
        dist,
        bearingToStop,
      };
    });

    // 1. Candidate stops strictly within matchRadius
    let candidateAtStops = stopsWithDist.filter((s) => s.dist <= matchRadius);

    // STOP HYSTERESIS STABILIZATION:
    // If no candidate is within strict matchRadius, but the vehicle was previously AT_STOP:
    // Check if the vehicle remains within the extended hysteresis radius (1.5x matchRadius)
    // and hasn't clearly departed (e.g. speed <= 15 km/h) within hysteresis duration.
    if (candidateAtStops.length === 0 && prevState && prevState.lastStopStatus === 'AT_STOP') {
      const prevStopMatch = stopsWithDist.find(
        (s) => s.id === prevState.lastAtStopId || s.sequence === prevState.lastAtStopSequence
      );

      if (prevStopMatch) {
        const timeSinceAtStop = now - (prevState.lastAtStopTimestamp || 0);
        const maxHysteresisRadius = matchRadius * 1.5; // e.g. 75m * 1.5 = 112.5m
        const hasClearlyDeparted =
          (speed !== null && speed > 15) ||
          prevStopMatch.dist > maxHysteresisRadius ||
          timeSinceAtStop > hysteresisMs;

        if (!hasClearlyDeparted) {
          // Retain the stop under hysteresis protection against GPS jitter
          candidateAtStops.push(prevStopMatch);
        }
      }
    }

    if (candidateAtStops.length > 0) {
      let chosenStop = candidateAtStops[0];

      if (candidateAtStops.length > 1) {
        // Disambiguate when multiple nearby stops exist (e.g. circular route or closely spaced stops)
        if (
          prevState &&
          (prevState.lastAtStopSequence !== undefined || prevState.lastNextStopSequence !== undefined)
        ) {
          const refSeq = prevState.lastNextStopSequence ?? prevState.lastAtStopSequence!;
          const minSeq = prevState.lastAtStopSequence ?? 0;

          candidateAtStops.sort((a, b) => {
            // Prioritize stops that are forward along the route sequence over stops already passed
            const forwardA = a.sequence >= minSeq;
            const forwardB = b.sequence >= minSeq;
            if (forwardA && !forwardB) return -1;
            if (!forwardA && forwardB) return 1;

            const diffA = Math.abs(a.sequence - refSeq);
            const diffB = Math.abs(b.sequence - refSeq);
            if (diffA !== diffB) return diffA - diffB;
            return a.dist - b.dist;
          });
          chosenStop = candidateAtStops[0];
        } else if (bearing !== null && bearing > 0) {
          // Disambiguate using heading towards stop
          candidateAtStops.sort((a, b) => {
            let diffA = Math.abs(bearing - a.bearingToStop);
            if (diffA > 180) diffA = 360 - diffA;
            let diffB = Math.abs(bearing - b.bearingToStop);
            if (diffB > 180) diffB = 360 - diffB;
            const aheadA = diffA <= 90;
            const aheadB = diffB <= 90;
            if (aheadA && !aheadB) return -1;
            if (!aheadA && aheadB) return 1;
            return a.dist - b.dist;
          });
          chosenStop = candidateAtStops[0];
        } else {
          candidateAtStops.sort((a, b) => a.dist - b.dist);
          chosenStop = candidateAtStops[0];
        }
      }

      // Find next stop in sequence
      const next = stopsWithDist.find((s) => s.sequence > chosenStop.sequence);

      const result: StopDetectionResult = {
        currentStop: {
          stopId: chosenStop.id,
          stopName: chosenStop.name,
          sequence: chosenStop.sequence,
          distanceMeters: Math.round(chosenStop.dist),
        },
        nextStop: next
          ? {
              stopId: next.id,
              stopName: next.name,
              sequence: next.sequence,
              distanceMeters: Math.round(next.dist),
            }
          : null,
        stopStatus: 'AT_STOP',
      };

      // Save vehicle state
      if (vehicle.id) {
        this.vehicleStateMap.set(vehicle.id, {
          vehicleId: vehicle.id,
          lastAtStopId: chosenStop.id,
          lastAtStopName: chosenStop.name,
          lastAtStopSequence: chosenStop.sequence,
          lastAtStopTimestamp:
            candidateAtStops[0].dist <= matchRadius || !prevState?.lastAtStopTimestamp
              ? now
              : prevState.lastAtStopTimestamp,
          lastStopStatus: 'AT_STOP',
          lastNextStopSequence: next?.sequence,
          lastLatitude: lat,
          lastLongitude: lon,
          lastBearing: bearing,
          lastSpeed: speed,
        });
      }

      return result;
    }

    // 2. APPROACHING_STOP: Check if vehicle is approaching an upcoming stop within approachRadius
    let approachCandidates = stopsWithDist
      .filter((s) => s.dist <= approachRadius)
      .sort((a, b) => a.dist - b.dist);

    // If previous sequence is known and bus is stationary, filter candidates to sequence >= previous
    if (approachCandidates.length > 0 && prevState?.lastNextStopSequence !== undefined && isStationary) {
      const forwardCandidates = approachCandidates.filter(
        (s) => s.sequence >= prevState.lastNextStopSequence!
      );
      if (forwardCandidates.length > 0) {
        approachCandidates = forwardCandidates;
      }
    }

    if (approachCandidates.length > 0) {
      const nearestApproach = approachCandidates[0];

      let isHeadingTowards = true;
      if (bearing !== null && bearing > 0) {
        let angleDiff = Math.abs(bearing - nearestApproach.bearingToStop);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        isHeadingTowards = angleDiff <= 90;
      }

      if (isHeadingTowards) {
        const result: StopDetectionResult = {
          currentStop: null,
          nextStop: {
            stopId: nearestApproach.id,
            stopName: nearestApproach.name,
            sequence: nearestApproach.sequence,
            distanceMeters: Math.round(nearestApproach.dist),
          },
          stopStatus: 'APPROACHING_STOP',
        };

        if (vehicle.id) {
          this.vehicleStateMap.set(vehicle.id, {
            vehicleId: vehicle.id,
            lastAtStopId: undefined,
            lastAtStopName: undefined,
            lastAtStopSequence: undefined,
            lastAtStopTimestamp: undefined,
            lastStopStatus: 'APPROACHING_STOP',
            lastNextStopSequence: nearestApproach.sequence,
            lastLatitude: lat,
            lastLongitude: lon,
            lastBearing: bearing,
            lastSpeed: speed,
          });
        }

        return result;
      } else {
        // Nearest stop is behind the vehicle; bus has passed it and is in transit to the next
        const upcoming = stopsWithDist.find((s) => s.sequence > nearestApproach.sequence);
        if (upcoming) {
          const result: StopDetectionResult = {
            currentStop: null,
            nextStop: {
              stopId: upcoming.id,
              stopName: upcoming.name,
              sequence: upcoming.sequence,
              distanceMeters: Math.round(upcoming.dist),
            },
            stopStatus: 'IN_TRANSIT',
          };

          if (vehicle.id) {
            this.vehicleStateMap.set(vehicle.id, {
              vehicleId: vehicle.id,
              lastAtStopId: undefined,
              lastAtStopName: undefined,
              lastAtStopSequence: undefined,
              lastAtStopTimestamp: undefined,
              lastStopStatus: 'IN_TRANSIT',
              lastNextStopSequence: upcoming.sequence,
              lastLatitude: lat,
              lastLongitude: lon,
              lastBearing: bearing,
              lastSpeed: speed,
            });
          }

          return result;
        }
      }
    }

    // 3. IN_TRANSIT: Between stops along the route sequence
    let bestNextStop: typeof stopsWithDist[0] | null = null;
    let minSegmentDist = Infinity;

    // Filter segments based on previous known sequence if stationary/bearing 0
    const startIdx =
      isStationary && prevState?.lastNextStopSequence !== undefined
        ? Math.max(0, prevState.lastNextStopSequence - 1)
        : 0;

    for (let i = startIdx; i < stopsWithDist.length - 1; i++) {
      const s1 = stopsWithDist[i];
      const s2 = stopsWithDist[i + 1];

      const midLat = (s1.latitude + s2.latitude) / 2;
      const midLon = (s1.longitude + s2.longitude) / 2;
      const dMid = GeoUtils.haversineDistanceMeters(lat, lon, midLat, midLon);

      if (dMid < minSegmentDist) {
        minSegmentDist = dMid;
        bestNextStop = s2;
      }
    }

    if (!bestNextStop && stopsWithDist.length > 0) {
      const sorted = [...stopsWithDist].sort((a, b) => a.dist - b.dist);
      bestNextStop = sorted[0];
    }

    const result: StopDetectionResult = {
      currentStop: null,
      nextStop: bestNextStop
        ? {
            stopId: bestNextStop.id,
            stopName: bestNextStop.name,
            sequence: bestNextStop.sequence,
            distanceMeters: Math.round(bestNextStop.dist),
          }
        : null,
      stopStatus: 'IN_TRANSIT',
    };

    if (vehicle.id) {
      this.vehicleStateMap.set(vehicle.id, {
        vehicleId: vehicle.id,
        lastAtStopId: undefined,
        lastAtStopName: undefined,
        lastAtStopSequence: undefined,
        lastAtStopTimestamp: undefined,
        lastStopStatus: 'IN_TRANSIT',
        lastNextStopSequence: bestNextStop?.sequence,
        lastLatitude: lat,
        lastLongitude: lon,
        lastBearing: bearing,
        lastSpeed: speed,
      });
    }

    return result;
  }

  /**
   * Enrich a list of normalized live vehicles with route-aware current-stop detection
   */
  async enrichVehicles(vehicles: NormalizedVehicle[]): Promise<NormalizedVehicle[]> {
    if (!vehicles || vehicles.length === 0) return vehicles;

    // Process vehicles in parallel batches
    await Promise.all(
      vehicles.map(async (v) => {
        if (!v.routeNumber && !v.routeId) {
          v.stopStatus = 'UNKNOWN';
          v.currentStop = null;
          v.nextStop = null;
          return;
        }

        const routeKey = v.routeNumber || v.routeId!;
        const variants = await this.getRouteVariants(routeKey);

        if (!variants || variants.length === 0) {
          v.stopStatus = 'UNKNOWN';
          v.currentStop = null;
          v.nextStop = null;
          return;
        }

        const prevState = v.id ? this.vehicleStateMap.get(v.id) : null;

        // Select the specific directional variant this vehicle is on
        const bestVariant = this.selectBestVariant(
          {
            latitude: v.latitude,
            longitude: v.longitude,
            bearing: v.bearing,
            speed: v.speed,
            destination: v.destination,
            previousDirection: prevState?.lastDirection,
          },
          variants
        );

        if (!bestVariant || bestVariant.stops.length === 0) {
          v.stopStatus = 'UNKNOWN';
          v.currentStop = null;
          v.nextStop = null;
          return;
        }

        const detection = this.detectStop(
          {
            id: v.id,
            latitude: v.latitude,
            longitude: v.longitude,
            bearing: v.bearing,
            speed: v.speed,
          },
          bestVariant.stops,
          {
            previousState: prevState,
          }
        );

        v.currentStop = detection.currentStop;
        v.nextStop = detection.nextStop;
        v.stopStatus = detection.stopStatus;

        // Keep currentStopId / nextStopId synchronized
        if (detection.currentStop) {
          v.currentStopId = detection.currentStop.stopName;
        }
        if (detection.nextStop) {
          v.nextStopId = detection.nextStop.stopName;
        }

        // Store resolved direction in vehicle state for next polling cycle
        if (v.id && this.vehicleStateMap.has(v.id)) {
          this.vehicleStateMap.get(v.id)!.lastDirection = bestVariant.direction;
        }
      })
    );

    return vehicles;
  }
}

export const currentStopService = new CurrentStopService();
export default currentStopService;
