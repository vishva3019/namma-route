import React from 'react';
import { formatFreshness } from '../utils/formatTime';

interface LiveStatusProps {
  status: 'LIVE' | 'DATA DELAYED' | 'TEMPORARILY UNAVAILABLE' | 'UNAVAILABLE' | string;
  dataAgeSeconds?: number;
  demoMode?: boolean;
  vehicleCount?: number;
}

export const LiveStatus: React.FC<LiveStatusProps> = ({
  status,
  dataAgeSeconds = 0,
  demoMode = false,
  vehicleCount,
}) => {
  let badgeColor = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  let dotColor = 'bg-emerald-500 animate-pulse';
  let label = vehicleCount !== undefined 
    ? `${vehicleCount} live BMTC vehicles` 
    : 'Live';

  if (status === 'UNAVAILABLE' || status === 'TEMPORARILY UNAVAILABLE') {
    badgeColor = 'bg-rose-500/10 text-rose-700 border-rose-500/20';
    dotColor = 'bg-rose-500';
    label = 'Live BMTC data temporarily unavailable';
  } else if (status === 'DATA DELAYED' || dataAgeSeconds > 120) {
    badgeColor = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    dotColor = 'bg-amber-500';
    label = `Live data delayed`;
  }

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-sm ${badgeColor}`}>
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="font-semibold">{label}</span>
        {status !== 'UNAVAILABLE' && status !== 'TEMPORARILY UNAVAILABLE' && (
          <span className="opacity-75 font-mono ml-1 text-[11px]">
            • Last updated: {formatFreshness(dataAgeSeconds)}
          </span>
        )}
      </div>

      {demoMode && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs" title="Simulated realtime positions along real BMTC routes">
          DEMO MODE
        </span>
      )}
    </div>
  );
};

export default LiveStatus;
