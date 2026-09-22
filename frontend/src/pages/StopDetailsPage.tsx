import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStopDetails } from '../hooks/useStops';
import StopDetails from '../components/StopDetails';
import MapView from '../components/MapView';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export const StopDetailsPage: React.FC = () => {
  const { stopId } = useParams<{ stopId: string }>();
  const navigate = useNavigate();
  const { data: stop, isLoading, error, refetch } = useStopDetails(stopId || null);

  if (isLoading) return <LoadingState message="Loading stop arrivals and timetable..." />;
  if (error || !stop) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <ErrorState
          title="Stop Not Found"
          message={`Unable to find stop details for "${stopId}".`}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Stops</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Stop Details & ETAs */}
        <div className="lg:col-span-5">
          <StopDetails
            stop={stop}
            onSelectRoute={(routeNumber) => navigate(`/routes/${routeNumber}`)}
          />
        </div>

        {/* Right Side: Map centered on stop */}
        <div className="lg:col-span-7 h-[500px] lg:h-[650px] rounded-3xl overflow-hidden shadow-lg border border-slate-200">
          <MapView
            selectedStop={stop}
            routeStops={[stop]}
          />
        </div>
      </div>
    </div>
  );
};

export default StopDetailsPage;
