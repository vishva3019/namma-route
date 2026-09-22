import { describe, it, expect } from 'vitest';
import { BmtcNormalizer } from '../src/providers/bmtc/BmtcNormalizer';

describe('BMTC Vehicle Normalization & Freshness', () => {
  it('should parse DD-MM-YYYY HH:mm:ss timestamps correctly', () => {
    const parsed = BmtcNormalizer.parseTimestamp('22-09-2026 14:30:00');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // September is 8 (0-indexed)
    expect(parsed.getDate()).toBe(22);
    expect(parsed.getHours()).toBe(14);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('should determine status based on freshness seconds', () => {
    expect(BmtcNormalizer.determineStatus(15)).toBe('LIVE');
    expect(BmtcNormalizer.determineStatus(60)).toBe('LIVE');
    expect(BmtcNormalizer.determineStatus(90)).toBe('RECENT');
    expect(BmtcNormalizer.determineStatus(120)).toBe('RECENT');
    expect(BmtcNormalizer.determineStatus(125)).toBe('STALE');
    expect(BmtcNormalizer.determineStatus(290)).toBe('STALE');
  });

  it('should reject vehicles with timestamps older than 300 seconds', () => {
    const oldTime = new Date(Date.now() - 350 * 1000).toISOString();
    const raw = {
      vehicleid: 'BUS-999',
      vehiclenumber: 'KA-01-FA-1234',
      centerlat: 12.9716,
      centerlong: 77.5946,
      lastrefreshon: oldTime,
    };
    const normalized = BmtcNormalizer.normalizeRouteVehicle(raw);
    expect(normalized).toBeNull(); // Should be dropped/hidden
  });

  it('should reject vehicles outside Bengaluru bounding box (12.60-13.40, 77.20-77.95)', () => {
    const recentTime = new Date().toISOString();
    // Delhi coordinates
    const delhiRaw = {
      vehicleid: 'BUS-DELHI',
      centerlat: 28.6139,
      centerlong: 77.2090,
      lastrefreshon: recentTime,
    };
    expect(BmtcNormalizer.normalizeRouteVehicle(delhiRaw)).toBeNull();

    // Invalid coordinates
    const invalidRaw = {
      vehicleid: 'BUS-INV',
      centerlat: 'not-a-lat',
      centerlong: 'not-a-lon',
      lastrefreshon: recentTime,
    };
    expect(BmtcNormalizer.normalizeRouteVehicle(invalidRaw)).toBeNull();
  });

  it('should reject vehicles missing vehicle ID (strict null handling)', () => {
    const recentTime = new Date().toISOString();
    const noIdRaw = {
      centerlat: 12.9716,
      centerlong: 77.5946,
      lastrefreshon: recentTime,
    };
    expect(BmtcNormalizer.normalizeRouteVehicle(noIdRaw)).toBeNull();
  });

  it('should accept valid recent vehicles with proper fields and BMTC source', () => {
    const recentTime = new Date(Date.now() - 15 * 1000).toISOString();
    const raw = {
      vehicleid: 'BUS-101',
      vehiclenumber: 'KA-01-FA-5001',
      centerlat: 12.9716,
      centerlong: 77.5946,
      heading: 180,
      speed: 32,
      lastrefreshon: recentTime,
    };
    const normalized = BmtcNormalizer.normalizeRouteVehicle(raw, 'ROUTE-1', '500D', 'Hebbal');
    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe('BUS-101');
    expect(normalized?.vehicleNumber).toBe('KA-01-FA-5001');
    expect(normalized?.bearing).toBe(180);
    expect(normalized?.speed).toBe(32);
    expect(normalized?.status).toBe('LIVE');
    expect(normalized?.source).toBe('BMTC');
    expect(normalized?.freshnessSeconds).toBeLessThanOrEqual(20);
  });
});
