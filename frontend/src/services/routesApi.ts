import { apiFetch } from './api';
import { RouteDetails, RouteDirection, RouteListResponse, RouteStop, RouteTimetableItem } from '../types/route';
import { Vehicle } from '../types/vehicle';

export const routesApi = {
  async getRoutes(query?: string, limit: number = 50, offset: number = 0): Promise<RouteListResponse> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const res = await apiFetch<{ status: string; data: RouteListResponse }>(
      `/routes?${params.toString()}`
    );
    return res.data;
  },

  async getRouteById(routeId: string): Promise<RouteDetails> {
    const res = await apiFetch<{ status: string; data: RouteDetails }>(`/routes/${routeId}`);
    return res.data;
  },

  async getRouteDirections(routeId: string): Promise<RouteDirection[]> {
    const res = await apiFetch<{ status: string; count: number; data: RouteDirection[] }>(
      `/routes/${routeId}/directions`
    );
    return res.data;
  },

  async getRouteStops(routeId: string, direction: number = 0): Promise<RouteStop[]> {
    const res = await apiFetch<{ status: string; direction: number; count: number; data: RouteStop[] }>(
      `/routes/${routeId}/stops?direction=${direction}`
    );
    return res.data;
  },

  async getRouteTimetable(routeId: string, direction: number = 0): Promise<RouteTimetableItem[]> {
    const res = await apiFetch<{ status: string; direction: number; count: number; data: RouteTimetableItem[] }>(
      `/routes/${routeId}/timetable?direction=${direction}`
    );
    return res.data;
  },

  async getRouteVehicles(routeId: string): Promise<Vehicle[]> {
    const res = await apiFetch<{ status: string; count: number; data: Vehicle[] }>(
      `/routes/${routeId}/vehicles`
    );
    return res.data;
  },
};
