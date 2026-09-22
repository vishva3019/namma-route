import React, { useEffect, useRef, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Vehicle } from '../types/vehicle';
import BusPopup from './BusPopup';

interface BusMarkerProps {
  vehicle: Vehicle;
  isSelected?: boolean;
  onSelect?: (vehicle: Vehicle) => void;
  onTrackRoute?: (routeNumber: string) => void;
}

export const BusMarker: React.FC<BusMarkerProps> = ({
  vehicle,
  isSelected = false,
  onSelect,
  onTrackRoute,
}) => {
  // Coordinates state for smooth animation
  const [currentPos, setCurrentPos] = useState<[number, number]>([
    vehicle.latitude,
    vehicle.longitude,
  ]);
  const prevPosRef = useRef<[number, number]>([vehicle.latitude, vehicle.longitude]);
  const animationFrameRef = useRef<number | null>(null);

  // Smooth position interpolation between updates
  useEffect(() => {
    const startPos = prevPosRef.current;
    const targetPos: [number, number] = [vehicle.latitude, vehicle.longitude];

    // If coordinates haven't changed or it's stale, don't animate
    const distSq =
      Math.pow(targetPos[0] - startPos[0], 2) + Math.pow(targetPos[1] - startPos[1], 2);
    if (distSq < 0.0000001 || vehicle.status === 'STALE') {
      setCurrentPos(targetPos);
      prevPosRef.current = targetPos;
      return;
    }

    const duration = 2000; // 2 seconds smooth transition
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      const lat = startPos[0] + (targetPos[0] - startPos[0]) * ease;
      const lng = startPos[1] + (targetPos[1] - startPos[1]) * ease;

      setCurrentPos([lat, lng]);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevPosRef.current = targetPos;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [vehicle.latitude, vehicle.longitude, vehicle.status]);

  // Create custom SVG Leaflet DivIcon with memoization
  const isLive = vehicle.status === 'LIVE';
  const bearing = vehicle.bearing !== null && vehicle.bearing !== undefined ? vehicle.bearing : 0;

  const customIcon = React.useMemo(() => {
    let bgClass = isLive
      ? 'bg-emerald-600 text-white shadow-emerald-500/30'
      : 'bg-amber-600 text-white shadow-amber-500/30';

    if (isSelected) {
      bgClass = 'bg-indigo-600 text-white ring-4 ring-indigo-400/50 shadow-indigo-500/50 scale-110';
    }

    return L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center;">
          <div class="relative flex items-center justify-center w-9 h-9 rounded-full shadow-lg transition-transform ${bgClass}">
            <!-- Bearing Rotation Arrow -->
            <div style="transform: rotate(${bearing}deg); transition: transform 0.5s ease;" class="absolute inset-0 flex items-start justify-center pt-0.5">
              <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 22 22 12 17 2 22 12 2"></polygon>
              </svg>
            </div>
            <!-- Bus Icon -->
            <svg class="w-4 h-4 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 6v6"></path>
              <path d="M16 6v6"></path>
              <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"></path>
              <circle cx="7" cy="18" r="2"></circle>
              <circle cx="17" cy="18" r="2"></circle>
            </svg>
          </div>
          <!-- Route Label Pill -->
          <span class="mt-1 px-1.5 py-0.5 text-[10px] font-extrabold tracking-tight bg-slate-900/90 text-white rounded border border-slate-700 shadow-xs whitespace-nowrap">
            ${vehicle.routeNumber || 'BMTC'}
          </span>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 24],
      popupAnchor: [0, -26],
    });
  }, [vehicle.routeNumber, bearing, isLive, isSelected]);

  return (
    <Marker
      position={currentPos}
      icon={customIcon}
      eventHandlers={{
        click: () => onSelect && onSelect(vehicle),
      }}
    >
      <Popup className="custom-leaflet-popup" closeButton={false}>
        <BusPopup
          vehicle={vehicle}
          onTrackRoute={onTrackRoute}
        />
      </Popup>
    </Marker>
  );
};

export default React.memo(BusMarker);
