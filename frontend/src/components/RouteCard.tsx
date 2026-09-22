import React from 'react';
import { Compass, ArrowRight, Bus } from 'lucide-react';
import { RouteListItem } from '../types/route';

interface RouteCardProps {
  route: RouteListItem;
  onSelect?: (routeNumber: string) => void;
  isSelected?: boolean;
}

export const RouteCard: React.FC<RouteCardProps> = ({ route, onSelect, isSelected = false }) => {
  return (
    <div
      onClick={() => onSelect && onSelect(route.routeNumber)}
      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-emerald-50/50 border-emerald-500 shadow-md shadow-emerald-500/10'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-emerald-400 font-extrabold text-base flex items-center justify-center border border-slate-800 shadow-xs">
            {route.routeNumber}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <span>{route.origin}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span>{route.destination}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{route.routeName}</p>
          </div>
        </div>

        {/* Live Buses Count Pill */}
        <div>
          {route.activeBusesCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{route.activeBusesCount} live</span>
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
              Timetable
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteCard;
