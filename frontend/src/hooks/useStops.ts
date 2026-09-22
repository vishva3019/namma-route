import { useQuery } from '@tanstack/react-query';
import { stopsApi } from '../services/stopsApi';

export function useStops(searchQuery?: string) {
  return useQuery({
    queryKey: ['stops', searchQuery],
    queryFn: () => stopsApi.getStops(searchQuery),
    staleTime: 60000,
  });
}

export function useStopDetails(stopId: string | null) {
  return useQuery({
    queryKey: ['stopDetails', stopId],
    queryFn: () => (stopId ? stopsApi.getStopById(stopId) : null),
    enabled: !!stopId,
    staleTime: 30000,
  });
}

export function useStopArrivals(stopId: string | null) {
  return useQuery({
    queryKey: ['stopArrivals', stopId],
    queryFn: () => (stopId ? stopsApi.getStopArrivals(stopId) : []),
    enabled: !!stopId,
    refetchInterval: 20000,
  });
}
