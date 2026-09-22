import prisma from '../db/prisma';
import { vehicleService } from './vehicleService';
import { GeoUtils } from '../utils/geo';

export type EtaSource = 'LIVE_GPS' | 'SCHEDULED';

export interface UpcomingArrival {
  routeId: string;
  routeNumber: string;
  destination: string | null;
  vehicleId: string | null;
  vehicleNumber?: string | null;
  etaMinutes: number;
  expectedTime: string;
  source: EtaSource;
  distanceMeters?: number | null;
  status?: string;
}

export class EtaService {
  /**
   * Get upcoming bus arrivals for a stop with strict source classification
   */
  async getUpcomingArrivals(stopId: string): Promise<UpcomingArrival[]> {
    const clean = stopId.trim();
    const stop = await prisma.stop.findFirst({
      where: {
        OR: [{ id: clean }, { stopId: clean }],
      },
      include: {
        stopTimes: {
          take: 30,
          include: {
            trip: {
              include: { route: true },
            },
          },
        },
      },
    });

    if (!stop) return [];

    const arrivals: UpcomingArrival[] = [];
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentTimeSec = currentHours * 3600 + currentMinutes * 60 + currentSeconds;

    // Get all live vehicles
    let allVehicles: any[] = [];
    try {
      allVehicles = (await vehicleService.getAllVehicles()).vehicles || [];
    } catch {
      allVehicles = [];
    }

    // Map routes that serve this stop
    const routesServingStop = new Map<string, any>();
    for (const st of stop.stopTimes) {
      if (st.trip?.route) {
        routesServingStop.set(st.trip.route.id, {
          route: st.trip.route,
          sequence: st.stopSequence,
          scheduledTime: st.arrivalTime,
        });
      }
    }

    // 1. Calculate ETA for LIVE vehicles plying on routes serving this stop
    const processedRoutes = new Set<string>();

    for (const v of allVehicles) {
      if (!v.routeId || !routesServingStop.has(v.routeId)) continue;

      const routeInfo = routesServingStop.get(v.routeId)!;
      const distToStop = GeoUtils.haversineDistanceMeters(
        v.latitude,
        v.longitude,
        stop.latitude,
        stop.longitude
      );

      // Estimate travel time: speed in km/h or average 20 km/h in Bengaluru
      const effectiveSpeedKmH = v.speed && v.speed > 5 ? v.speed : 20;
      const effectiveSpeedMps = (effectiveSpeedKmH * 1000) / 3600;
      const travelTimeSec = Math.round(distToStop / effectiveSpeedMps);
      const etaMinutes = Math.max(1, Math.round(travelTimeSec / 60));

      const source: EtaSource = v.source === 'BMTC' ? 'LIVE_GPS' : 'SCHEDULED';
      const expectedDate = new Date(now.getTime() + travelTimeSec * 1000);
      const expectedTime = expectedDate.toTimeString().substring(0, 5);

      arrivals.push({
        routeId: v.routeId,
        routeNumber: v.routeNumber || routeInfo.route.routeShortName,
        destination: v.destination || routeInfo.route.destination,
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        etaMinutes,
        expectedTime,
        source,
        distanceMeters: Math.round(distToStop),
        status: v.status,
      });

      processedRoutes.add(v.routeId);
    }

    // 2. Add SCHEDULED times from timetable when no live vehicle is available
    for (const st of stop.stopTimes) {
      if (!st.trip?.route) continue;
      const r = st.trip.route;

      // Parse schedule time "HH:mm:ss"
      const [sh, sm, ss] = st.arrivalTime.split(':').map((x: string) => parseInt(x, 10) || 0);
      const scheduleSec = sh * 3600 + sm * 60 + ss;

      // Find upcoming trips in next 4 hours
      let diffSec = scheduleSec - currentTimeSec;
      if (diffSec < 0) {
        diffSec += 86400; // Next day
      }

      if (diffSec <= 14400) {
        // Within 4 hours
        const etaMinutes = Math.round(diffSec / 60);
        arrivals.push({
          routeId: r.id,
          routeNumber: r.routeShortName,
          destination: r.destination,
          vehicleId: null,
          vehicleNumber: null,
          etaMinutes,
          expectedTime: st.arrivalTime.substring(0, 5),
          source: 'SCHEDULED',
          distanceMeters: null,
        });
      }
    }

    // Sort by ETA ascending
    return arrivals.sort((a, b) => a.etaMinutes - b.etaMinutes);
  }
}

export const etaService = new EtaService();
export default etaService;
