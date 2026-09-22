import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings as SettingsIcon, ShieldCheck, Database, Radio, Info, ExternalLink } from 'lucide-react';
import { apiFetch } from '../services/api';

export const Settings: React.FC = () => {
  const { data: health, isLoading } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: () => apiFetch<any>('/health'),
    refetchInterval: 15000,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-slate-800">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">
          <SettingsIcon className="w-4 h-4" />
          <span>System & Data Attribution</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">System Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Provider diagnostics, transit license attributions, and legal disclaimers.
        </p>
      </div>

      {/* System Diagnostics Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Backend Health & Diagnostics</span>
        </h3>

        {isLoading ? (
          <p className="text-xs text-slate-400">Pinging backend services...</p>
        ) : health ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Database</span>
              <span className={`text-xs font-bold ${health.database === 'OK' ? 'text-emerald-700' : 'text-rose-600'}`}>
                ● {health.database}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Cache Layer</span>
              <span className="text-xs font-bold text-emerald-700">
                ● {health.cache}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Realtime Feed</span>
              <span className={`text-xs font-bold ${health.realtime === 'LIVE' ? 'text-emerald-700' : 'text-amber-600'}`}>
                ● {health.realtime}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Tracked Fleet</span>
              <span className="text-xs font-mono font-bold text-slate-900">
                {health.vehicles} Active
              </span>
            </div>
          </div>
        ) : null}

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Active Realtime Provider:</span>
          <span className="font-mono font-semibold text-slate-800">
            {health?.provider || 'BMTC Realtime Adapter'} {health?.demoMode ? '(DEMO MODE)' : ''}
          </span>
        </div>
      </div>

      {/* Data Sources Attribution */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-600" />
          <span>Data Sources & Open Database License (ODbL)</span>
        </h3>

        <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
          <p>
            <strong>BMTC Route & Timetable Data:</strong> Based on the open-source community General Transit Feed Specification (GTFS) dataset maintained by Vonter (
            <a
              href="https://github.com/Vonter/bmtc-gtfs"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 font-semibold underline inline-flex items-center gap-0.5"
            >
              github.com/Vonter/bmtc-gtfs <ExternalLink className="w-3 h-3" />
            </a>
            ) under the Open Database License (ODbL).
          </p>
          <p>
            <strong>Realtime Telemetry:</strong> Provided via the configurable BMTC realtime provider adapter configured for this deployment.
          </p>
          <p>
            <strong>Map Cartography:</strong> &copy;{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 underline font-semibold"
            >
              OpenStreetMap
            </a>{' '}
            contributors.
          </p>
        </div>
      </div>

      {/* Legal Disclaimers */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
          <Info className="w-4 h-4 text-amber-600" />
          <span>Legal Disclaimer & Non-Affiliation</span>
        </div>
        <p className="text-amber-800 leading-relaxed">
          <strong>NammaRoute is an independent civic technology project</strong> and is not affiliated with, endorsed by, or an official product of the Bangalore Metropolitan Transport Corporation (BMTC) or the Government of Karnataka.
        </p>
        <p className="text-amber-700/90 leading-relaxed">
          Transit schedules, live vehicle GPS positions, and ETA estimates are provided strictly for informational purposes. Traffic conditions, schedule revisions, and network connectivity may affect real-world bus arrivals.
        </p>
      </div>
    </div>
  );
};

export default Settings;
