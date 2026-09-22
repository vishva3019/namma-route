import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bus, MapPin, Compass, Navigation, Settings, Search } from 'lucide-react';
import LiveStatus from './LiveStatus';
import { useLiveVehicles } from '../hooks/useLiveVehicles';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { data: realtime } = useLiveVehicles();

  const navItems = [
    { label: 'Live Map', path: '/', icon: Bus },
    { label: 'Routes', path: '/routes', icon: Compass },
    { label: 'Stops', path: '/stops', icon: MapPin },
    { label: 'Nearby', path: '/nearby', icon: Navigation },
    { label: 'Plan Journey', path: '/journey', icon: Search },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Slogan */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Bus className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">NammaRoute</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-700">
                  BMTC Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Track Bengaluru. Catch the right bus.</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 shadow-xs border border-slate-700'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Live Status Pill */}
          <div className="flex items-center gap-3">
            {realtime && (
              <LiveStatus
                status={realtime.status}
                dataAgeSeconds={realtime.dataAge}
                demoMode={realtime.demoMode}
                vehicleCount={realtime.vehicleCount}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
