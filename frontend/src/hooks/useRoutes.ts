import { useQuery } from '@tanstack/react-query';
import { routesApi } from '../services/routesApi';

export function useRoutes(searchQuery?: string) {
  return useQuery({
    queryKey: ['routes', searchQuery],
    queryFn: () => routesApi.getRoutes(searchQuery),
    staleTime: 60000,
  });
}

export function useRouteDetails(routeId: string | null) {
  return useQuery({
    queryKey: ['routeDetails', routeId],
    queryFn: () => (routeId ? routesApi.getRouteById(routeId) : null),
    enabled: !!routeId,
    staleTime: 30000,
  });
}
