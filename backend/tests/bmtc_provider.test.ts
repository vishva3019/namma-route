import { describe, it, expect } from 'vitest';
import { BmtcRealtimeProvider } from '../src/providers/bmtc/BmtcRealtimeProvider';
import { MockRealtimeProvider } from '../src/providers/bmtc/MockRealtimeProvider';
import { BmtcNormalizer } from '../src/providers/bmtc/BmtcNormalizer';
import { bmtcApiClient } from '../src/providers/bmtc/BmtcApiClient';

describe('BMTC Realtime Provider & Diagnostics Unit Tests', () => {
  it('BmtcRealtimeProvider should initialize with BMTC_REALTIME name and diagnostic status', () => {
    const provider = new BmtcRealtimeProvider();
    expect(provider.name).toBe('BMTC_REALTIME');

    const status = provider.getStatus();
    expect(status.provider).toBe('BMTC_REALTIME');
    expect(status.configured).toBe(true);
    expect(status).toHaveProperty('reachable');
    expect(status).toHaveProperty('lastAttempt');
    expect(status).toHaveProperty('vehicleCount');
    expect(status).toHaveProperty('dataAge');
    expect(status).toHaveProperty('error');
  });

  it('MockRealtimeProvider should return simulated vehicles with source DEMO and MOCK_DEMO_PROVIDER status', async () => {
    const provider = new MockRealtimeProvider();
    expect(provider.name).toBe('MOCK_DEMO_PROVIDER');

    const vehicles = await provider.getVehicles();
    expect(vehicles.length).toBeGreaterThan(0);
    expect(vehicles[0].source).toBe('DEMO');
    expect(vehicles[0].status).toBe('LIVE');

    const status = provider.getStatus();
    expect(status.provider).toBe('MOCK_DEMO_PROVIDER');
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.vehicleCount).toBe(vehicles.length);
  });

  it('BmtcNormalizer should strictly discard coordinates outside Bengaluru bbox', () => {
    // Exactly inside bounds
    expect(BmtcNormalizer.isWithinBengaluruBounds(12.9716, 77.5946)).toBe(true);
    // Boundary checks
    expect(BmtcNormalizer.isWithinBengaluruBounds(12.60, 77.20)).toBe(true);
    expect(BmtcNormalizer.isWithinBengaluruBounds(13.40, 77.95)).toBe(true);
    // Outside bounds
    expect(BmtcNormalizer.isWithinBengaluruBounds(12.59, 77.59)).toBe(false);
    expect(BmtcNormalizer.isWithinBengaluruBounds(13.41, 77.59)).toBe(false);
    expect(BmtcNormalizer.isWithinBengaluruBounds(12.97, 77.19)).toBe(false);
    expect(BmtcNormalizer.isWithinBengaluruBounds(12.97, 77.96)).toBe(false);
  });

  it('BmtcNormalizer should normalize fresh vehicle and tag source as BMTC', () => {
    const raw = {
      vehicleid: 'KA01F1234',
      vehiclenumber: 'KA-01-F-1234',
      routeno: '500-D',
      centerlat: 12.9750,
      centerlong: 77.6050,
      heading: 90,
      speed: 25,
      lastrefreshon: new Date().toISOString(),
    };

    const normalized = BmtcNormalizer.normalizeRouteVehicle(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe('KA01F1234');
    expect(normalized?.vehicleNumber).toBe('KA-01-F-1234');
    expect(normalized?.source).toBe('BMTC');
    expect(normalized?.status).toBe('LIVE');
  });

  it('bmtcApiClient should identify configured base URL', () => {
    expect(bmtcApiClient.baseUrl).toBeDefined();
    expect(bmtcApiClient.baseUrl).toContain('karnataka.gov.in');
  });
});
