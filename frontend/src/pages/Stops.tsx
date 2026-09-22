import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { useStops } from '../hooks/useStops';
import StopCard from '../components/StopCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

export const Stops: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useStops(search);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
          <MapPin className="w-4 h-4" />
          <span>BMTC Stations & Shelters</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bengaluru Bus Stops</h1>
        <p className="text-sm text-slate-500 mt-1">
          Search over 9,700+ BMTC bus stations, platform allocations, and bilingual Kannada names.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by stop name in English or Kannada (e.g. Majestic, Silk Board, ಮಾರತ್‌ಹಳ್ಳಿ)..."
          className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-slate-200 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
      </div>

      {/* Stops Grid */}
      {isLoading ? (
        <LoadingState message="Fetching BMTC stops..." />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : data?.stops && data.stops.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.stops.map((stop) => (
            <StopCard
              key={stop.id}
              stop={stop}
              onSelect={(s) => navigate(`/stops/${s.id}`)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No stops match your query"
          description="Try searching with a broader location name like Majestic, Indiranagar, or Koramangala."
        />
      )}
    </div>
  );
};

export default Stops;
