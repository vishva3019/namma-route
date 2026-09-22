import { NormalizedVehicle, ProviderHealth, RealtimeProvider, RealtimeProviderStatus } from './RealtimeProvider';
import { bmtcApiClient } from './BmtcApiClient';
import { BmtcNormalizer } from './BmtcNormalizer';
import Logger from '../../utils/logger';
import prisma from '../../db/prisma';

export class BmtcRealtimeProvider implements RealtimeProvider {
  public readonly name = 'BMTC_REALTIME';
  private reachable: boolean = false;
  private lastSuccessfulUpdate: string | null = null;
  private lastAttempt: string = new Date().toISOString();
  private lastError: string | null = null;
  private lastLatencyMs: number = 0;
  private cachedVehicles: Map<string, NormalizedVehicle> = new Map();
  private routeParentIdCache: Map<string, number> = new Map();

  constructor() {
    // Pre-populate parent IDs for high-frequency Bengaluru corridors to save initial lookup roundtrips
    this.routeParentIdCache.set('500-D', 1066);
    this.routeParentIdCache.set('500D', 1066);
    this.routeParentIdCache.set('335-E', 1242);
    this.routeParentIdCache.set('335E', 1242);
    this.routeParentIdCache.set('365', 843);
    this.routeParentIdCache.set('KIA-8', 1980);
    this.routeParentIdCache.set('KIA8', 1980);
    this.routeParentIdCache.set('201', 512);
  }

  async getVehicles(): Promise<NormalizedVehicle[]> {
    const startTime = Date.now();
    this.lastAttempt = new Date().toISOString();

    try {
      // In production BMTC mobile backend, vehicle positions are returned on route queries
      // Look up active routes from DB
      const routes = await prisma.route.findMany({
        take: 12,
        select: { id: true, routeShortName: true, destination: true },
      });

      const vehiclesMap = new Map<string, NormalizedVehicle>();
      let anyRouteSucceeded = false;
      let lastErrorMessage: string | null = null;

      // Query routes in parallel with bounded concurrency (e.g., 4 at a time)
      const batchSize = 4;
      for (let i = 0; i < routes.length; i += batchSize) {
        const batch = routes.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (route) => {
            // Check cache for route parent ID first
            let parentId = this.routeParentIdCache.get(route.routeShortName) ||
                           this.routeParentIdCache.get(route.routeShortName.replace(/[\s-]+/g, ''));

            if (!parentId) {
              const searchRes = await bmtcApiClient.searchRoute(route.routeShortName);
              parentId = searchRes?.data?.[0]?.routeparentid;
              if (parentId) {
                this.routeParentIdCache.set(route.routeShortName, parentId);
              }
            }

            if (parentId) {
              const details = await bmtcApiClient.getRouteDetails(parentId);
              if (details) {
                anyRouteSucceeded = true;
                const upVehicles = details?.up?.mapData || [];
                const downVehicles = details?.down?.mapData || [];

                for (const v of [...upVehicles, ...downVehicles]) {
                  const normalized = BmtcNormalizer.normalizeRouteVehicle(
                    v,
                    route.id,
                    route.routeShortName,
                    route.destination || undefined
                  );
                  if (normalized) {
                    vehiclesMap.set(normalized.id, normalized);
                  }
                }
              }
            }
          })
        );

        // Check if any error was encountered
        for (const res of results) {
          if (res.status === 'rejected') {
            lastErrorMessage = res.reason?.message || 'Route query failed';
          }
        }

        // If upstream is actively failing (e.g. 403 Forbidden or network error),
        // don't waste time trying remaining batches
        if (!anyRouteSucceeded && (bmtcApiClient.getLastError() || lastErrorMessage)) {
          break;
        }
      }

      this.lastLatencyMs = Date.now() - startTime;

      if (anyRouteSucceeded && vehiclesMap.size > 0) {
        this.reachable = true;
        this.lastSuccessfulUpdate = new Date().toISOString();
        this.lastError = null;
        this.cachedVehicles = vehiclesMap;
        Logger.providerRequest('BMTC_REALTIME', this.lastLatencyMs, vehiclesMap.size, false);
        return Array.from(vehiclesMap.values());
      } else {
        // If no vehicles retrieved or all calls failed
        const apiError = bmtcApiClient.getLastError();
        this.reachable = false;
        this.lastError = apiError || lastErrorMessage || 'Realtime BMTC data unavailable';
        this.cachedVehicles.clear();
        Logger.warn(`[BmtcRealtimeProvider] No live vehicles obtained. Upstream status: ${this.lastError}`);
        return [];
      }
    } catch (err: any) {
      this.lastLatencyMs = Date.now() - startTime;
      this.reachable = false;
      this.lastError = err.message || 'Realtime BMTC data unavailable';
      this.cachedVehicles.clear();
      Logger.error('[BmtcRealtimeProvider] Live fetch failed', err);
      return [];
    }
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
    try {
      const raw = await bmtcApiClient.getVehicleTripDetails(vehicleId);
      const liveLocations = raw?.LiveLocation || [];
      if (liveLocations.length > 0) {
        return BmtcNormalizer.normalizeTripLiveLocation(liveLocations[0]);
      }
    } catch (e: any) {
      Logger.warn(`[BmtcRealtimeProvider] getVehicle failed for ${vehicleId}: ${e.message}`);
    }

    const all = await this.getVehicles();
    return all.find((v) => v.id === vehicleId) || null;
  }

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: this.reachable ? 'HEALTHY' : 'DOWN',
      provider: 'BMTC_REALTIME',
      latencyMs: this.lastLatencyMs,
      message: this.lastError || (this.reachable ? 'BMTC realtime API connected' : 'Realtime BMTC data unavailable'),
      lastCheckTime: this.lastAttempt,
    };
  }

  getStatus(): RealtimeProviderStatus {
    const now = Date.now();
    const dataAge = this.lastSuccessfulUpdate
      ? Math.floor((now - new Date(this.lastSuccessfulUpdate).getTime()) / 1000)
      : 0;

    return {
      provider: 'BMTC_REALTIME',
      configured: true,
      reachable: this.reachable,
      lastSuccessfulUpdate: this.lastSuccessfulUpdate,
      lastAttempt: this.lastAttempt,
      vehicleCount: this.cachedVehicles.size,
      dataAge,
      error: this.lastError,
    };
  }
}

