export interface Coordinate {
  latitude: number;
  longitude: number;
}

export class GeoUtils {
  /**
   * Earth's mean radius in meters
   */
  private static readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Calculate Haversine distance between two coordinates in meters
   */
  static haversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_METERS * c;
  }

  /**
   * Calculate distance in kilometers
   */
  static distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return this.haversineDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
  }

  /**
   * Calculate initial compass bearing from point 1 to point 2 (0 - 360 degrees)
   */
  static calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const phi1 = this.toRadians(lat1);
    const phi2 = this.toRadians(lat2);
    const deltaLambda = this.toRadians(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const theta = Math.atan2(y, x);
    return (this.toDegrees(theta) + 360) % 360;
  }

  /**
   * Estimate walking time in minutes for a distance in meters
   * Standard walking speed ~ 4.8 km/h = 80 meters/min
   */
  static estimateWalkingMinutes(distanceMeters: number): number {
    return Math.max(1, Math.round(distanceMeters / 80));
  }

  /**
   * Estimate bus travel time in minutes based on distance and average Bengaluru corridor speed
   * Average speed ~ 20 km/h = ~333 meters/min with dwell times
   */
  static estimateBusTransitMinutes(distanceMeters: number, intermediateStopsCount: number = 0): number {
    const travelTimeMin = distanceMeters / (20 * 1000 / 60); // 20 km/h
    const dwellTimeMin = intermediateStopsCount * 0.75; // 45 seconds per stop dwell
    return Math.max(1, Math.round(travelTimeMin + dwellTimeMin));
  }

  private static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private static toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }
}
