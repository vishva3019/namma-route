import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server';
import { vehicleService } from '../src/services/vehicleService';

describe('Complete BMTC Network Validation Tests', { timeout: 20000 }, () => {
  afterAll(() => {
    vehicleService.stop();
  });

  // 1. Data Stats & Coverage Endpoints
  describe('Data Stats & Coverage', () => {
    it('GET /api/data/stats should return dynamic counts from database', async () => {
      const res = await request(app).get('/api/data/stats');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      const data = res.body.data;
      expect(data.routes).toBeGreaterThanOrEqual(4400);
      expect(data.stops).toBeGreaterThanOrEqual(9900);
      expect(data.variants).toBeGreaterThanOrEqual(7400);
      expect(data.trips).toBeGreaterThanOrEqual(57000);
      expect(data.stopTimes).toBeGreaterThanOrEqual(1500000);
      expect(data.shapes).toBeGreaterThanOrEqual(7300);
      expect(data.networkScope).toBe('PARTIAL NETWORK (All live-trackable BMTC routes from Namma BMTC)');
      expect(data.dataSource.name).toBe('bmtc-gtfs');
      expect(data.dataSource.version).toBe('20260907');
    });

    it('GET /api/data/coverage should describe coverage and features', async () => {
      const res = await request(app).get('/api/data/coverage');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      const data = res.body.data;
      expect(data.networkScope).toBe('PARTIAL NETWORK (All live-trackable BMTC routes from Namma BMTC)');
      expect(data.version).toBe('20260907');
      expect(Array.isArray(data.features)).toBe(true);
      expect(data.features.length).toBeGreaterThanOrEqual(5);
    });
  });

  // 2. Route 356-M Comprehensive Tests
  describe('Route 356-M Strict Network Specification', () => {
    it('GET /api/routes/356-M should return Majestic ⇄ Anekal with family 356', async () => {
      const res = await request(app).get('/api/routes/356-M');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      const r = res.body.data;
      expect(r.routeNumber).toBe('356-M');
      expect(r.routeFamily).toBe('356');
      expect(r.origin).toBe('Kempegowda Bus Station');
      expect(r.destination).toBe('Anekal');
      expect(r.routeName).toContain('Kempegowda Bus Station');
      expect(r.routeName).toContain('Anekal');
      expect(Array.isArray(r.directions)).toBe(true);
      expect(r.directions.length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(r.geometry)).toBe(true);
      expect(r.geometry.length).toBeGreaterThan(400); // 464 shape points
    });

    it('GET /api/routes/356-M/directions should return Direction 0 (UP) and Direction 1 (DOWN)', async () => {
      const res = await request(app).get('/api/routes/356-M/directions');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      const dirs = res.body.data;
      expect(dirs.length).toBeGreaterThanOrEqual(2);

      const dir0 = dirs.find((d: any) => d.direction === 0);
      expect(dir0).toBeDefined();
      expect(dir0.originName).toBe('Kempegowda Bus Station');
      expect(dir0.destinationName).toBe('Anekal');
      expect(dir0.stopCount).toBe(55);

      const dir1 = dirs.find((d: any) => d.direction === 1);
      expect(dir1).toBeDefined();
      expect(dir1.originName).toBe('Anekal');
      expect(dir1.destinationName).toBe('Kempegowda Bus Station');
      expect(dir1.stopCount).toBe(53);
    });

    it('GET /api/routes/356-M/stops?direction=0 should have Majestic first, Electronic City mid, Anekal last', async () => {
      const res = await request(app).get('/api/routes/356-M/stops?direction=0');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      const stops = res.body.data;
      expect(stops.length).toBe(55);

      // Sequence 1: Kempegowda Bus Station
      expect(stops[0].name).toBe('Kempegowda Bus Station');
      expect(stops[0].sequence).toBe(1);

      // Sequence ~29-31: Electronic City
      const ecStop = stops.find((s: any) => s.name.toLowerCase().includes('electronic city'));
      expect(ecStop).toBeDefined();
      expect(ecStop.sequence).toBeGreaterThanOrEqual(28);
      expect(ecStop.sequence).toBeLessThanOrEqual(32);

      // Sequence 55: Anekal
      expect(stops[stops.length - 1].name).toBe('Anekal');
      expect(stops[stops.length - 1].sequence).toBe(55);
    });

    it('GET /api/routes/356-M/stops?direction=1 should have Anekal first, Majestic last', async () => {
      const res = await request(app).get('/api/routes/356-M/stops?direction=1');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      const stops = res.body.data;
      expect(stops.length).toBe(53);

      expect(stops[0].name).toBe('Anekal');
      expect(stops[0].sequence).toBe(1);

      expect(stops[stops.length - 1].name).toBe('Kempegowda Bus Station');
    });

    it('GET /api/routes/356-M/timetable should return scheduled trip departures', async () => {
      const res = await request(app).get('/api/routes/356-M/timetable?direction=0');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('departureTime');
      expect(res.body.data[0]).toHaveProperty('arrivalTime');
    });

    it('GET /api/debug/routes/356-M should return diagnostic hierarchy', async () => {
      const res = await request(app).get('/api/debug/routes/356-M');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      const debug = res.body.data;
      expect(debug.found).toBe(true);
      expect(debug.route.routeShortName).toBe('356-M');
      expect(debug.variants.length).toBeGreaterThanOrEqual(2);
    });
  });

  // 3. Stop Fuzzy Search & Landmark Aliases
  describe('Stop Search & Aliases', () => {
    it('GET /api/stops/search?q=Majestic should resolve Kempegowda Bus Station', async () => {
      const res = await request(app).get('/api/stops/search?q=Majestic');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.data.stops.length).toBeGreaterThan(0);
      const topStop = res.body.data.stops[0];
      expect(topStop.name).toContain('Kempegowda Bus Station');
    });

    it('GET /api/stops/search?q=Silk Board should resolve Central Silk Board', async () => {
      const res = await request(app).get('/api/stops/search?q=Silk Board');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.data.stops.length).toBeGreaterThan(0);
      const topStop = res.body.data.stops[0];
      expect(topStop.name).toContain('Silk Board');
    });

    it('GET /api/stops/search?q=ಮೆಜೆಸ್ಟಿಕ್ should support Kannada query', async () => {
      const res = await request(app).get('/api/stops/search?q=' + encodeURIComponent('ಮೆಜೆಸ್ಟಿಕ್'));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.data.stops.length).toBeGreaterThan(0);
    });
  });

  // 4. Journey Planning
  describe('Sequence-Aware Journey Planning', () => {
    it('GET /api/journey from Majestic to Anekal should return DIRECT 356-M route', async () => {
      const res = await request(app).get('/api/journey?from=Majestic&to=Anekal');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify at least one plan is direct with 356-M or family 356
      const directPlan = res.body.data.find((p: any) => p.type === 'DIRECT' && p.legs[0].routeNumber.includes('356'));
      expect(directPlan).toBeDefined();
      expect(directPlan.legs[0].fromStop.name).toContain('Kempegowda Bus Station');
      expect(directPlan.legs[0].toStop.name).toContain('Anekal');
      expect(directPlan.legs[0].intermediateStops.length).toBeGreaterThan(10);
    });

    it('GET /api/journey from Anekal to Majestic should return DIRECT reverse route', async () => {
      const res = await request(app).get('/api/journey?from=Anekal&to=Majestic');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const directPlan = res.body.data.find((p: any) => p.type === 'DIRECT' && p.legs[0].routeNumber.includes('356'));
      expect(directPlan).toBeDefined();
      expect(directPlan.legs[0].fromStop.name).toContain('Anekal');
      expect(directPlan.legs[0].toStop.name).toContain('Kempegowda Bus Station');
    });

    it('GET /api/journey from Majestic to Electronic City should return intermediate stop leg', async () => {
      const res = await request(app).get('/api/journey?from=Majestic&to=' + encodeURIComponent('PESCE College Electronic City'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const directPlan = res.body.data.find((p: any) => p.type === 'DIRECT');
      expect(directPlan).toBeDefined();
      expect(directPlan.legs[0].fromStop.name).toContain('Kempegowda Bus Station');
      expect(directPlan.legs[0].toStop.name).toContain('Electronic City');
    });
  });
});
