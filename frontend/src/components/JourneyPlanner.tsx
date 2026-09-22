import React, { useState } from 'react';
import { Search, ArrowRight, Clock, Navigation, Bus, MapPin, Loader2, Shuffle } from 'lucide-react';
import { journeyApi } from '../services/journeyApi';
import { JourneyPlan } from '../types/journey';

interface JourneyPlannerProps {
  onSelectPlan?: (plan: JourneyPlan) => void;
  defaultFrom?: string;
  defaultTo?: string;
}

export const JourneyPlanner: React.FC<JourneyPlannerProps> = ({
  onSelectPlan,
  defaultFrom = '',
  defaultTo = '',
}) => {
  const [fromInput, setFromInput] = useState(defaultFrom);
  const [toInput, setToInput] = useState(defaultTo);
  const [plans, setPlans] = useState<JourneyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'transfer'>('all');

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fromInput.trim() || !toInput.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const results = await journeyApi.planJourney(fromInput.trim(), toInput.trim());
      setPlans(results);
      if (results.length > 0) {
        setSelectedPlanId(results[0].id);
        if (onSelectPlan) onSelectPlan(results[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to calculate transit route');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = () => {
    setFromInput(toInput);
    setToInput(fromInput);
  };

  const selectPlan = (plan: JourneyPlan) => {
    setSelectedPlanId(plan.id);
    if (onSelectPlan) onSelectPlan(plan);
  };

  const directCount = plans.filter((p) => p.type === 'DIRECT').length;
  const transferCount = plans.filter((p) => p.type === 'TRANSFER').length;
  const displayedPlans = plans.filter((p) => {
    if (filterTab === 'direct') return p.type === 'DIRECT';
    if (filterTab === 'transfer') return p.type === 'TRANSFER';
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      {/* Search Header */}
      <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white">
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-400" />
          <span>Plan BMTC Journey</span>
        </h2>

        <form onSubmit={handleSearch} className="space-y-2.5">
          <div className="relative">
            <MapPin className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              placeholder="Origin stop (e.g. Majestic, Silk Board)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-center -my-1 relative z-10">
            <button
              type="button"
              onClick={handleSwap}
              className="p-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors border border-slate-600 shadow-sm"
              title="Swap origin and destination"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <MapPin className="w-4 h-4 text-rose-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="Destination stop (e.g. Anekal, Electronic City)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !fromInput || !toInput}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-colors shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 mt-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finding Best Bus Corridors...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Find Transit Routes</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Filter Tabs */}
      {plans.length > 0 && (
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setFilterTab('all')}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
              filterTab === 'all'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            All Options ({plans.length})
          </button>
          <button
            onClick={() => setFilterTab('direct')}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
              filterTab === 'direct'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Direct ({directCount})
          </button>
          <button
            onClick={() => setFilterTab('transfer')}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
              filterTab === 'transfer'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            1 Transfer ({transferCount})
          </button>
        </div>
      )}

      {/* Results Section */}
      <div className="p-4 max-h-[460px] overflow-y-auto space-y-3">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {hasSearched && !isLoading && plans.length === 0 && !error && (
          <div className="py-8 text-center text-slate-400 text-xs">
            No direct or 1-transfer BMTC route found between these locations. Try searching by major hub names like Majestic, Silk Board, or Electronic City.
          </div>
        )}

        {displayedPlans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const isDirect = plan.type === 'DIRECT';

          return (
            <div
              key={plan.id}
              onClick={() => selectPlan(plan)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-50/40 border-emerald-500 shadow-md shadow-emerald-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Plan Summary Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                      isDirect
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {isDirect ? 'DIRECT' : '1 TRANSFER'}
                  </span>

                  {plan.hasLiveBuses ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live buses broadcasting
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Scheduled timetable</span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-sm font-extrabold text-slate-900">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{plan.totalDurationMinutes} min</span>
                  <span className="text-slate-400 text-xs font-normal">({plan.totalDistanceKm} km)</span>
                </div>
              </div>

              {/* Legs Overview */}
              <div className="space-y-2.5">
                {plan.legs.map((leg, idx) => {
                  const totalStopsCount = leg.stopCount || (leg.intermediateStops ? leg.intermediateStops.length + 1 : 0);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-400 font-black text-xs font-mono">
                            {leg.routeNumber}
                          </span>
                          <span className="font-bold text-slate-900">{leg.fromStop.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {leg.durationMinutes} min • {leg.distanceKm} km
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 flex items-center justify-between ml-1 pt-1 border-t border-slate-200/60">
                        <div className="flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-emerald-600" />
                          <span>To <strong className="text-slate-800">{leg.toStop.name}</strong></span>
                          <span className="text-slate-400 ml-1 font-semibold">({totalStopsCount} stops)</span>
                        </div>
                        {leg.activeBusesCount > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {leg.activeBusesCount} active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Regular service</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Transfer note */}
              {plan.transferStop && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <p className="text-indigo-700 font-semibold flex items-center gap-1">
                    <span>Change buses at:</span>
                    <strong>{plan.transferStop.name}</strong>
                  </p>
                  <span className="text-slate-400 text-[10px]">Estimated transfer: ~8 min</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JourneyPlanner;
