import { apiFetch } from './api';
import { Stop, StopListResponse } from '../types/stop';
import { UpcomingArrival } from '../types/eta';
import { Vehicle } from '../types/vehicle';

export const stopsApi = {
  async getStops(query?: string, limit: number = 50, offset: number = 0): Promise<StopListResponse> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const res = await apiFetch<{ status: string; data: StopListResponse }>(
      `/stops?${params.toString()}`
    );
    return res.data;
  },

  async getStopById(stopId: string): Promise<Stop> {
    const res = await apiFetch<{ status: string; data: Stop }>(`/stops/${stopId}`);
    return res.data;
  },

  async getStopArrivals(stopId: string): Promise<UpcomingArrival[]> {
    const res = await apiFetch<{ status: string; count: number; data: UpcomingArrival[] }>(
      `/stops/${stopId}/eta`
    );
    return res.data;
  },

  async getStopVehicles(stopId: string): Promise<Vehicle[]> {
    const res = await apiFetch<{ status: string; count: number; data: Vehicle[] }>(
      `/stops/${stopId}/vehicles`
    );
    return res.data;
  },

  async getNearbyStops(lat: number, lng: number, radiusMeters: number = 3000): Promise<Stop[]> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: String(radiusMeters),
    });
    const res = await apiFetch<{ status: string; count: number; data: Stop[] }>(
      `/nearby/stops?${params.toString()}`
    );
    return res.data;
  },
};
