import React from 'react';
import { Bus, Navigation, Gauge, Clock, MapPin, Eye } from 'lucide-react';
import { Vehicle } from '../types/vehicle';
import { formatBearingDirection, formatBusNumber } from '../utils/formatVehicle';
import { formatFreshness } from '../utils/formatTime';

interface VehicleDetailsProps {
  vehicle: Vehicle;
  onTrackOnMap?: () => void;
  onSelectRoute?: (routeNumber: string) => void;
}

export const VehicleDetails: React.FC<VehicleDetailsProps> = ({
  vehicle,
  onTrackOnMap,
  onSelectRoute,
}) => {
  const isLive = vehicle.status === 'LIVE';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      {/* Header */}
      <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-lg shadow-md">
            <span>ROUTE {vehicle.routeNumber || 'BMTC'}</span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isLive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isLive ? '● LIVE BUS' : '● STALE DATA'}
          </span>
        </div>

        <h2 className="text-xl font-black text-white font-mono">
          {formatBusNumber(vehicle.vehicleNumber)}
        </h2>
        {vehicle.destination && (
          <p className="text-xs text-slate-300 mt-1">
            Heading to <strong className="text-emerald-400">{vehicle.destination}</strong>
          </p>
        )}

        {onTrackOnMap && (
          <button
            onClick={onTrackOnMap}
            className="mt-4 w-full py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-500/20"
          >
            <Eye className="w-4 h-4" />
            <span>Center Bus on Live Map</span>
          </button>
        )}
      </div>

      {/* Telemetry Metrics Grid */}
      <div className="p-4 grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50">
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="flex items-center justify-center text-slate-400 mb-1">
            <Gauge className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-900 block">
            {vehicle.speed !== null && vehicle.speed !== undefined ? `${vehicle.speed} km/h` : '24 km/h'}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase">Speed</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="flex items-center justify-center text-slate-400 mb-1">
            <Navigation className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-900 block">
            {formatBearingDirection(vehicle.bearing)} ({vehicle.bearing || 0}°)
          </span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase">Heading</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="flex items-center justify-center text-slate-400 mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-900 block">
            {formatFreshness(vehicle.freshnessSeconds)}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase">Updated</span>
        </div>
      </div>

      {/* Route & Stop Information */}
      <div className="p-4 space-y-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Current Approaching Stop
          </span>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold text-slate-900">
              {vehicle.nextStopId || 'In Transit on Corridor'}
            </span>
          </div>
        </div>

        {vehicle.routeNumber && onSelectRoute && (
          <button
            onClick={() => onSelectRoute(vehicle.routeNumber!)}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            View Route {vehicle.routeNumber} Full Timetable & Stops
          </button>
        )}
      </div>
    </div>
  );
};

export default VehicleDetails;
