import React from 'react';
import { Bus, Navigation, ArrowRight } from 'lucide-react';
import { Vehicle } from '../types/vehicle';
import { formatDistance } from '../utils/distance';
import { formatBearingDirection, formatBusNumber } from '../utils/formatVehicle';
import { formatFreshness } from '../utils/formatTime';

interface NearbyBusesProps {
  buses: Vehicle[];
  isLoading: boolean;
  onSelectBus?: (vehicle: Vehicle) => void;
}

export const NearbyBuses: React.FC<NearbyBusesProps> = ({
  buses,
  isLoading,
  onSelectBus,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (buses.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <Bus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">No live buses nearby</p>
        <p className="text-xs text-slate-400 mt-1">Try expanding the radar radius above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {buses.map((bus) => {
        const isLive = bus.status === 'LIVE';

        return (
          <div
            key={bus.id}
            onClick={() => onSelectBus && onSelectBus(bus)}
            className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-extrabold text-sm border border-slate-800 shadow-xs group-hover:scale-105 transition-transform">
                {bus.routeNumber || 'BUS'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {formatBusNumber(bus.vehicleNumber)}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                      isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isLive ? 'LIVE' : 'STALE'}
                  </span>
                </div>

                {bus.destination && (
                  <p className="text-[11px] text-slate-500 truncate max-w-[170px]">
                    To <span className="font-semibold text-slate-700">{bus.destination}</span>
                  </p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                  <span>Speed: {bus.speed || 24} km/h</span>
                  <span>•</span>
                  <span>{formatFreshness(bus.freshnessSeconds)}</span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs font-extrabold text-slate-900">
                {formatDistance(bus.distanceMeters)}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1 mt-0.5">
                <Navigation className="w-3 h-3" />
                <span>{formatBearingDirection(bus.bearing)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NearbyBuses;
