import { apiFetch } from './api';
import { RealtimeVehiclesResponse, Vehicle } from '../types/vehicle';

export const vehiclesApi = {
  async getRealtimeVehicles(): Promise<RealtimeVehiclesResponse> {
    return apiFetch<RealtimeVehiclesResponse>('/realtime/vehicles');
  },

  async getRealtimeStatus(): Promise<any> {
    return apiFetch<any>('/realtime/status');
  },

  async getVehicleById(vehicleId: string): Promise<Vehicle> {
    const res = await apiFetch<{ status: string; data: Vehicle }>(`/vehicles/${vehicleId}`);
    return res.data;
  },

  async getNearbyVehicles(lat: number, lng: number, radiusMeters: number = 3000): Promise<Vehicle[]> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(radiusMeters),
    });
    const res = await apiFetch<{ status: string; count: number; data: Vehicle[] }>(
      `/nearby/vehicles?${params.toString()}`
    );
    return res.data;
  },

  async getStats(): Promise<{
    liveBuses: number;
    activeRoutes: number;
    stops: number;
    lastUpdate: string;
    dataAgeSeconds: number;
    provider: string;
    demoMode: boolean;
  }> {
    const res = await apiFetch<{ status: string; data: any }>('/stats');
    return res.data;
  },
};
