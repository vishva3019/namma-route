import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Vehicle } from '../types/vehicle';
import { Stop } from '../types/stop';
import { RouteStop } from '../types/route';
import BusMarker from './BusMarker';
import MapControls from './MapControls';

// Component to programmatically manipulate map position & zoom
function MapEffect({
  center,
  zoom,
}: {
  center?: [number, number];
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

interface MapViewProps {
  vehicles?: Vehicle[];
  selectedVehicle?: Vehicle | null;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  selectedRouteNumber?: string | null;
  routeGeometry?: [number, number][] | null;
  routeStops?: (Stop | RouteStop | any)[] | null;
  selectedStop?: Stop | null;
  onSelectStop?: (stop: Stop) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  onTrackRoute?: (routeNumber: string) => void;
  height?: string;
}

const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

export const MapView: React.FC<MapViewProps> = ({
  vehicles = [],
  selectedVehicle = null,
  onSelectVehicle,
  selectedRouteNumber = null,
  routeGeometry = null,
  routeStops = null,
  selectedStop = null,
  onSelectStop,
  userLocation = null,
  onTrackRoute,
  height = '100%',
}) => {
  const mapRef = useRef<L.Map | null>(null);

  // Layer visibility states
  const [showBuses, setShowBuses] = React.useState(true);
  const [showStops, setShowStops] = React.useState(true);
  const [showRouteLines, setShowRouteLines] = React.useState(true);

  // Programmatic center target
  const [targetCenter, setTargetCenter] = React.useState<[number, number] | undefined>(undefined);
  const [targetZoom, setTargetZoom] = React.useState<number | undefined>(undefined);

  // When selected vehicle changes, pan to it
  useEffect(() => {
    if (selectedVehicle) {
      setTargetCenter([selectedVehicle.latitude, selectedVehicle.longitude]);
      setTargetZoom(15);
    }
  }, [selectedVehicle]);

  // When selected stop changes, pan to it
  useEffect(() => {
    if (selectedStop) {
      setTargetCenter([selectedStop.latitude, selectedStop.longitude]);
      setTargetZoom(15);
    }
  }, [selectedStop]);

  // Map Controls Handlers
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const handleRecenter = () => {
    setTargetCenter(BENGALURU_CENTER);
    setTargetZoom(12);
  };

  const handleLocateMe = () => {
    if (userLocation) {
      setTargetCenter([userLocation.latitude, userLocation.longitude]);
      setTargetZoom(15);
    }
  };

  // Filter vehicles if a specific route is selected (memoized)
  const displayVehicles = React.useMemo(() => {
    if (!selectedRouteNumber) return vehicles;
    const cleanRoute = selectedRouteNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
    return vehicles.filter(
      (v) =>
        v.routeNumber?.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanRoute
    );
  }, [vehicles, selectedRouteNumber]);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ height }}>
      <MapContainer
        center={BENGALURU_CENTER}
        zoom={12}
        zoomControl={false}
        className="w-full h-full z-0"
        ref={mapRef}
      >
        <MapEffect center={targetCenter} zoom={targetZoom} />

        {/* Clean OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Route Line Geometry */}
        {showRouteLines && routeGeometry && routeGeometry.length > 1 && (
          <Polyline
            positions={routeGeometry}
            pathOptions={{
              color: '#059669', // Emerald 600
              weight: 5,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Route Stops / Waypoint Markers */}
        {showStops &&
          routeStops &&
          routeStops.map((stop) => (
            <CircleMarker
              key={stop.id}
              center={[stop.latitude, stop.longitude]}
              radius={selectedStop?.id === stop.id ? 8 : 5}
              pathOptions={{
                color: selectedStop?.id === stop.id ? '#4f46e5' : '#0f172a',
                fillColor: selectedStop?.id === stop.id ? '#818cf8' : '#ffffff',
                fillOpacity: 1,
                weight: 2.5,
              }}
              eventHandlers={{
                click: () => onSelectStop && onSelectStop(stop),
              }}
            >
              <Popup closeButton={false}>
                <div className="p-2 text-xs">
                  <span className="font-bold text-slate-900 block">{stop.name}</span>
                  {stop.nameKannada && (
                    <span className="text-slate-500 text-[11px] block">{stop.nameKannada}</span>
                  )}
                  {stop.platform && (
                    <span className="mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] inline-block">
                      Platform {stop.platform}
                    </span>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* Live Bus Markers */}
        {showBuses &&
          displayVehicles.map((vehicle) => (
            <BusMarker
              key={vehicle.id}
              vehicle={vehicle}
              isSelected={selectedVehicle?.id === vehicle.id}
              onSelect={onSelectVehicle}
              onTrackRoute={onTrackRoute}
            />
          ))}

        {/* User Location Pulse Marker */}
        {userLocation && (
          <CircleMarker
            center={[userLocation.latitude, userLocation.longitude]}
            radius={8}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#3b82f6',
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Popup closeButton={false}>
              <div className="p-1.5 text-xs font-semibold text-slate-800">
                <span>You are here</span>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Floating Map Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-30">
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onRecenter={handleRecenter}
          onLocateMe={handleLocateMe}
          showBuses={showBuses}
          onToggleBuses={() => setShowBuses(!showBuses)}
          showStops={showStops}
          onToggleStops={() => setShowStops(!showStops)}
          showRouteLines={showRouteLines}
          onToggleRouteLines={() => setShowRouteLines(!showRouteLines)}
        />
      </div>
    </div>
  );
};

export default MapView;
