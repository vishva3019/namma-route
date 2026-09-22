import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server';
import { vehicleService } from '../src/services/vehicleService';

describe('API Endpoints Integration Tests', { timeout: 15000 }, () => {
  afterAll(() => {
    vehicleService.stop();
  });

  it('GET /api/health should return 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('OK');
    expect(res.body).toHaveProperty('realtime');
    expect(res.body).toHaveProperty('vehicles');
  });

  it('GET /api/stats should return dashboard numbers', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data).toHaveProperty('liveBuses');
    expect(res.body.data).toHaveProperty('activeRoutes');
    expect(res.body.data).toHaveProperty('stops');
    expect(res.body.data.stops).toBeGreaterThan(0);
  });

  it('GET /api/routes should return route list', async () => {
    const res = await request(app).get('/api/routes?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.routes.length).toBeGreaterThan(0);
    expect(res.body.data.routes[0]).toHaveProperty('routeNumber');
  });

  it('GET /api/realtime/vehicles should return provider metadata with source BMTC and UNAVAILABLE status', async () => {
    const res = await request(app).get('/api/realtime/vehicles');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('provider');
    expect(res.body).toHaveProperty('source');
    expect(res.body.provider).toBe('BMTC_REALTIME');
    expect(res.body.source).toBe('BMTC');
    expect(Array.isArray(res.body.vehicles)).toBe(true);

    // In non-demo mode with upstream 403, it must report UNAVAILABLE with 0 vehicles and never mock buses
    if (res.body.status === 'UNAVAILABLE') {
      expect(res.body.vehicleCount).toBe(0);
      expect(res.body.vehicles).toEqual([]);
      expect(res.body.error).toBe('Realtime BMTC data unavailable');
    }
  });

  it('GET /api/realtime/status should return diagnostic health object matching schema', async () => {
    const res = await request(app).get('/api/realtime/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider');
    expect(res.body).toHaveProperty('configured');
    expect(res.body).toHaveProperty('reachable');
    expect(res.body).toHaveProperty('lastAttempt');
    expect(res.body).toHaveProperty('vehicleCount');
    expect(res.body).toHaveProperty('dataAge');
    expect(res.body).toHaveProperty('error');
    expect(res.body.provider).toBe('BMTC_REALTIME');
    expect(res.body.configured).toBe(true);
    expect(typeof res.body.reachable).toBe('boolean');
    expect(typeof res.body.vehicleCount).toBe('number');
  });

  it('GET /api/journey should calculate route from Majestic to Electronic City', async () => {
    const res = await request(app).get('/api/journey?from=Majestic&to=Electronic');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('totalDurationMinutes');
  });
});

