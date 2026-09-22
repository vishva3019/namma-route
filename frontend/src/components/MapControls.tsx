import React from 'react';
import { Crosshair, Plus, Minus, RotateCcw, Bus, MapPin, Route as RouteIcon } from 'lucide-react';

interface MapControlsProps {
  onLocateMe: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  showBuses: boolean;
  onToggleBuses: () => void;
  showStops: boolean;
  onToggleStops: () => void;
  showRouteLines: boolean;
  onToggleRouteLines: () => void;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onLocateMe,
  onZoomIn,
  onZoomOut,
  onRecenter,
  showBuses,
  onToggleBuses,
  showStops,
  onToggleStops,
  showRouteLines,
  onToggleRouteLines,
}) => {
  return (
    <div className="flex flex-col gap-2">
      {/* Zoom Controls */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/80 p-1 flex flex-col gap-1">
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 active:bg-slate-200 transition-colors"
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 active:bg-slate-200 transition-colors"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Position Controls */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/80 p-1 flex flex-col gap-1">
        <button
          onClick={onLocateMe}
          title="Locate my position"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-emerald-600 active:bg-slate-200 transition-colors"
          aria-label="Locate me"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={onRecenter}
          title="Recenter to Bengaluru"
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 active:bg-slate-200 transition-colors"
          aria-label="Recenter to Bengaluru"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Visibility Toggles */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/80 p-1 flex flex-col gap-1">
        <button
          onClick={onToggleBuses}
          title="Toggle live buses"
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            showBuses ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400 hover:bg-slate-100'
          }`}
          aria-label="Toggle live buses"
        >
          <Bus className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleStops}
          title="Toggle bus stops"
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            showStops ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400 hover:bg-slate-100'
          }`}
          aria-label="Toggle bus stops"
        >
          <MapPin className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleRouteLines}
          title="Toggle route line paths"
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            showRouteLines ? 'bg-blue-100 text-blue-800' : 'text-slate-400 hover:bg-slate-100'
          }`}
          aria-label="Toggle route lines"
        >
          <RouteIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MapControls;
