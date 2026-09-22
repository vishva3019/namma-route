export function formatFreshness(seconds: number): string {
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (mins < 60) {
    return remSec > 0 ? `${mins}m ${remSec}s ago` : `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function formatEta(minutes: number): string {
  if (minutes <= 0) return 'Arriving now';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

export function formatClockTime(isoOrTime: string): string {
  if (!isoOrTime) return '--:--';
  if (isoOrTime.includes(':') && isoOrTime.length <= 8) {
    return isoOrTime.substring(0, 5);
  }
  try {
    const d = new Date(isoOrTime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoOrTime;
  }
}
