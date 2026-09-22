import { describe, it, expect } from 'vitest';
import { GeoUtils } from '../src/utils/geo';
import { CacheService } from '../src/cache/cacheService';

describe('Geo & Cache Utilities', () => {
  it('should accurately calculate distance between Majestic and Silk Board', () => {
    // Majestic: 12.9778, 77.5726
    // Silk Board: 12.9176, 77.6234
    const distanceKm = GeoUtils.distanceKm(12.9778, 77.5726, 12.9176, 77.6234);
    // Straight-line distance is approximately 8.7 to 9.2 km
    expect(distanceKm).toBeGreaterThan(8.0);
    expect(distanceKm).toBeLessThan(10.0);
  });

  it('should calculate correct bearing', () => {
    // Due North
    expect(Math.round(GeoUtils.calculateBearing(12.0, 77.0, 13.0, 77.0))).toBe(0);
    // Due East
    expect(Math.round(GeoUtils.calculateBearing(12.0, 77.0, 12.0, 78.0))).toBe(90);
  });

  it('should handle in-memory cache TTL properly', async () => {
    const cache = new CacheService();
    await cache.set('test-key', { sample: 42 }, 1); // 1 sec TTL

    const val1 = await cache.get<any>('test-key');
    expect(val1).toEqual({ sample: 42 });

    // Wait 1.1s for expiration
    await new Promise((r) => setTimeout(r, 1100));
    const val2 = await cache.get<any>('test-key');
    expect(val2).toBeNull();
  });
});
