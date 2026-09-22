export type VehicleStatus = 'LIVE' | 'RECENT' | 'STALE';
export type StopStatus = 'AT_STOP' | 'APPROACHING_STOP' | 'IN_TRANSIT' | 'UNKNOWN';

export interface VehicleStopInfo {
  stopId: string;
  stopName: string;
  sequence: number;
  distanceMeters: number;
}

export interface Vehicle {
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
  distanceMeters?: number;
  distanceKm?: number;
}

export interface RealtimeVehiclesResponse {
  status: 'LIVE' | 'DATA DELAYED' | 'TEMPORARILY UNAVAILABLE' | 'UNAVAILABLE';
  provider: string;
  source?: 'BMTC' | 'DEMO';
  timestamp?: string;
  dataAge?: number;
  vehicleCount: number;
  vehicles: Vehicle[];
  demoMode?: boolean;
  error?: string | null;
}

