import React, { useState, useEffect, useRef } from 'react';
import { Search, Bus, MapPin, X, ArrowRight, Loader2, Radio } from 'lucide-react';
import { routesApi } from '../services/routesApi';
import { stopsApi } from '../services/stopsApi';
import { vehiclesApi } from '../services/vehiclesApi';
import { RouteListItem } from '../types/route';
import { Stop } from '../types/stop';
import { Vehicle } from '../types/vehicle';

interface SearchBarProps {
  onSelectRoute?: (routeNumber: string) => void;
  onSelectStop?: (stop: Stop) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSelectRoute,
  onSelectStop,
  onSelectVehicle,
  placeholder = 'Search route (356-M), stop (Majestic), or bus (KA51AJ6166)...',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [routeResults, setRouteResults] = useState<RouteListItem[]>([]);
  const [stopResults, setStopResults] = useState<Stop[]>([]);
  const [liveBusResults, setLiveBusResults] = useState<Vehicle[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length === 0) {
      setRouteResults([]);
      setStopResults([]);
      setLiveBusResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const cleanQ = query.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const [routesRes, stopsRes, vehiclesRes] = await Promise.all([
          routesApi.getRoutes(query, 5),
          stopsApi.getStops(query, 5),
          vehiclesApi.getRealtimeVehicles().catch(() => ({ vehicles: [] } as any)),
        ]);
        setRouteResults(routesRes.routes || []);
        setStopResults(stopsRes.stops || []);

        const activeVehicles = vehiclesRes.vehicles || [];
        const matchedVehicles = activeVehicles.filter((v: Vehicle) => {
          const reg = (v.vehicleNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const vId = (v.id || '').toUpperCase();
          const rNum = (v.routeNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          return (cleanQ.length >= 3 && reg.includes(cleanQ)) || vId === cleanQ || (cleanQ.length >= 3 && rNum === cleanQ);
        }).slice(0, 3);

        setLiveBusResults(matchedVehicles);
        setIsOpen(true);
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearSearch = () => {
    setQuery('');
    setRouteResults([]);
    setStopResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (routeResults.length > 0 || stopResults.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2.5 bg-white rounded-xl border border-slate-200 shadow-sm text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3.5 w-4 h-4 text-slate-400 animate-spin" />
        ) : query ? (
          <button
            onClick={clearSearch}
            className="absolute right-3.5 p-0.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (routeResults.length > 0 || stopResults.length > 0 || liveBusResults.length > 0) && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {/* Live Buses Section */}
          {liveBusResults.length > 0 && (
            <div className="p-2 bg-emerald-50/40">
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                  <span>LIVE BUS</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-bold">Realtime GPS</span>
              </div>
              {liveBusResults.map((bus) => (
                <div
                  key={bus.id}
                  onClick={() => {
                    if (onSelectVehicle) onSelectVehicle(bus);
                    else if (onSelectRoute && bus.routeNumber) onSelectRoute(bus.routeNumber);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between p-2.5 hover:bg-emerald-100/60 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      <Bus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900 font-mono">
                          {bus.vehicleNumber || bus.id}
                        </span>
                        {bus.routeNumber && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-emerald-400 font-bold">
                            Route {bus.routeNumber}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                          ● LIVE
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {bus.destination ? `Towards ${bus.destination}` : 'In Service'} • Heading {bus.bearing || 0}°
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    VIEW
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Routes Section */}
          {routeResults.length > 0 && (
            <div className="p-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2.5 py-1 block">
                ROUTE
              </span>
              {routeResults.map((route) => (
                <div
                  key={route.id}
                  onClick={() => {
                    if (onSelectRoute) onSelectRoute(route.routeNumber);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center font-black text-xs border border-slate-800">
                      {route.routeNumber}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {route.origin} → {route.destination}
                      </h4>
                      <p className="text-[11px] text-slate-400">{route.routeName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {route.activeBusesCount > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {route.activeBusesCount} live
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Scheduled</span>
                    )}
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      TRACK
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stops Section */}
          {stopResults.length > 0 && (
            <div className="p-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2.5 py-1 block">
                STOP
              </span>
              {stopResults.map((stop) => (
                <div
                  key={stop.id}
                  onClick={() => {
                    if (onSelectStop) onSelectStop(stop);
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                          {stop.name}
                        </h4>
                        {stop.matchedAlias && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-medium">
                            {stop.matchedAlias}
                          </span>
                        )}
                      </div>
                      {stop.nameKannada && (
                        <p className="text-[11px] text-slate-400">{stop.nameKannada}</p>
                      )}
                    </div>
                  </div>

                  {stop.routes && stop.routes.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      {stop.routes.length} routes serving
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
