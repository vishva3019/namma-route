export type EtaSource = 'LIVE' | 'ESTIMATED' | 'SCHEDULED';

export interface UpcomingArrival {
  routeId: string;
  routeNumber: string;
  destination: string;
  vehicleId?: string | null;
  vehicleNumber?: string | null;
  etaMinutes: number;
  expectedTime: string;
  source: EtaSource;
  distanceMeters?: number | null;
  status?: string;
}
