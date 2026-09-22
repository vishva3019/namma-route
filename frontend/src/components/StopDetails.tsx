import React from 'react';
import { MapPin, Bus, Clock, Eye, Sparkles } from 'lucide-react';
import { Stop } from '../types/stop';
import { useStopArrivals } from '../hooks/useStops';
import { formatEta, formatClockTime } from '../utils/formatTime';

interface StopDetailsProps {
  stop: Stop;
  onSelectRoute?: (routeNumber: string) => void;
  onTrackOnMap?: () => void;
}

export const StopDetails: React.FC<StopDetailsProps> = ({
  stop,
  onSelectRoute,
  onTrackOnMap,
}) => {
  const { data: arrivals = [], isLoading } = useStopArrivals(stop.id);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      {/* Header */}
      <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-md">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">{stop.name}</h2>
              {stop.nameKannada && (
                <p className="text-xs text-indigo-300 font-medium">{stop.nameKannada}</p>
              )}
            </div>
          </div>

          {stop.platform && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 text-xs font-mono font-bold">
              Platform {stop.platform}
            </span>
          )}
        </div>

        {/* Coordinates */}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 font-mono">
          <span>Lat: {stop.latitude.toFixed(4)}</span>
          <span>Lng: {stop.longitude.toFixed(4)}</span>
          <span>ID: {stop.gtfsStopId}</span>
        </div>

        {onTrackOnMap && (
          <button
            onClick={onTrackOnMap}
            className="mt-4 w-full py-2 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-indigo-500/20"
          >
            <Eye className="w-4 h-4" />
            <span>Center on Map</span>
          </button>
        )}
      </div>

      {/* Routes Serving */}
      {stop.routesServing && stop.routesServing.length > 0 && (
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Routes Serving This Stop ({stop.routesServing.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {stop.routesServing.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectRoute && onSelectRoute(r.routeNumber)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-800 text-xs font-extrabold transition-all shadow-xs"
              >
                {r.routeNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Buses & ETAs */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Upcoming Buses</span>
          </span>
          <span className="text-[11px] text-slate-400">Live arrivals & schedule</span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            Loading upcoming arrivals...
          </div>
        ) : arrivals.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No upcoming buses scheduled for this stop in the near window.
          </div>
        ) : (
          <div className="space-y-2.5">
            {arrivals.map((arr, idx) => {
              const isLive = arr.source === 'LIVE';
              const isEstimated = arr.source === 'ESTIMATED';

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs">
                      {arr.routeNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[150px]">
                          → {arr.destination}
                        </span>
                      </div>
                      {arr.vehicleNumber && (
                        <p className="text-[10px] font-mono text-slate-400">{arr.vehicleNumber}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-extrabold text-slate-900">
                      {formatEta(arr.etaMinutes)}
                    </div>

                    {/* Source Tag Badge */}
                    <div className="mt-0.5">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          LIVE
                        </span>
                      ) : isEstimated ? (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded font-semibold bg-sky-100 text-sky-800">
                          ESTIMATED
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                          Scheduled {arr.expectedTime}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StopDetails;
