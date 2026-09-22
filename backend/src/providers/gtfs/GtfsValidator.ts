import { GtfsRoute, GtfsStop, GtfsTrip, GtfsStopTime } from './GtfsParser';

export class GtfsValidator {
  // Bengaluru bounding box
  static readonly BENGALURU_BBOX = {
    minLat: 12.60,
    maxLat: 13.40,
    minLng: 77.20,
    maxLng: 77.95,
  };

  /**
   * Validate if latitude and longitude are valid and within Bengaluru
   */
  static isValidCoordinate(lat: number, lng: number): boolean {
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return (
      lat >= this.BENGALURU_BBOX.minLat &&
      lat <= this.BENGALURU_BBOX.maxLat &&
      lng >= this.BENGALURU_BBOX.minLng &&
      lng <= this.BENGALURU_BBOX.maxLng
    );
  }

  /**
   * Validate stop
   */
  static validateStop(stop: GtfsStop): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!stop.stop_id) errors.push('Missing stop_id');
    if (!stop.stop_name) errors.push('Missing stop_name');

    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);

    if (isNaN(lat) || isNaN(lon)) {
      errors.push(`Invalid coordinates: ${stop.stop_lat}, ${stop.stop_lon}`);
    } else if (!this.isValidCoordinate(lat, lon)) {
      errors.push(`Coordinates outside Bengaluru metro region: [${lat}, ${lon}]`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate route
   */
  static validateRoute(route: GtfsRoute): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!route.route_id) errors.push('Missing route_id');
    if (!route.route_short_name && !route.route_long_name) {
      errors.push('Missing both route_short_name and route_long_name');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate trip
   */
  static validateTrip(trip: GtfsTrip, validRouteIds: Set<string>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!trip.trip_id) errors.push('Missing trip_id');
    if (!trip.route_id) errors.push('Missing route_id');
    if (!validRouteIds.has(trip.route_id)) {
      errors.push(`Referenced route_id not found: ${trip.route_id}`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate stop time
   */
  static validateStopTime(
    st: GtfsStopTime,
    validTripIds: Set<string>,
    validStopIds: Set<string>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!st.trip_id) errors.push('Missing trip_id');
    if (!st.stop_id) errors.push('Missing stop_id');
    if (!validTripIds.has(st.trip_id)) errors.push(`Trip ${st.trip_id} not found`);
    if (!validStopIds.has(st.stop_id)) errors.push(`Stop ${st.stop_id} not found`);
    if (isNaN(parseInt(st.stop_sequence))) errors.push(`Invalid stop_sequence: ${st.stop_sequence}`);
    return { valid: errors.length === 0, errors };
  }
}
