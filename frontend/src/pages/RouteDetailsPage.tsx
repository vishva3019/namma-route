import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useRouteDetails } from '../hooks/useRoutes';
import RouteDetails from '../components/RouteDetails';
import MapView from '../components/MapView';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export const RouteDetailsPage: React.FC = () => {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const { data: route, isLoading, error, refetch } = useRouteDetails(routeId || null);
  const [selectedDirection, setSelectedDirection] = useState<number>(0);

  if (isLoading) return <LoadingState message="Loading route details..." />;
  if (error || !route) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <ErrorState
          title="Route Not Found"
          message={`Unable to find route information for "${routeId}".`}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Get geometry for active direction
  const activeDirObj = route.directions?.find((d) => d.direction === selectedDirection);
  const activeGeometry = activeDirObj?.geometry || route.geometry;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Routes</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Route Details, Stops, Timetable */}
        <div className="lg:col-span-5">
          <RouteDetails
            route={route}
            selectedDirection={selectedDirection}
            onDirectionChange={(dir) => setSelectedDirection(dir)}
            onSelectStop={(stop) => navigate(`/stops/${stop.id}`)}
          />
        </div>

        {/* Right Side: Route Map */}
        <div className="lg:col-span-7 h-[500px] lg:h-[650px] rounded-3xl overflow-hidden shadow-lg border border-slate-200">
          <MapView
            vehicles={route.liveBuses}
            selectedRouteNumber={route.routeNumber}
            routeGeometry={activeGeometry}
            routeStops={route.stops as any}
          />
        </div>
      </div>
    </div>
  );
};

export default RouteDetailsPage;
