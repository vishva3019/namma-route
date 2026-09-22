import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { Stop } from '../types/stop';
import { formatDistance, formatWalkingTime } from '../utils/distance';

interface StopCardProps {
  stop: Stop;
  onSelect?: (stop: Stop) => void;
  isSelected?: boolean;
}

export const StopCard: React.FC<StopCardProps> = ({ stop, onSelect, isSelected = false }) => {
  return (
    <div
      onClick={() => onSelect && onSelect(stop)}
      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-indigo-50/50 border-indigo-500 shadow-md shadow-indigo-500/10'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">{stop.name}</h3>
            {stop.nameKannada && (
              <p className="text-xs text-slate-400 font-medium">{stop.nameKannada}</p>
            )}

            {/* Distance / Walking Time Badge if provided */}
            {stop.distanceMeters !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {formatDistance(stop.distanceMeters)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {formatWalkingTime(stop.distanceMeters)}
                </span>
              </div>
            )}
          </div>
        </div>

        {stop.platform && (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-600 rounded">
            Plat. {stop.platform}
          </span>
        )}
      </div>

      {/* Routes serving pills */}
      {stop.routes && stop.routes.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Routes:
          </span>
          {stop.routes.slice(0, 6).map((r) => (
            <span
              key={r.id || r.routeNumber}
              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[11px] border border-slate-200"
            >
              {r.routeNumber}
            </span>
          ))}
          {stop.routes.length > 6 && (
            <span className="text-[10px] font-semibold text-slate-400">
              +{stop.routes.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StopCard;
