import { useQuery } from '@tanstack/react-query';
import { vehiclesApi } from '../services/vehiclesApi';
import { RealtimeVehiclesResponse } from '../types/vehicle';

export function useLiveVehicles(pollIntervalMs: number = 25000) {
  return useQuery<RealtimeVehiclesResponse>({
    queryKey: ['liveVehicles'],
    queryFn: () => vehiclesApi.getRealtimeVehicles(),
    refetchInterval: pollIntervalMs,
    staleTime: 10000,
    retry: 2,
  });
}

export function useVehicleDetails(vehicleId: string | null) {
  return useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => (vehicleId ? vehiclesApi.getVehicleById(vehicleId) : null),
    enabled: !!vehicleId,
    refetchInterval: 15000,
  });
}
