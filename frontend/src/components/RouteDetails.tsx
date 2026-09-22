import React, { useState, useEffect } from 'react';
import { Bus, ArrowRight, MapPin, Eye, RefreshCw } from 'lucide-react';
import { RouteDetails as RouteDetailsType, RouteStop, RouteTimetableItem } from '../types/route';
import { routesApi } from '../services/routesApi';
import { formatClockTime } from '../utils/formatTime';

interface RouteDetailsProps {
  route: RouteDetailsType;
  selectedDirection?: number;
  onDirectionChange?: (dir: number) => void;
  onSelectStop?: (stop: any) => void;
  onTrackOnMap?: () => void;
}

export const RouteDetails: React.FC<RouteDetailsProps> = ({
  route,
  selectedDirection = 0,
  onDirectionChange,
  onSelectStop,
  onTrackOnMap,
}) => {
  const [activeTab, setActiveTab] = useState<'stops' | 'timetable' | 'buses'>('stops');
  const [currentDirection, setCurrentDirection] = useState<number>(selectedDirection);
  const [directionStops, setDirectionStops] = useState<RouteStop[]>(route.stops);
  const [timetable, setTimetable] = useState<RouteTimetableItem[]>([]);
  const [isLoadingStops, setIsLoadingStops] = useState<boolean>(false);
  const [isLoadingTimetable, setIsLoadingTimetable] = useState<boolean>(false);
  const [timetableFilter, setTimetableFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');

  // Live Bus Tracking & Current Stop State
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [currentStopId, setCurrentStopId] = useState<string | null>(null);
  const [currentStopSequence, setCurrentStopSequence] = useState<number | null>(null);

  const currentStopRef = React.useRef<HTMLDivElement | null>(null);
  const lastScrolledSequenceRef = React.useRef<number | null>(null);

  // Active selected live bus
  const activeLiveBus = React.useMemo(() => {
    if (!route.liveBuses || route.liveBuses.length === 0) return null;
    if (selectedBusId) {
      const found = route.liveBuses.find((b) => b.id === selectedBusId);
      if (found) return found;
    }
    return route.liveBuses[0];
  }, [route.liveBuses, selectedBusId]);

  // Update currentStopId and currentStopSequence whenever active live bus updates
  useEffect(() => {
    if (activeLiveBus) {
      if (activeLiveBus.currentStop) {
        setCurrentStopId(activeLiveBus.currentStop.stopId);
        setCurrentStopSequence(activeLiveBus.currentStop.sequence);
      } else if (activeLiveBus.nextStop) {
        setCurrentStopId(activeLiveBus.nextStop.stopId);
        setCurrentStopSequence(activeLiveBus.nextStop.sequence);
      } else {
        setCurrentStopId(null);
        setCurrentStopSequence(null);
      }
    } else {
      setCurrentStopId(null);
      setCurrentStopSequence(null);
    }
  }, [
    activeLiveBus?.id,
    activeLiveBus?.currentStop?.sequence,
    activeLiveBus?.nextStop?.sequence,
    activeLiveBus?.stopStatus,
  ]);

  // Auto-scroll when current stop sequence changes
  useEffect(() => {
    if (
      currentStopSequence !== null &&
      currentStopSequence !== lastScrolledSequenceRef.current
    ) {
      lastScrolledSequenceRef.current = currentStopSequence;
      if (currentStopRef.current) {
        currentStopRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentStopSequence]);

  const directions = route.directions || [
    {
      direction: 0,
      directionName: `${route.origin} → ${route.destination}`,
      originName: route.origin,
      destinationName: route.destination,
      stopCount: route.stops.length,
      geometry: route.geometry,
    },
  ];

  // When direction changes, fetch directional stops
  const handleDirectionSwitch = async (dir: number) => {
    if (dir === currentDirection) return;
    setCurrentDirection(dir);
    if (onDirectionChange) onDirectionChange(dir);

    setIsLoadingStops(true);
    try {
      const stops = await routesApi.getRouteStops(route.routeNumber || route.id, dir);
      setDirectionStops(stops);
    } catch {
      // Fallback
    } finally {
      setIsLoadingStops(false);
    }

    if (activeTab === 'timetable') {
      fetchTimetable(dir);
    }
  };

  const fetchTimetable = async (dir: number) => {
    setIsLoadingTimetable(true);
    try {
      const data = await routesApi.getRouteTimetable(route.routeNumber || route.id, dir);
      setTimetable(data);
    } catch {
      setTimetable([]);
    } finally {
      setIsLoadingTimetable(false);
    }
  };

  // Fetch timetable on direction switch or mount
  useEffect(() => {
    fetchTimetable(currentDirection);
  }, [currentDirection, route.routeNumber, route.id]);

  // Timetable filter
  const filteredTimetable = timetable.filter((item) => {
    if (timetableFilter === 'all') return true;
    if (!item.departureTime) return true;
    const hour = parseInt(item.departureTime.split(':')[0], 10);
    if (timetableFilter === 'morning') return hour >= 5 && hour < 12;
    if (timetableFilter === 'afternoon') return hour >= 12 && hour < 17;
    if (timetableFilter === 'evening') return hour >= 17 && hour <= 23;
    return true;
  });

  const activeDirectionInfo = directions.find((d) => d.direction === currentDirection) || directions[0];
  const currentOrigin = activeDirectionInfo?.originName || route.origin;
  const currentDestination = activeDirectionInfo?.destinationName || route.destination;

  // Intermediate landmark highlights
  const intermediateHighlights = React.useMemo(() => {
    if (directionStops.length <= 2) return [];
    const middleStops = directionStops.slice(1, -1);
    const keywords = [
      'electronic city', 'silk board', 'st. john', 'dairy circle', 'madiwala',
      'bommasandra', 'hebbal', 'banashankari', 'jayanagar', 'koramangala',
      'marathahalli', 'whitefield', 'tin factory', 'yeshwanthpur', 'chandapura', 'anekal'
    ];

    const matched = middleStops.filter((s) =>
      keywords.some((kw) => s.name.toLowerCase().includes(kw))
    );

    const distinct: RouteStop[] = [];
    matched.forEach((s) => {
      const base = s.name.toLowerCase().replace(/toll gate|gate|bus stop|phase [12]|depot/g, '').trim();
      if (!distinct.some((d) => d.name.toLowerCase().includes(base) || base.includes(d.name.toLowerCase().slice(0, 8)))) {
        distinct.push(s);
      }
    });

    if (distinct.length === 0 && middleStops.length > 0) {
      return [middleStops[Math.floor(middleStops.length / 2)]];
    }
    return distinct.slice(0, 3);
  }, [directionStops]);

  // Departure schedule range
  const scheduleSummary = React.useMemo(() => {
    if (!timetable || timetable.length === 0) return null;
    const validTimes = timetable
      .map((t) => t.departureTime)
      .filter((t): t is string => Boolean(t))
      .sort();
    if (validTimes.length === 0) return null;
    return {
      first: formatClockTime(validTimes[0]),
      last: formatClockTime(validTimes[validTimes.length - 1]),
      count: timetable.length,
    };
  }, [timetable]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800">
      {/* Route Header Card */}
      <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-lg shadow-md">
              {route.routeNumber}
            </span>
            {route.routeFamily && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700">
                Family: {route.routeFamily}
              </span>
            )}
            {route.serviceType && (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-400 text-[10px] font-bold border border-emerald-800 uppercase tracking-wider">
                {route.serviceType.replace('_', ' ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {route.activeBusesCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {route.activeBusesCount} active buses
              </span>
            ) : (
              <span className="text-xs text-slate-400">0 active buses</span>
            )}
          </div>
        </div>

        <h2 className="text-base font-bold flex items-center gap-2 text-white">
          <span>{currentOrigin}</span>
          <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{currentDestination}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">{route.routeName}</p>

        {/* Direction Switcher Tabs */}
        {directions.length > 1 && (
          <div className="mt-4 p-1 rounded-xl bg-slate-800/80 border border-slate-700 flex gap-1">
            {directions.map((d) => (
              <button
                key={d.direction}
                onClick={() => handleDirectionSwitch(d.direction)}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-center transition-all truncate flex items-center justify-center gap-1.5 ${
                  currentDirection === d.direction
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title={d.directionName}
              >
                <span className="truncate">{d.directionName}</span>
                <span className="text-[10px] opacity-80">({d.stopCount})</span>
              </button>
            ))}
          </div>
        )}

        {/* Corridor Preview Bar */}
        <div className="mt-3.5 p-3 rounded-xl bg-slate-800/70 border border-slate-700 text-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
            <span className="font-bold uppercase tracking-wider text-emerald-400">Corridor Progression Preview</span>
            <span className="font-semibold text-slate-300">{directionStops.length} Stops Total</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap font-medium text-slate-200">
            <span className="text-emerald-400 font-bold">{currentOrigin}</span>
            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
            {intermediateHighlights.map((stop, idx) => (
              <React.Fragment key={stop.id || idx}>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 font-semibold text-[11px] border border-emerald-800/80">
                  {stop.name}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
              </React.Fragment>
            ))}
            <span className="text-emerald-400 font-bold">{currentDestination}</span>
          </div>

          {scheduleSummary && (
            <div className="mt-2.5 pt-2 border-t border-slate-700/70 flex items-center justify-between text-[11px] text-slate-300">
              <span>Scheduled departures: <strong className="text-white">{scheduleSummary.first}</strong> – <strong className="text-white">{scheduleSummary.last}</strong></span>
              <span className="text-slate-400 text-[10px]">({scheduleSummary.count} daily departures)</span>
            </div>
          )}
        </div>

        {onTrackOnMap && (
          <button
            onClick={onTrackOnMap}
            className="mt-4 w-full py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-500/20"
          >
            <Eye className="w-4 h-4" />
            <span>Track Live on Map</span>
          </button>
        )}
      </div>

      {/* Primary Content Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-50">
        <button
          onClick={() => setActiveTab('stops')}
          className={`flex-1 py-3 text-center transition-colors border-b-2 ${
            activeTab === 'stops'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Ordered Stops ({directionStops.length})
        </button>
        <button
          onClick={() => setActiveTab('buses')}
          className={`flex-1 py-3 text-center transition-colors border-b-2 ${
            activeTab === 'buses'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Live Buses ({route.liveBuses.length})
        </button>
        <button
          onClick={() => setActiveTab('timetable')}
          className={`flex-1 py-3 text-center transition-colors border-b-2 ${
            activeTab === 'timetable'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Timetable
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 max-h-[440px] overflow-y-auto">
        {/* ORDERED STOPS TIMELINE TAB */}
        {activeTab === 'stops' && (
          <div>
            {/* Multi-Bus Selector Pill Bar if Live Buses Exist */}
            {route.liveBuses && route.liveBuses.length > 0 && (
              <div className="mb-3.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center justify-between text-[11px] mb-1.5 font-bold text-slate-700">
                  <span className="flex items-center gap-1.5 text-slate-900">
                    <Bus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Live Buses on Route ({route.liveBuses.length})</span>
                  </span>
                  {route.liveBuses.length > 1 && (
                    <span className="text-slate-400 text-[10px] font-normal">Select a bus to track</span>
                  )}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {route.liveBuses.map((bus) => {
                    const isSelected = activeLiveBus?.id === bus.id;
                    const currentLoc = bus.currentStop?.stopName || bus.nextStop?.stopName || bus.nextStopId || 'In Transit';
                    return (
                      <button
                        key={bus.id}
                        onClick={() => setSelectedBusId(bus.id)}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-mono font-bold">{bus.vehicleNumber || `#${bus.id}`}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
                          ({bus.stopStatus === 'AT_STOP' ? `At: ${currentLoc}` : `Next: ${currentLoc}`})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isLoadingStops ? (
              <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Loading stop sequence...</span>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-slate-200" />
                {directionStops.map((stop, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === directionStops.length - 1;
                  const isCurrent = currentStopSequence !== null && stop.sequence === currentStopSequence;
                  const isPassed = currentStopSequence !== null && stop.sequence < currentStopSequence;

                  return (
                    <div
                      key={`${stop.id}-${stop.sequence}`}
                      ref={isCurrent ? currentStopRef : null}
                      onClick={() => onSelectStop && onSelectStop(stop)}
                      className={`relative group cursor-pointer transition-colors p-1 rounded-lg ${
                        isCurrent ? 'bg-emerald-50/70 border border-emerald-200/80 -ml-1 pl-2' : ''
                      }`}
                    >
                      <div
                        className={`absolute rounded-full border-2 transition-transform group-hover:scale-125 ${
                          isCurrent
                            ? 'w-4 h-4 -left-6 top-1.5 bg-emerald-500 border-white ring-4 ring-emerald-400/50 shadow-md shadow-emerald-500/30 animate-pulse'
                            : isPassed
                            ? 'w-3.5 h-3.5 -left-6 top-1 bg-slate-300 border-white ring-1 ring-slate-300'
                            : isFirst
                            ? 'w-3.5 h-3.5 -left-6 top-1 bg-emerald-500 border-white ring-2 ring-emerald-500'
                            : isLast
                            ? 'w-3.5 h-3.5 -left-6 top-1 bg-rose-500 border-white ring-2 ring-rose-500'
                            : 'w-3.5 h-3.5 -left-6 top-1 bg-white border-slate-400 group-hover:border-emerald-600'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                            isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            #{stop.sequence}
                          </span>
                          <h4 className={`text-xs font-bold transition-colors ${
                            isCurrent ? 'text-emerald-950 font-black' : isPassed ? 'text-slate-500' : 'text-slate-900 group-hover:text-emerald-700'
                          }`}>
                            {stop.name}
                          </h4>

                          {/* Real-time progression tags */}
                          {isCurrent && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                              <Bus className="w-3 h-3" />
                              {activeLiveBus?.stopStatus === 'AT_STOP' ? (
                                <span>CURRENT BUS</span>
                              ) : activeLiveBus?.stopStatus === 'APPROACHING_STOP' ? (
                                <span>APPROACHING BUS (~{activeLiveBus.nextStop?.distanceMeters || 85}m)</span>
                              ) : (
                                <span>NEXT STOP</span>
                              )}
                            </span>
                          )}

                          {isPassed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                              ✓ COMPLETED
                            </span>
                          )}

                          {!isPassed && !isCurrent && currentStopSequence !== null && (
                            <span className="text-[9px] font-semibold text-slate-400">
                              UPCOMING
                            </span>
                          )}

                          {stop.name.toLowerCase().includes('electronic city') && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-tight">
                              Major Hub
                            </span>
                          )}
                        </div>
                        {stop.nameKannada && (
                          <p className="text-[11px] text-slate-400 pl-6">{stop.nameKannada}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LIVE BUSES TAB */}
        {activeTab === 'buses' && (
          <div className="space-y-2.5">
            {route.liveBuses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No vehicles currently transmitting live positions for this route.
              </p>
            ) : (
              route.liveBuses.map((bus) => (
                <div
                  key={bus.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <Bus className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        {bus.vehicleNumber || bus.id}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Speed: {bus.speed || 20} km/h • Heading {bus.bearing || 0}°
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    ● LIVE
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* TIMETABLE TAB */}
        {activeTab === 'timetable' && (
          <div>
            <div className="flex gap-1.5 mb-4 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              {(['all', 'morning', 'afternoon', 'evening'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimetableFilter(period)}
                  className={`flex-1 py-1.5 capitalize rounded-lg transition-all ${
                    timetableFilter === period
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {isLoadingTimetable ? (
              <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Loading timetable trips...</span>
              </div>
            ) : filteredTimetable.length > 0 ? (
              <div className="space-y-2">
                {filteredTimetable.map((trip, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block font-mono">
                        Trip #{idx + 1}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {trip.originStop || 'Origin'} → {trip.destinationStop || 'Destination'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono text-emerald-700 block">
                        {formatClockTime(trip.departureTime || '')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Arr: {formatClockTime(trip.arrivalTime || '')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No scheduled trips found for this direction and time band.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteDetails;
