import { NormalizedVehicle, RealtimeProvider, RealtimeProviderStatus } from '../providers/bmtc/RealtimeProvider';
import { BmtcRealtimeProvider } from '../providers/bmtc/BmtcRealtimeProvider';
import { MockRealtimeProvider } from '../providers/bmtc/MockRealtimeProvider';
import { cacheService } from '../cache/cacheService';
import { currentStopService } from './currentStopService';
import Logger from '../utils/logger';

export interface RealtimeVehiclesResponse {
  status: 'LIVE' | 'DATA DELAYED' | 'TEMPORARILY UNAVAILABLE' | 'UNAVAILABLE';
  provider: string;
  source: 'BMTC' | 'DEMO';
  timestamp?: string;
  dataAge?: number;
  vehicleCount: number;
  vehicles: NormalizedVehicle[];
  demoMode?: boolean;
  error?: string | null;
}

export class VehicleService {
  private provider: RealtimeProvider;
  private pollIntervalSeconds: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastPollTimestamp: number = 0;
  private lastKnownVehicles: Map<string, NormalizedVehicle> = new Map();
  private demoMode: boolean;
  private inFlightFetch: Promise<NormalizedVehicle[]> | null = null;

  constructor() {
    this.demoMode = process.env.DEMO_MODE === 'true';
    const providerType = process.env.REALTIME_PROVIDER?.toLowerCase() || 'bmtc';

    if (this.demoMode || providerType === 'mock') {
      this.provider = new MockRealtimeProvider();
      Logger.info('[VehicleService] Initialized with MockRealtimeProvider (DEMO MODE active)');
    } else {
      this.provider = new BmtcRealtimeProvider();
      Logger.info('[VehicleService] Initialized with BmtcRealtimeProvider (REAL BMTC MODE active)');
    }

    const intervalEnv = parseInt(process.env.REALTIME_POLL_INTERVAL || '30', 10);
    // Enforce safety minimum of 10s to prevent spamming
    this.pollIntervalSeconds = Math.max(10, isNaN(intervalEnv) ? 30 : intervalEnv);

    // Start background polling loop
    this.startBackgroundPolling();
  }

  private startBackgroundPolling() {
    Logger.info(`[VehicleService] Starting background polling every ${this.pollIntervalSeconds}s`);

    // Immediate first fetch
    this.fetchAndUpdateVehicles().catch((err) => {
      Logger.error('[VehicleService] Initial vehicle fetch error', err);
    });

    this.pollTimer = setInterval(() => {
      this.fetchAndUpdateVehicles().catch((err) => {
        Logger.error('[VehicleService] Background vehicle poll error', err);
      });
    }, this.pollIntervalSeconds * 1000);

    this.pollTimer.unref();
  }

  /**
   * Fetch live vehicles from active provider and update cache
   */
  async fetchAndUpdateVehicles(): Promise<NormalizedVehicle[]> {
    if (this.inFlightFetch) {
      return this.inFlightFetch;
    }

    this.inFlightFetch = (async () => {
      try {
        const freshVehicles = await this.provider.getVehicles();
        this.lastPollTimestamp = Date.now();

        if (freshVehicles && freshVehicles.length > 0) {
          // Clear previous cache if fresh full batch obtained
          this.lastKnownVehicles.clear();
          for (const vehicle of freshVehicles) {
            this.lastKnownVehicles.set(vehicle.id, vehicle);
          }
        } else if (!this.demoMode) {
          // If not in demo mode and 0 vehicles arrived, don't hold onto stale artifacts
          this.lastKnownVehicles.clear();
        }

        // Remove stale vehicles (> 300 seconds)
        this.removeStaleVehicles();

        const activeVehicles = Array.from(this.lastKnownVehicles.values());

        // Enrich vehicles with route-aware current-stop detection
        try {
          await currentStopService.enrichVehicles(activeVehicles);
        } catch (enrichErr) {
          Logger.error('[VehicleService] Failed to enrich vehicles with current stops', enrichErr);
        }

        // Save into cache layer with TTL
        await cacheService.set('realtime:vehicles:all', activeVehicles, this.pollIntervalSeconds * 2);

        return activeVehicles;
      } catch (err: any) {
        Logger.error('[VehicleService] fetchAndUpdateVehicles failed', err);
        if (!this.demoMode) {
          this.lastKnownVehicles.clear();
        }
        await cacheService.set('realtime:vehicles:all', [], this.pollIntervalSeconds);
        return [];
      } finally {
        this.inFlightFetch = null;
      }
    })();

    return this.inFlightFetch;
  }

