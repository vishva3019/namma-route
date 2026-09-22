export interface RouteStop {
  id: string;
  stopId?: string;
  gtfsStopId?: string;
  name: string;
  nameKannada?: string | null;
  latitude: number;
  longitude: number;
  sequence: number;
  arrivalTime?: string;
  departureTime?: string;
}

export interface RouteDirection {
  direction: number;
  directionName: string;
  originName: string;
  destinationName: string;
  stopCount: number;
  shapeId?: string | null;
  geometry?: [number, number][] | null;
}

export interface RouteTimetableItem {
  tripId: string;
  direction: number;
  tripHeadsign?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  originStop?: string | null;
  destinationStop?: string | null;
}

export interface RouteListItem {
  id: string;
  routeId?: string;
  gtfsRouteId?: string;
  routeNumber: string;
  routeName: string;
  routeDisplayName?: string;
  routeFamily?: string;
  serviceType?: string;
  origin: string;
  destination: string;
  direction?: number;
  routeType: number;
  activeBusesCount: number;
}

export interface RouteDetails extends RouteListItem {
  geometry: [number, number][] | null;
  stops: RouteStop[];
  directions?: RouteDirection[];
  liveBuses: import('./vehicle').Vehicle[];
}

export interface RouteListResponse {
  total: number;
  limit: number;
  offset: number;
  routes: RouteListItem[];
}
