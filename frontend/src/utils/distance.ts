export function formatDistance(meters?: number | null): string {
  if (meters === undefined || meters === null) return '--';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatWalkingTime(meters?: number | null): string {
  if (meters === undefined || meters === null) return '--';
  const minutes = Math.max(1, Math.round(meters / 80)); // 80 m/min ~ 4.8 km/h
  return `${minutes} min walk`;
}
