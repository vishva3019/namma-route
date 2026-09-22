import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Search, Filter } from 'lucide-react';
import { useRoutes } from '../hooks/useRoutes';
import RouteList from '../components/RouteList';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export const Routes: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useRoutes(search);

  const handleSelectRoute = (routeNumber: string) => {
    navigate(`/routes/${routeNumber}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">
          <Compass className="w-4 h-4" />
          <span>BMTC Transit Network</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bengaluru Bus Routes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore all operational BMTC routes, timetables, and live fleet density across the city.
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by route number (e.g. 500D, 335E, 356) or destination..."
          className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl border border-slate-200 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      {/* Routes List */}
      {isLoading ? (
        <LoadingState message="Fetching BMTC routes..." />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : (
        <RouteList
          routes={data?.routes || []}
          onSelectRoute={handleSelectRoute}
        />
      )}
    </div>
  );
};

export default Routes;
