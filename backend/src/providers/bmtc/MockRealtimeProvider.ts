import { NormalizedVehicle, ProviderHealth, RealtimeProvider } from './RealtimeProvider';
import { GeoUtils } from '../../utils/geo';
import prisma from '../../db/prisma';

interface SimBus {
  id: string;
  vehicleNumber: string;
  routeId: string;
  routeNumber: string;
  destination: string;
  waypoints: [number, number][];
  currentWaypointIndex: number;
  progressBetweenWaypoints: number; // 0 to 1
  speedKmH: number;
  lastUpdate: number;
  stops: { id: string; name: string; lat: number; lng: number }[];
}

export class MockRealtimeProvider implements RealtimeProvider {
  public readonly name = 'MOCK_DEMO_PROVIDER';
  private buses: SimBus[] = [];
  private initialized = false;

  private async initializeSimBuses() {
    if (this.initialized) return;

    try {
      const routes = await prisma.route.findMany({
        take: 5,
        include: {
          variants: {
            take: 1,
          },
          trips: {
            take: 1,
            include: {
              stopTimes: {
                take: 10,
                include: { stop: true },
                orderBy: { stopSequence: 'asc' },
              },
            },
          },
        },
      });

      const samplePrefixes = ['KA-01-FA-', 'KA-01-F-', 'KA-57-F-', 'KA-04-G-'];
      let busCount = 1001;

      for (const route of routes) {
        const variant = route.variants?.[0];
        if (!variant?.geometry) continue;

        let waypoints: [number, number][] = [];
        try {
          waypoints = JSON.parse(variant.geometry);
        } catch {
          continue;
        }

        if (waypoints.length < 2) continue;

        const firstTrip = route.trips[0];
        const stops = firstTrip
          ? firstTrip.stopTimes.map(st => ({
              id: st.stop.id,
              name: st.stop.name,
              lat: st.stop.latitude,
              lng: st.stop.longitude,
            }))
          : [];

        // Create 2-3 buses per route plying at different positions
        const busesForRoute = 2;
        for (let i = 0; i < busesForRoute; i++) {
          const startIndex = Math.floor((i / busesForRoute) * (waypoints.length - 1));
          const prefix = samplePrefixes[i % samplePrefixes.length];
          const vehicleNumber = `${prefix}${busCount++}`;

          this.buses.push({
            id: `DEMO-BUS-${route.routeShortName}-${i + 1}`,
            vehicleNumber,
            routeId: route.id,
            routeNumber: route.routeShortName,
            destination: route.destination || 'Destination',
            waypoints,
            currentWaypointIndex: startIndex,
            progressBetweenWaypoints: Math.random() * 0.8,
            speedKmH: 22 + Math.floor(Math.random() * 18), // 22 to 40 km/h
            lastUpdate: Date.now() - Math.floor(Math.random() * 25000), // recent
            stops,
          });
        }
      }

      this.initialized = true;
    } catch (err: any) {
      console.warn('[MockRealtimeProvider] Initialization warning:', err.message);
    }
  }

  private advanceSimBuses() {
    const now = Date.now();
    for (const bus of this.buses) {
      const elapsedSeconds = (now - bus.lastUpdate) / 1000;
      bus.lastUpdate = now;

      // Speed in m/s
      const speedMs = (bus.speedKmH * 1000) / 3600;
      const distanceTraveled = speedMs * elapsedSeconds;

      const wp1 = bus.waypoints[bus.currentWaypointIndex];
      const nextIdx = (bus.currentWaypointIndex + 1) % bus.waypoints.length;
      const wp2 = bus.waypoints[nextIdx];

      const segmentDistance = Math.max(1, GeoUtils.haversineDistanceMeters(wp1[0], wp1[1], wp2[0], wp2[1]));
      const progressIncrement = distanceTraveled / segmentDistance;

      bus.progressBetweenWaypoints += progressIncrement;
      if (bus.progressBetweenWaypoints >= 1.0) {
        bus.progressBetweenWaypoints = 0;
        bus.currentWaypointIndex = nextIdx;
      }
    }
  }

  async getVehicles(): Promise<NormalizedVehicle[]> {
    await this.initializeSimBuses();
    this.advanceSimBuses();

    const now = new Date();
    return this.buses.map((bus) => {
      const wp1 = bus.waypoints[bus.currentWaypointIndex];
      const nextIdx = (bus.currentWaypointIndex + 1) % bus.waypoints.length;
      const wp2 = bus.waypoints[nextIdx];

      // Interpolate current lat and lon
      const lat = wp1[0] + (wp2[0] - wp1[0]) * bus.progressBetweenWaypoints;
      const lon = wp1[1] + (wp2[1] - wp1[1]) * bus.progressBetweenWaypoints;
      const bearing = GeoUtils.calculateBearing(wp1[0], wp1[1], wp2[0], wp2[1]);

      // Find closest current and next stop
      let currentStopId: string | null = null;
      let nextStopId: string | null = null;
      let closestDistance = Infinity;

      for (let sIdx = 0; sIdx < bus.stops.length; sIdx++) {
        const stop = bus.stops[sIdx];
        const dist = GeoUtils.haversineDistanceMeters(lat, lon, stop.lat, stop.lng);
        if (dist < closestDistance) {
          closestDistance = dist;
          currentStopId = stop.id;
          const nextStop = bus.stops[(sIdx + 1) % bus.stops.length];
          nextStopId = nextStop ? nextStop.id : null;
        }
      }

      const freshness = Math.floor((Date.now() - bus.lastUpdate) / 1000);

      return {
        id: bus.id,
        vehicleNumber: bus.vehicleNumber,
        routeId: bus.routeId,
        routeNumber: bus.routeNumber,
        tripId: null,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6)),
        bearing: Math.round(bearing),
        speed: bus.speedKmH,
        currentStopId,
        nextStopId,
        timestamp: now.toISOString(),
        freshnessSeconds: freshness,
        status: 'LIVE',
        source: 'DEMO',
        destination: bus.destination,
      };
    });
  }

  async getVehiclesByRoute(routeIdOrNumber: string): Promise<NormalizedVehicle[]> {
    const all = await this.getVehicles();
    return all.filter(
      (v) =>
        v.routeId === routeIdOrNumber ||
        v.routeNumber?.toLowerCase() === routeIdOrNumber.toLowerCase()
    );
  }

  async getVehicle(vehicleId: string): Promise<NormalizedVehicle | null> {
    const all = await this.getVehicles();
    return all.find((v) => v.id === vehicleId) || null;
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: 'HEALTHY',
      provider: 'MOCK_DEMO_PROVIDER (DEMO MODE)',
      latencyMs: 1,
      lastCheckTime: new Date().toISOString(),
    };
  }

  getStatus(): import('./RealtimeProvider').RealtimeProviderStatus {
    return {
      provider: 'MOCK_DEMO_PROVIDER',
      configured: true,
      reachable: true,
      lastSuccessfulUpdate: new Date().toISOString(),
      lastAttempt: new Date().toISOString(),
      vehicleCount: this.buses.length,
      dataAge: 0,
      error: null,
    };
  }
}

