import React from 'react';
import { Bus, Navigation, Gauge, Clock, ArrowRight } from 'lucide-react';
import { Vehicle } from '../types/vehicle';
import { formatBearingDirection, formatBusNumber } from '../utils/formatVehicle';
import { formatFreshness } from '../utils/formatTime';

interface BusPopupProps {
  vehicle: Vehicle;
  onTrackRoute?: (routeNumber: string) => void;
}

export const BusPopup: React.FC<BusPopupProps> = ({ vehicle, onTrackRoute }) => {
  const isLive = (vehicle.freshnessSeconds ?? 0) <= 60 && vehicle.status === 'LIVE';

  return (
    <div className="p-3.5 min-w-[270px] max-w-[310px] text-slate-900">
      {/* Top Status Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <Bus className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                {vehicle.routeNumber ? `Route ${vehicle.routeNumber}` : 'BMTC Bus'}
              </span>
            </div>
            <p className="text-[12px] font-mono font-bold text-slate-700">
              {formatBusNumber(vehicle.vehicleNumber)}
              <span className="text-[10px] font-normal text-slate-400 ml-1.5 font-sans">(ID: #{vehicle.id})</span>
            </p>
          </div>
        </div>

        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
          isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
        }`}>
          <span>{isLive ? '🟢 LIVE' : '🟠 STALE'}</span>
        </span>
      </div>

      {/* Direction / Terminus */}
      <div className="mb-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
        <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Direction</span>
        <p className="font-bold text-slate-900 flex items-center gap-1 truncate">
          <span className="text-slate-400 font-normal">Towards</span>
          <span className="text-emerald-700 truncate">{vehicle.destination || 'Scheduled Terminal'}</span>
        </p>
      </div>

      {/* Real-time Stop Status Block */}
      <div className="mb-2.5 p-2.5 rounded-xl border bg-slate-50 border-slate-100 space-y-2 text-xs">
        {/* Status header badge */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Status</span>
          {vehicle.stopStatus === 'AT_STOP' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              🟢 AT STOP
            </span>
          ) : vehicle.stopStatus === 'APPROACHING_STOP' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              🟡 APPROACHING
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
              🔵 IN TRANSIT
            </span>
          )}
        </div>

        {/* Current Stop if AT_STOP */}
        {vehicle.stopStatus === 'AT_STOP' && vehicle.currentStop && (
          <div className="pt-1.5 border-t border-slate-200/60">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Current Stop</span>
            <p className="font-bold text-emerald-800 flex items-center gap-1 truncate mt-0.5">
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-100/70 text-emerald-700 font-extrabold">
                #{vehicle.currentStop.sequence}
              </span>
              <span className="truncate">{vehicle.currentStop.stopName}</span>
            </p>
          </div>
        )}

        {/* Next Stop */}
        <div className="pt-1.5 border-t border-slate-200/60">
          <span className="text-slate-400 text-[10px] uppercase font-bold block">Next Stop</span>
          {vehicle.nextStop ? (
            <div className="flex items-center justify-between mt-0.5">
              <p className="font-bold text-slate-800 truncate flex items-center gap-1">
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-200/70 text-slate-700 font-extrabold">
                  #{vehicle.nextStop.sequence}
                </span>
                <span className="truncate">{vehicle.nextStop.stopName}</span>
              </p>
              <span className="text-[10px] font-mono font-semibold text-slate-500 shrink-0 ml-1">
                ~{vehicle.nextStop.distanceMeters} m
              </span>
            </div>
          ) : vehicle.stopStatus === 'AT_STOP' ? (
            <span className="text-slate-500 text-xs italic">End of Route</span>
          ) : (
            <span className="text-slate-700 font-semibold text-xs truncate block mt-0.5">
              {vehicle.nextStopId || 'En route to next stop'}
            </span>
          )}
        </div>
      </div>

      {/* Speed, Heading & Freshness */}
      <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2 mb-3">
        <div className="flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatBearingDirection(vehicle.bearing)} ({vehicle.bearing || 0}°)</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-mono">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className={isLive ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
            {isLive ? `Updated ${formatFreshness(vehicle.freshnessSeconds)}` : `Last update: ${formatFreshness(vehicle.freshnessSeconds)}`}
          </span>
        </div>
      </div>

      {/* Action Button */}
      {vehicle.routeNumber && onTrackRoute && (
        <button
          onClick={() => onTrackRoute(vehicle.routeNumber!)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
        >
          <span>Track Route {vehicle.routeNumber}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default BusPopup;
