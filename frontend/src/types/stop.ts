export interface RouteServing {
  id: string;
  routeNumber: string;
  routeName: string;
  origin?: string;
  destination?: string;
}

export interface Stop {
  id: string;
  gtfsStopId: string;
  name: string;
  nameKannada?: string | null;
  latitude: number;
  longitude: number;
  platform?: string | null;
  routes?: RouteServing[];
  routesServing?: RouteServing[];
  distanceMeters?: number;
  distanceKm?: number;
  walkingMinutes?: number;
  bearing?: number;
  matchedAlias?: string | null;
  aliasType?: string | null;
}

export interface StopListResponse {
  total: number;
  limit: number;
  offset: number;
  stops: Stop[];
}
