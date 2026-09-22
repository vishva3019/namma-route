import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bus, Compass, Navigation, Search, Radio, X } from 'lucide-react';
import MapView from '../components/MapView';
import SearchBar from '../components/SearchBar';
import RouteDetails from '../components/RouteDetails';
import StopDetails from '../components/StopDetails';
import VehicleDetails from '../components/VehicleDetails';
import BottomSheet from '../components/BottomSheet';
import { useLiveVehicles } from '../hooks/useLiveVehicles';
import { useGeolocation } from '../hooks/useGeolocation';
import { useRouteDetails } from '../hooks/useRoutes';
import { useStopDetails } from '../hooks/useStops';
import { vehiclesApi } from '../services/vehiclesApi';
import { Vehicle } from '../types/vehicle';
import { Stop } from '../types/stop';
import { formatFreshness } from '../utils/formatTime';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { data: realtimeData } = useLiveVehicles();
  const { latitude, longitude } = useGeolocation();

  // Selected State
  const [selectedRouteNumber, setSelectedRouteNumber] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Queries for selected entities
  const { data: routeDetails } = useRouteDetails(selectedRouteNumber);
  const { data: stopDetails } = useStopDetails(selectedStopId);

  // Dashboard Stats Query
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => vehiclesApi.getStats(),
    refetchInterval: 25000,
  });

  const handleSelectRoute = (routeNumber: string) => {
    setSelectedRouteNumber(routeNumber);
    setSelectedVehicle(null);
    setSelectedStopId(null);
    setIsMobileSheetOpen(true);
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedStopId(null);
    setIsMobileSheetOpen(true);
  };

  const handleSelectStop = (stop: Stop) => {
    setSelectedStopId(stop.id);
    setSelectedVehicle(null);
    setIsMobileSheetOpen(true);
  };

  const clearSelection = () => {
    setSelectedRouteNumber(null);
    setSelectedVehicle(null);
    setSelectedStopId(null);
    setIsMobileSheetOpen(false);
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-slate-900">
      {/* MAP VIEW CONTAINER (Full screen canvas) */}
      <div className="relative flex-1 h-full w-full">
        {/* Top Overlay Header for Search & Quick Actions */}
        <div className="absolute top-4 left-4 right-16 md:right-auto md:w-96 z-20 space-y-2">
          <SearchBar
            onSelectRoute={handleSelectRoute}
            onSelectStop={handleSelectStop}
          />

          {/* Quick Action Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => navigate('/nearby')}
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm hover:bg-white text-slate-800 text-xs font-bold border border-slate-200/80 shadow-sm flex items-center gap-1.5 shrink-0 transition-transform active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
              <span>Nearby Buses</span>
            </button>
            <button
              onClick={() => navigate('/routes')}
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm hover:bg-white text-slate-800 text-xs font-bold border border-slate-200/80 shadow-sm flex items-center gap-1.5 shrink-0 transition-transform active:scale-95"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              <span>Find a Route</span>
            </button>
            <button
              onClick={() => navigate('/journey')}
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm hover:bg-white text-slate-800 text-xs font-bold border border-slate-200/80 shadow-sm flex items-center gap-1.5 shrink-0 transition-transform active:scale-95"
            >
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Plan Journey</span>
            </button>
          </div>
        </div>

        {/* Dashboard Statistics Floating Bar (Bottom Left) */}
        {stats && (
          <div className="absolute bottom-4 left-4 z-20 hidden lg:flex items-center gap-4 bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-700/80 text-white shadow-2xl text-xs">
            {/* Scheduled Network */}
            <div className="border-r border-slate-700/80 pr-4">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                BMTC Scheduled Network
              </span>
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-extrabold text-sm text-white font-mono">{stats.activeRoutes.toLocaleString()}</span>
                  <span className="text-[11px] text-slate-300 ml-1">routes</span>
                </div>
                <span className="text-slate-600">•</span>
                <div>
                  <span className="font-extrabold text-sm text-white font-mono">{stats.stops.toLocaleString()}</span>
                  <span className="text-[11px] text-slate-300 ml-1">stops</span>
                </div>
              </div>
            </div>

            {/* Live Reporting */}
            <div className="flex items-center gap-3 pr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block mb-0.5">
                  Live BMTC Telemetry
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-emerald-400 font-mono">
                    {stats.liveBuses}
                  </span>
                  <span className="text-[11px] text-slate-300">vehicles reporting live</span>
                  <span className="text-[10px] text-slate-500 font-mono ml-1">
                    (Updated {formatFreshness(stats.dataAgeSeconds)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Map View */}
        <MapView
          vehicles={realtimeData?.vehicles || []}
          selectedVehicle={selectedVehicle}
          onSelectVehicle={handleSelectVehicle}
          selectedRouteNumber={selectedRouteNumber}
          routeGeometry={routeDetails?.geometry || null}
          routeStops={routeDetails?.stops || null}
          selectedStop={stopDetails || null}
          onSelectStop={handleSelectStop}
          userLocation={{ latitude, longitude }}
          onTrackRoute={handleSelectRoute}
        />
      </div>

      {/* DESKTOP SIDE PANEL (Right Sidebar for Details) */}
      {(selectedRouteNumber || selectedVehicle || selectedStopId) && (
        <aside className="hidden md:flex flex-col w-96 bg-white border-l border-slate-200 z-30 shadow-xl overflow-y-auto">
          {/* Close Panel Button */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {selectedVehicle
                ? 'Bus Telemetry'
                : selectedStopId
                ? 'Stop Schedule'
                : 'Route Details'}
            </span>
            <button
              onClick={clearSelection}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3">
            {selectedVehicle && (
              <VehicleDetails
                vehicle={selectedVehicle}
                onSelectRoute={handleSelectRoute}
              />
            )}

            {!selectedVehicle && selectedStopId && stopDetails && (
              <StopDetails
                stop={stopDetails}
                onSelectRoute={handleSelectRoute}
              />
            )}

            {!selectedVehicle && !selectedStopId && routeDetails && (
              <RouteDetails
                route={routeDetails}
                onSelectStop={handleSelectStop}
              />
            )}
          </div>
        </aside>
      )}

      {/* MOBILE BOTTOM SHEET (Responsive for Handhelds) */}
      <BottomSheet
        isOpen={isMobileSheetOpen}
        onClose={clearSelection}
        title={
          selectedVehicle
            ? `Bus ${selectedVehicle.routeNumber}`
            : selectedStopId
            ? stopDetails?.name || 'Bus Stop'
            : selectedRouteNumber
            ? `Route ${selectedRouteNumber}`
            : 'Transit Details'
        }
      >
        {selectedVehicle && (
          <VehicleDetails
            vehicle={selectedVehicle}
            onSelectRoute={handleSelectRoute}
          />
        )}

        {!selectedVehicle && selectedStopId && stopDetails && (
          <StopDetails
            stop={stopDetails}
            onSelectRoute={handleSelectRoute}
          />
        )}

        {!selectedVehicle && !selectedStopId && routeDetails && (
          <RouteDetails
            route={routeDetails}
            onSelectStop={handleSelectStop}
          />
        )}
      </BottomSheet>
    </div>
  );
};

export default Home;
