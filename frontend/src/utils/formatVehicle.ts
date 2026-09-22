export function formatBearingDirection(deg?: number | null): string {
  if (deg === undefined || deg === null) return '';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index];
}

export function formatBusNumber(num?: string | null): string {
  if (!num) return 'BMTC BUS';
  return num.toUpperCase();
}
