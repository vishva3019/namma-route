import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useVehicleDetails } from '../hooks/useLiveVehicles';
import VehicleDetails from '../components/VehicleDetails';
import MapView from '../components/MapView';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export const TrackBus: React.FC = () => {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const navigate = useNavigate();
  const { data: vehicle, isLoading, error, refetch } = useVehicleDetails(vehicleId || null);

  if (isLoading) return <LoadingState message="Connecting to bus GPS telemetry..." />;
  if (error || !vehicle) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <ErrorState
          title="Vehicle Not Found"
          message={`Unable to locate active GPS feed for vehicle "${vehicleId}".`}
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
        <span>Back to Live Map</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <VehicleDetails
            vehicle={vehicle}
            onSelectRoute={(routeNumber) => navigate(`/routes/${routeNumber}`)}
          />
        </div>

        <div className="lg:col-span-7 h-[500px] lg:h-[650px] rounded-3xl overflow-hidden shadow-lg border border-slate-200">
          <MapView
            vehicles={[vehicle]}
            selectedVehicle={vehicle}
          />
        </div>
      </div>
    </div>
  );
};

export default TrackBus;
