import { useState, useEffect } from 'react';

export interface GeoLocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  isFallback: boolean;
}

// Bengaluru City Center coordinates fallback
const BENGALURU_FALLBACK = {
  latitude: 12.9716,
  longitude: 77.5946,
};

export function useGeolocation() {
  const [state, setState] = useState<GeoLocationState>({
    latitude: BENGALURU_FALLBACK.latitude,
    longitude: BENGALURU_FALLBACK.longitude,
    accuracy: null,
    loading: true,
    error: null,
    isFallback: true,
  });

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by your browser',
        isFallback: true,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          loading: false,
          error: null,
          isFallback: false,
        });
      },
      (err) => {
        setState({
          latitude: BENGALURU_FALLBACK.latitude,
          longitude: BENGALURU_FALLBACK.longitude,
          accuracy: null,
          loading: false,
          error: err.message || 'Unable to retrieve location',
          isFallback: true,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return { ...state, refreshLocation: requestLocation };
}
