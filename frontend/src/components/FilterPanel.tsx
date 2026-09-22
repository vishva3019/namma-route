import React from 'react';
import { Filter, X, Check } from 'lucide-react';

interface FilterPanelProps {
  selectedStatus: 'ALL' | 'LIVE' | 'STALE';
  onChangeStatus: (status: 'ALL' | 'LIVE' | 'STALE') => void;
  selectedRadius: number;
  onChangeRadius: (radius: number) => void;
  filterRoute: string;
  onChangeFilterRoute: (route: string) => void;
  isOpen: boolean;
  onClose: () => void;
  availableRoutes: string[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedStatus,
  onChangeStatus,
  selectedRadius,
  onChangeRadius,
  filterRoute,
  onChangeFilterRoute,
  isOpen,
  onClose,
  availableRoutes,
}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 w-72 text-sm text-slate-800">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Map Filters</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
          aria-label="Close filters"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 pt-3">
        {/* Status Filter */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
            Vehicle Status
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            {(['ALL', 'LIVE', 'STALE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => onChangeStatus(st)}
                className={`py-1.5 rounded-lg transition-all ${
                  selectedStatus === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Route Filter */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
            Filter by Route
          </label>
          <select
            value={filterRoute}
            onChange={(e) => onChangeFilterRoute(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="">All Active Routes</option>
            {availableRoutes.map((r) => (
              <option key={r} value={r}>
                Route {r}
              </option>
            ))}
          </select>
        </div>

        {/* Proximity Radius */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nearby Radius
            </label>
            <span className="text-xs font-mono font-bold text-emerald-600">
              {selectedRadius >= 1000 ? `${(selectedRadius / 1000).toFixed(1)} km` : `${selectedRadius} m`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[500, 1000, 2000, 5000].map((r) => (
              <button
                key={r}
                onClick={() => onChangeRadius(r)}
                className={`py-1 rounded-lg text-xs font-semibold border transition-all ${
                  selectedRadius === r
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Filters */}
        {(filterRoute !== '' || selectedStatus !== 'ALL' || selectedRadius !== 3000) && (
          <button
            onClick={() => {
              onChangeFilterRoute('');
              onChangeStatus('ALL');
              onChangeRadius(3000);
            }}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