  /**
   * Remove vehicles that haven't been heard from in 5 minutes (> 300s)
   */
  private removeStaleVehicles() {
    const now = Date.now();
    for (const [id, vehicle] of this.lastKnownVehicles.entries()) {
      const vehicleTime = new Date(vehicle.timestamp).getTime();
      const ageSeconds = (now - vehicleTime) / 1000;
      if (ageSeconds > 300) {
        this.lastKnownVehicles.delete(id);
      } else {
        vehicle.freshnessSeconds = Math.floor(ageSeconds);
        vehicle.status = ageSeconds <= 60 ? 'LIVE' : ageSeconds <= 120 ? 'RECENT' : 'STALE';
      }
    }
  }

  /**
   * Get all active vehicles with coalescing from cache
   */
  async getAllVehicles(): Promise<RealtimeVehiclesResponse> {
    const statusDiag = this.provider.getStatus();

    if (!this.demoMode) {
      // In Real BMTC mode, check cache first
      let vehicles = await cacheService.get<NormalizedVehicle[]>('realtime:vehicles:all');
      if (!vehicles) {
        vehicles = await this.fetchAndUpdateVehicles();
      }

      const diag = this.provider.getStatus();

      // If upstream is unreachable or returns 0 vehicles, return UNAVAILABLE schema per contract
      if (!diag.reachable || vehicles.length === 0) {
        return {
          status: 'UNAVAILABLE',
          provider: 'BMTC_REALTIME',
          source: 'BMTC',
          vehicleCount: 0,
          vehicles: [],
          error: 'Realtime BMTC data unavailable',
        };
      }

      const dataAge = this.lastPollTimestamp > 0
        ? Math.floor((Date.now() - this.lastPollTimestamp) / 1000)
        : 0;

      return {
        status: dataAge > 120 ? 'DATA DELAYED' : 'LIVE',
        provider: 'BMTC_REALTIME',
        source: 'BMTC',
        timestamp: new Date().toISOString(),
        dataAge,
        vehicleCount: vehicles.length,
        vehicles,
        demoMode: false,
      };
    }

    // Demo Mode Active
    let vehicles = await cacheService.get<NormalizedVehicle[]>('realtime:vehicles:all');
    if (!vehicles || vehicles.length === 0) {
      vehicles = await this.fetchAndUpdateVehicles();
    }

    const dataAge = this.lastPollTimestamp > 0
      ? Math.floor((Date.now() - this.lastPollTimestamp) / 1000)
      : 0;

    return {
      status: 'LIVE',
      provider: 'MOCK_DEMO_PROVIDER',
      source: 'DEMO',
      timestamp: new Date().toISOString(),
      dataAge,
      vehicleCount: vehicles.length,
      vehicles,
      demoMode: true,
    };
  }

  /**
   * Get vehicles plying on a specific route
   */
  async getVehiclesByRoute(routeIdOrNumber: string): Promise<NormalizedVehicle[]> {
    const all = (await this.getAllVehicles()).vehicles;
    const lower = routeIdOrNumber.toLowerCase();
    return all.filter(
      (v) =>
        v.routeId === routeIdOrNumber ||
        v.routeNumber?.toLowerCase() === lower ||
        v.routeNumber?.toLowerCase().replace(/\s+/g, '') === lower.replace(/\s+/g, '')
    );
  }

  /**
   * Get single vehicle details
   */
  async getVehicleById(vehicleId: string): Promise<NormalizedVehicle | null> {
    const all = (await this.getAllVehicles()).vehicles;
    return all.find((v) => v.id === vehicleId) || null;
  }

  /**
   * Get health of provider
   */
  async getProviderHealth() {
    return this.provider.getHealth();
  }

  /**
   * Get diagnostics for /api/realtime/status
   */
  getStatusDiagnostics(): RealtimeProviderStatus {
    return this.provider.getStatus();
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const vehicleService = new VehicleService();
export default vehicleService;

