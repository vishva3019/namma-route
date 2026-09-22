import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Bus, MapPin, RefreshCw, Crosshair } from 'lucide-react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNearbyStops, useNearbyBuses } from '../hooks/useNearbyStops';
import NearbyStops from '../components/NearbyStops';
import NearbyBuses from '../components/NearbyBuses';
import MapView from '../components/MapView';
import { Vehicle } from '../types/vehicle';
import { Stop } from '../types/stop';

export const Nearby: React.FC = () => {
  const navigate = useNavigate();
  const { latitude, longitude, loading: geoLoading, isFallback, refreshLocation } = useGeolocation();
  const [activeTab, setActiveTab] = useState<'buses' | 'stops'>('buses');
  const [radiusMeters, setRadiusMeters] = useState<number>(3000);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);

  const { data: nearbyStops = [], isLoading: stopsLoading } = useNearbyStops(
    latitude,
    longitude,
    radiusMeters
  );
  const { data: nearbyBuses = [], isLoading: busesLoading } = useNearbyBuses(
    latitude,
    longitude,
    radiusMeters
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">
            <Navigation className="w-4 h-4" />
            <span>Proximity Radar</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Nearby BMTC Transit</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time buses and boarding stops detected around your location.
          </p>
        </div>

        {/* Location Status & Refresh */}
        <div className="flex items-center gap-3">
          {isFallback && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl font-medium">
              Using Central Bengaluru reference
            </span>
          )}
          <button
            onClick={refreshLocation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
            <span>Update Location</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Proximity List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Radar Control Tabs & Radius */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm space-y-3">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveTab('buses')}
                className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'buses'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bus className="w-4 h-4" />
                <span>Nearby Buses ({nearbyBuses.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('stops')}
                className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'stops'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Nearby Stops ({nearbyStops.length})</span>
              </button>
            </div>

            {/* Radius Filter Pills */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Radius:
              </span>
              <div className="flex gap-1.5">
                {[500, 1000, 2000, 5000].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadiusMeters(r)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                      radiusMeters === r
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[550px] overflow-y-auto">
            {activeTab === 'buses' ? (
              <NearbyBuses
                buses={nearbyBuses}
                isLoading={busesLoading}
                onSelectBus={(b) => setSelectedVehicle(b)}
              />
            ) : (
              <NearbyStops
                stops={nearbyStops}
                isLoading={stopsLoading}
                onSelectStop={(s) => {
                  setSelectedStop(s);
                  navigate(`/stops/${s.id}`);
                }}
              />
            )}
          </div>
        </div>

        {/* Right Column: Proximity Radar Map */}
        <div className="lg:col-span-7 h-[500px] lg:h-[650px] rounded-3xl overflow-hidden shadow-lg border border-slate-200">
          <MapView
            vehicles={nearbyBuses}
            selectedVehicle={selectedVehicle}
            userLocation={{ latitude, longitude }}
            routeStops={nearbyStops}
            onSelectVehicle={(v) => setSelectedVehicle(v)}
            onSelectStop={(s) => setSelectedStop(s)}
          />
        </div>
      </div>
    </div>
  );
};

export default Nearby;
