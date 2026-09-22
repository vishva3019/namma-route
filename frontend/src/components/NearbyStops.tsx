import React from 'react';
import { MapPin, Navigation, ArrowUpRight } from 'lucide-react';
import { Stop } from '../types/stop';
import { formatDistance, formatWalkingTime } from '../utils/distance';
import { formatBearingDirection } from '../utils/formatVehicle';

interface NearbyStopsProps {
  stops: Stop[];
  isLoading: boolean;
  onSelectStop?: (stop: Stop) => void;
}

export const NearbyStops: React.FC<NearbyStopsProps> = ({
  stops,
  isLoading,
  onSelectStop,
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

  if (stops.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700">No BMTC stops found nearby</p>
        <p className="text-xs text-slate-400 mt-1">Try increasing your search radius.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {stops.map((stop) => (
        <div
          key={stop.id}
          onClick={() => onSelectStop && onSelectStop(stop)}
          className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                {stop.name}
              </h4>
              {stop.nameKannada && (
                <p className="text-[11px] text-slate-400">{stop.nameKannada}</p>
              )}

              {/* Routes Serving List */}
              {stop.routes && stop.routes.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {stop.routes.slice(0, 4).map((r: any, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-extrabold text-[10px]"
                    >
                      {typeof r === 'string' ? r : r.routeNumber}
                    </span>
                  ))}
                  {stop.routes.length > 4 && (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      +{stop.routes.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs font-bold text-slate-900">
              {formatDistance(stop.distanceMeters)}
            </div>
            <div className="text-[11px] text-slate-400">
              {formatWalkingTime(stop.distanceMeters)}
            </div>
            {stop.bearing !== undefined && (
              <div className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-0.5 mt-0.5">
                <Navigation className="w-2.5 h-2.5" />
                <span>{formatBearingDirection(stop.bearing)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NearbyStops;
