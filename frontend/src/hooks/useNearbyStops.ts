import { useQuery } from '@tanstack/react-query';
import { stopsApi } from '../services/stopsApi';
import { vehiclesApi } from '../services/vehiclesApi';

export function useNearbyStops(lat: number, lng: number, radiusMeters: number = 3000) {
  return useQuery({
    queryKey: ['nearbyStops', lat, lng, radiusMeters],
    queryFn: () => stopsApi.getNearbyStops(lat, lng, radiusMeters),
    staleTime: 30000,
  });
}

export function useNearbyBuses(lat: number, lng: number, radiusMeters: number = 3000) {
  return useQuery({
    queryKey: ['nearbyBuses', lat, lng, radiusMeters],
    queryFn: () => vehiclesApi.getNearbyVehicles(lat, lng, radiusMeters),
    refetchInterval: 20000,
  });
}
