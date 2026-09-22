import { NormalizedVehicle, VehicleStatus } from './RealtimeProvider';

export class BmtcNormalizer {
  /**
   * Bengaluru bounding box according to specification:
   * Latitude: 12.60 to 13.40
   * Longitude: 77.20 to 77.95
   */
  static readonly BENGALURU_BBOX = {
    minLat: 12.60,
    maxLat: 13.40,
    minLon: 77.20,
    maxLon: 77.95,
  };

  /**
   * Verify coordinate falls inside the Bengaluru transit service area
   */
  static isWithinBengaluruBounds(lat: number, lon: number): boolean {
    if (typeof lat !== 'number' || typeof lon !== 'number') return false;
    if (isNaN(lat) || isNaN(lon)) return false;
    return (
      lat >= this.BENGALURU_BBOX.minLat &&
      lat <= this.BENGALURU_BBOX.maxLat &&
      lon >= this.BENGALURU_BBOX.minLon &&
      lon <= this.BENGALURU_BBOX.maxLon
    );
  }

  /**
   * Parse timestamp string (handles ISO strings, BMTC's DD-MM-YYYY HH:mm:ss, YYYY-MM-DD, or Unix epoch)
   */
  static parseTimestamp(timeVal?: any): Date {
    if (timeVal === undefined || timeVal === null || timeVal === '') return new Date();

    if (timeVal instanceof Date) {
      return isNaN(timeVal.getTime()) ? new Date() : timeVal;
    }

    // Unix epoch numeric (ms or seconds)
    if (typeof timeVal === 'number') {
      const ms = timeVal < 10000000000 ? timeVal * 1000 : timeVal;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? new Date() : d;
    }

    const timeStr = String(timeVal).trim();

    // Unix epoch numeric string
    if (/^\d{10,13}$/.test(timeStr)) {
      const num = parseInt(timeStr, 10);
      const ms = timeStr.length === 10 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? new Date() : d;
    }

    // Standard ISO 8601 with 'T' (e.g. 2026-09-22T14:30:00.000Z)
    if (timeStr.includes('T') || timeStr.endsWith('Z')) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) return d;
    }

    // Check for DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
    const ddmmyyyy = /^(\d{2})[-/](\d{2})[-/](\d{4})(?:[\sT]+(\d{2}):(\d{2}):(\d{2}))?/;
    const match = timeStr.match(ddmmyyyy);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const hours = match[4] ? parseInt(match[4], 10) : 0;
      const minutes = match[5] ? parseInt(match[5], 10) : 0;
      const seconds = match[6] ? parseInt(match[6], 10) : 0;
      const d = new Date(year, month, day, hours, minutes, seconds);
      return isNaN(d.getTime()) ? new Date() : d;
    }

    // Check for YYYY-MM-DD HH:mm:ss
    const yyyymmdd = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[\sT]+(\d{2}):(\d{2}):(\d{2}))?/;
    const matchY = timeStr.match(yyyymmdd);
    if (matchY) {
      const year = parseInt(matchY[1], 10);
      const month = parseInt(matchY[2], 10) - 1;
      const day = parseInt(matchY[3], 10);
      const hours = matchY[4] ? parseInt(matchY[4], 10) : 0;
      const minutes = matchY[5] ? parseInt(matchY[5], 10) : 0;
      const seconds = matchY[6] ? parseInt(matchY[6], 10) : 0;
      const d = new Date(year, month, day, hours, minutes, seconds);
      return isNaN(d.getTime()) ? new Date() : d;
    }

    const parsed = new Date(timeStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Calculate freshness in seconds
   */
  static getFreshnessSeconds(timestampDate: Date): number {
    const now = Date.now();
    const diffMs = Math.max(0, now - timestampDate.getTime());
    return Math.floor(diffMs / 1000);
  }

  /**
   * Determine status based on freshness:
   * 0-60s -> LIVE
   * 60-120s -> RECENT
   * 120-300s -> STALE
   */
  static determineStatus(freshnessSeconds: number): VehicleStatus {
    if (freshnessSeconds <= 60) return 'LIVE';
    if (freshnessSeconds <= 120) return 'RECENT';
    return 'STALE';
  }

  /**
   * Normalize vehicle data from SearchByRouteDetails_v4 mapData/vehicleDetails
   */
  static normalizeRouteVehicle(
    raw: any,
    routeId?: string,
    routeNumber?: string,
    destination?: string
  ): NormalizedVehicle | null {
    if (!raw) return null;

    const lat = parseFloat(raw.centerlat ?? raw.latitude);
    const lon = parseFloat(raw.centerlong ?? raw.longitude);

    if (isNaN(lat) || isNaN(lon) || !this.isWithinBengaluruBounds(lat, lon)) {
      return null;
    }

    const timestampDate = this.parseTimestamp(raw.lastrefreshon ?? raw.lastupdatedat ?? raw.timestamp);
    const freshnessSeconds = this.getFreshnessSeconds(timestampDate);

    // If data is older than 5 minutes (300s), hide from live map
    if (freshnessSeconds > 300) {
      return null;
    }

    // Vehicle ID must be present in raw payload; never fabricate random IDs
    const rawId = raw.vehicleid || raw.vehicleno || raw.id || raw.vehicleId;
    if (!rawId) {
      return null;
    }
    const vehicleId = String(rawId).trim();

    const vehicleNumber = raw.vehiclenumber || raw.vehicleregno || raw.busno || null;
    const rawHeading = raw.heading ?? raw.bearing;
    const bearing = rawHeading !== undefined && rawHeading !== null && rawHeading !== '' ? parseFloat(rawHeading) : null;
    const rawSpeed = raw.speed ?? raw.velocity;
    const speed = rawSpeed !== undefined && rawSpeed !== null && rawSpeed !== '' ? parseFloat(rawSpeed) : null;

    return {
      id: vehicleId,
      vehicleNumber: vehicleNumber ? String(vehicleNumber).trim() : null,
      routeId: routeId || (raw.routeid ? String(raw.routeid) : null),
      routeNumber: routeNumber || raw.routeno || null,
      tripId: raw.tripid ? String(raw.tripid) : null,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      bearing: bearing !== null && !isNaN(bearing) ? Math.round(bearing) : null,
      speed: speed !== null && !isNaN(speed) ? Math.max(0, Math.round(speed)) : null,
      currentStopId: raw.currentlocationid ? String(raw.currentlocationid) : raw.currentstop ? String(raw.currentstop) : null,
      nextStopId: raw.nextlocationid ? String(raw.nextlocationid) : raw.nextstop ? String(raw.nextstop) : null,
      timestamp: timestampDate.toISOString(),
      freshnessSeconds,
      status: this.determineStatus(freshnessSeconds),
      source: 'BMTC',
      etaToNextStop: raw.eta || null,
      destination: destination || raw.destination || null,
    };
  }

  /**
   * Normalize vehicle data from VehicleTripDetails_v2 LiveLocation
   */
  static normalizeTripLiveLocation(raw: any): NormalizedVehicle | null {
    if (!raw) return null;

    const lat = parseFloat(raw.latitude ?? raw.currlatitude);
    const lon = parseFloat(raw.longitude ?? raw.currlongitude);

    if (isNaN(lat) || isNaN(lon) || !this.isWithinBengaluruBounds(lat, lon)) {
      return null;
    }

    const timestampDate = this.parseTimestamp(raw.lastrefreshon ?? raw.lastupdatedat ?? raw.timestamp);
    const freshnessSeconds = this.getFreshnessSeconds(timestampDate);

    if (freshnessSeconds > 300) {
      return null;
    }

    const rawId = raw.vehicleid || raw.vehicleregno || raw.vehicleId || raw.id;
    if (!rawId) {
      return null;
    }
    const vehicleId = String(rawId).trim();

    const vehicleNumber = raw.vehiclenumber || raw.vehicleregno || raw.busno || null;
    const rawHeading = raw.heading ?? raw.bearing;
    const bearing = rawHeading !== undefined && rawHeading !== null && rawHeading !== '' ? parseFloat(rawHeading) : null;
    const rawSpeed = raw.speed ?? raw.velocity;
    const speed = rawSpeed !== undefined && rawSpeed !== null && rawSpeed !== '' ? parseFloat(rawSpeed) : null;

    return {
      id: vehicleId,
      vehicleNumber: vehicleNumber ? String(vehicleNumber).trim() : null,
      routeId: raw.routeid ? String(raw.routeid) : null,
      routeNumber: raw.routeno || null,
      tripId: raw.tripid ? String(raw.tripid) : null,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      bearing: bearing !== null && !isNaN(bearing) ? Math.round(bearing) : null,
      speed: speed !== null && !isNaN(speed) ? Math.max(0, Math.round(speed)) : null,
      currentStopId: raw.previousstop ? String(raw.previousstop) : raw.currentstop ? String(raw.currentstop) : null,
      nextStopId: raw.nextstop ? String(raw.nextstop) : null,
      timestamp: timestampDate.toISOString(),
      freshnessSeconds,
      status: this.determineStatus(freshnessSeconds),
      source: 'BMTC',
      etaToNextStop: raw.eta || null,
      destination: raw.destinationstation || null,
    };
  }
}

