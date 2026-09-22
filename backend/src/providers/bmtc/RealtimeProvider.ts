export type VehicleStatus = 'LIVE' | 'RECENT' | 'STALE';
export type StopStatus = 'AT_STOP' | 'APPROACHING_STOP' | 'IN_TRANSIT' | 'UNKNOWN';

export interface VehicleStopInfo {
  stopId: string;
  stopName: string;
  sequence: number;
  distanceMeters: number;
}

export interface NormalizedVehicle {
  id: string;
  vehicleNumber: string | null;
  routeId: string | null;
  routeNumber: string | null;
  tripId: string | null;
  latitude: number;
  longitude: number;
  bearing: number | null;
  speed: number | null;
  currentStopId: string | null;
  nextStopId: string | null;
  currentStop?: VehicleStopInfo | null;
  nextStop?: VehicleStopInfo | null;
  stopStatus?: StopStatus;
  timestamp: string;
  freshnessSeconds: number;
  status: VehicleStatus;
  source?: 'BMTC' | 'DEMO';
  etaToNextStop?: string | null;
  destination?: string | null;
}

export interface ProviderHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  provider: string;
  latencyMs: number;
  message?: string;
  lastCheckTime: string;
}

export interface RealtimeProviderStatus {
  provider: 'BMTC_REALTIME' | 'MOCK_DEMO_PROVIDER';
  configured: boolean;
  reachable: boolean;
  lastSuccessfulUpdate: string | null;
  lastAttempt: string;
  vehicleCount: number;
  dataAge: number;
  error: string | null;
}

export interface RealtimeProvider {
  readonly name: string;
  getVehicles(): Promise<NormalizedVehicle[]>;
  getVehiclesByRoute(routeIdOrNumber: string): Promise<NormalizedVehicle[]>;
  getVehicle(vehicleId: string): Promise<NormalizedVehicle | null>;
  getHealth(): Promise<ProviderHealth>;
  getStatus(): RealtimeProviderStatus;
}
