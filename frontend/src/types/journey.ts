export interface JourneyLeg {
  routeId: string;
  routeNumber: string;
  routeName: string;
  fromStop: { id: string; name: string; latitude: number; longitude: number };
  toStop: { id: string; name: string; latitude: number; longitude: number };
  intermediateStops: { id: string; name: string; latitude: number; longitude: number }[];
  stopCount?: number;
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
  transferStop?: { id: string; name: string; latitude: number; longitude: number };
  hasLiveBuses: boolean;
}
