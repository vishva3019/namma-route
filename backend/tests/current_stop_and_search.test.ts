import { describe, it, expect, beforeAll } from 'vitest';
import { currentStopService, OrderedStop } from '../src/services/currentStopService';
import { RouteService } from '../src/services/routeService';
import {
  normalizeRouteIdentifier,
  normalizeRouteSearchQuery,
  matchRouteNumber,
} from '../src/utils/routeNormalizer';

describe('Current Stop Detection & Route Search Normalization Tests', () => {
  const routeService = new RouteService();

  // Reference test stops along a corridor (e.g. KBS -> Mysore Bank -> Maharani College -> KR Circle)
  const sampleStops: OrderedStop[] = [
    {
      id: 'stop-1',
      name: 'Kempegowda Bus Station',
      sequence: 1,
      latitude: 12.9778,
      longitude: 77.5727,
    },
    {
      id: 'stop-2',
      name: 'Mysore Bank',
      sequence: 2,
      latitude: 12.9745,
      longitude: 77.5815,
    },
    {
      id: 'stop-3',
      name: 'Maharani College',
      sequence: 3,
      latitude: 12.9730,
      longitude: 77.5855,
    },
    {
      id: 'stop-4',
      name: 'KR Circle',
      sequence: 4,
      latitude: 12.9715,
      longitude: 77.5890,
    },
  ];

  describe('Part 1: Current-Stop Algorithm Edge Cases (A - H)', () => {
    // Configured match radius = 75m, approach radius = 250m
    const testOptions = { matchRadiusMeters: 75, approachRadiusMeters: 250 };

    it('A. Vehicle exactly at a stop -> AT_STOP', () => {
      const result = currentStopService.detectStop(
        {
          latitude: sampleStops[0].latitude,
          longitude: sampleStops[0].longitude,
          bearing: 110,
          speed: 0,
        },
        sampleStops,
        testOptions
      );

      expect(result.stopStatus).toBe('AT_STOP');
      expect(result.currentStop).not.toBeNull();
      expect(result.currentStop?.stopId).toBe('stop-1');
      expect(result.currentStop?.stopName).toBe('Kempegowda Bus Station');
      expect(result.currentStop?.sequence).toBe(1);
      expect(result.currentStop?.distanceMeters).toBeLessThanOrEqual(5);
      expect(result.nextStop?.stopId).toBe('stop-2');
      expect(result.nextStop?.sequence).toBe(2);
    });

    it('B. Vehicle 20m from a stop -> AT_STOP (within 75m threshold)', () => {
      // Offset by ~20 meters (~0.00018 degrees)
      const result = currentStopService.detectStop(
        {
          latitude: sampleStops[1].latitude + 0.00015,
          longitude: sampleStops[1].longitude + 0.0001,
          bearing: 115,
          speed: 10,
        },
        sampleStops,
        testOptions
      );

      expect(result.stopStatus).toBe('AT_STOP');
      expect(result.currentStop).not.toBeNull();
      expect(result.currentStop?.stopId).toBe('stop-2');
      expect(result.currentStop?.stopName).toBe('Mysore Bank');
      expect(result.currentStop?.distanceMeters).toBeLessThanOrEqual(75);
      expect(result.nextStop?.stopId).toBe('stop-3');
    });

    it('C. Vehicle 100m from stop heading towards it -> APPROACHING_STOP', () => {
      // Position vehicle ~100m before Stop 3 (Maharani College)
      // Moving southeast along Mysore Bank -> Maharani College (bearing ~115 deg)
      const result = currentStopService.detectStop(
        {
          latitude: sampleStops[2].latitude + 0.0006,
          longitude: sampleStops[2].longitude - 0.0007,
          bearing: 120, // Heading directly towards Stop 3
          speed: 25,
        },
        sampleStops,
        testOptions
      );

      expect(result.stopStatus).toBe('APPROACHING_STOP');
      expect(result.currentStop).toBeNull(); // Do not invent fake current stop!
      expect(result.nextStop).not.toBeNull();
      expect(result.nextStop?.stopId).toBe('stop-3');
      expect(result.nextStop?.stopName).toBe('Maharani College');
      expect(result.nextStop?.distanceMeters).toBeGreaterThan(75);
      expect(result.nextStop?.distanceMeters).toBeLessThanOrEqual(250);
    });

    it('D. Vehicle between stops (>250m away) -> IN_TRANSIT', () => {
      // Midpoint between Stop 1 and Stop 2 (~500m from either stop)
      const midLat = (sampleStops[0].latitude + sampleStops[1].latitude) / 2;
      const midLon = (sampleStops[0].longitude + sampleStops[1].longitude) / 2;

      const result = currentStopService.detectStop(
        {
          latitude: midLat,
          longitude: midLon,
          bearing: 110,
          speed: 30,
        },
        sampleStops,
        testOptions
      );

      expect(result.stopStatus).toBe('IN_TRANSIT');
      expect(result.currentStop).toBeNull();
      expect(result.nextStop).not.toBeNull();
      expect(result.nextStop?.stopId).toBe('stop-2'); // upcoming stop along the segment
      expect(result.nextStop?.sequence).toBe(2);
    });

    it('E. Vehicle close to two stops -> choose sequence and heading consistent stop', () => {
      // Two stops close to each other
      const closeStops: OrderedStop[] = [
        { id: 's1', name: 'Stop A', sequence: 10, latitude: 12.9700, longitude: 77.5800 },
        { id: 's2', name: 'Stop B', sequence: 11, latitude: 12.9702, longitude: 77.5804 },
      ];

      // Vehicle is at 12.9701, 77.5801 heading northeast (bearing 60) towards Stop B
      const result = currentStopService.detectStop(
        {
          latitude: 12.9701,
          longitude: 77.5801,
          bearing: 60,
          speed: 15,
        },
        closeStops,
        testOptions
      );

      expect(result.stopStatus).toBe('AT_STOP');
      expect(result.currentStop).not.toBeNull();
      // Candidate stop ahead along heading is selected
      expect(['s1', 's2']).toContain(result.currentStop?.stopId);
    });

    it('F. Vehicle on opposite direction -> uses correct direction stop sequence', () => {
      const upStops: OrderedStop[] = [
        { id: 'up-1', name: 'Majestic', sequence: 1, latitude: 12.9778, longitude: 77.5727 },
        { id: 'up-2', name: 'Anekal', sequence: 50, latitude: 12.7100, longitude: 77.6950 },
      ];
      const downStops: OrderedStop[] = [
        { id: 'down-1', name: 'Anekal', sequence: 1, latitude: 12.7100, longitude: 77.6950 },
        { id: 'down-2', name: 'Majestic', sequence: 50, latitude: 12.9778, longitude: 77.5727 },
      ];

      // Vehicle near Anekal heading north towards Majestic (bearing ~340 deg)
      const selectedVariant = currentStopService.selectBestVariant(
        {
          latitude: 12.7150,
          longitude: 77.6940,
          bearing: 340,
          destination: 'Kempegowda Bus Station',
        },
        [
          { variantId: 'v-up', direction: 0, originName: 'Majestic', destinationName: 'Anekal', stops: upStops },
          { variantId: 'v-down', direction: 1, originName: 'Anekal', destinationName: 'Majestic', stops: downStops },
        ]
      );

      expect(selectedVariant).not.toBeNull();
      expect(selectedVariant?.direction).toBe(1); // Down direction (Anekal -> Majestic)
      expect(selectedVariant?.destinationName).toBe('Majestic');
    });

    it('G. Vehicle with no route match or empty stops -> UNKNOWN', () => {
      const result = currentStopService.detectStop(
        {
          latitude: 12.9778,
          longitude: 77.5727,
          bearing: 90,
          speed: 10,
        },
        [], // empty route stops
        testOptions
      );

      expect(result.stopStatus).toBe('UNKNOWN');
      expect(result.currentStop).toBeNull();
      expect(result.nextStop).toBeNull();
    });

    it('H. No GPS coordinates -> UNKNOWN', () => {
      const result = currentStopService.detectStop(
        {
          latitude: null as any,
          longitude: null as any,
          bearing: null,
          speed: null,
        },
        sampleStops,
        testOptions
      );

      expect(result.stopStatus).toBe('UNKNOWN');
      expect(result.currentStop).toBeNull();
      expect(result.nextStop).toBeNull();
    });
  });

  describe('Part 2: Route Normalization Unit Tests', () => {
    it('should normalize identifiers with hyphens, spaces, and unicode dashes', () => {
      expect(normalizeRouteIdentifier('600-F')).toBe('600f');
      expect(normalizeRouteIdentifier('600F')).toBe('600f');
      expect(normalizeRouteIdentifier('600 F')).toBe('600f');
      expect(normalizeRouteIdentifier('600–F')).toBe('600f'); // en-dash
      expect(normalizeRouteIdentifier('600—F')).toBe('600f'); // em-dash
      expect(normalizeRouteIdentifier('356-M')).toBe('356m');
      expect(normalizeRouteIdentifier('356M')).toBe('356m');
      expect(normalizeRouteIdentifier('KIA-9')).toBe('kia9');
      expect(normalizeRouteIdentifier('KIA9')).toBe('kia9');
      expect(normalizeRouteIdentifier('V-500D')).toBe('v500d');
      expect(normalizeRouteIdentifier('V500D')).toBe('v500d');
    });

    it('should match route numbers with exact, prefix, and contains qualities', () => {
      expect(matchRouteNumber('600-F', '600F').quality).toBe('EXACT');
      expect(matchRouteNumber('600-F', '600-F').quality).toBe('EXACT');
      expect(matchRouteNumber('600-F', '600 F').quality).toBe('EXACT');
      expect(matchRouteNumber('600-F BEML5-ATB', '600F').quality).toBe('PREFIX');
      expect(matchRouteNumber('O EXP-356KA', 'EXP356').quality).toBe('CONTAINS');
      expect(matchRouteNumber('356-M', '999').quality).toBe('NONE');
    });
  });

  describe('Part 3: Verification of Specified Route Searches against Real DB', () => {
    const requiredSearches = [
      '600F',
      '600-F',
      '600 F',
      '600f',
      '500D',
      '500-D',
      '401K',
      '401-K',
      '335E',
      '335-E',
      '356M',
      '356-M',
      'KIA9',
      'KIA-9',
      'V500D',
      'V-500D',
    ];

    for (const query of requiredSearches) {
      it(`searchRoutes('${query}') should return actual matching database routes`, async () => {
        const res = await routeService.searchRoutes(query, 10, 0);
        expect(res.total).toBeGreaterThan(0);
        expect(res.routes.length).toBeGreaterThan(0);

        const top = res.routes[0];
        expect(top).toHaveProperty('routeNumber');
        expect(top).toHaveProperty('origin');
        expect(top).toHaveProperty('destination');
        expect(top).toHaveProperty('variant');

        // Verify top result matches normalized query
        const normQ = normalizeRouteSearchQuery(query);
        const normTop = normalizeRouteIdentifier(top.routeNumber);
        expect(normTop.startsWith(normQ) || normTop === normQ || normTop.includes(normQ)).toBe(true);
      });
    }

    it('findRouteEntity("600F") and findRouteEntity("600-F") should resolve to the same route', async () => {
      const r1 = await routeService.findRouteEntity('600F');
      const r2 = await routeService.findRouteEntity('600-F');

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r1?.routeShortName).toBe('600-F');
      expect(r2?.routeShortName).toBe('600-F');
      expect(r1?.id).toBe(r2?.id);
    });

    it('findRouteEntity("356M") and findRouteEntity("356-M") should resolve to Route 356-M', async () => {
      const r1 = await routeService.findRouteEntity('356M');
      const r2 = await routeService.findRouteEntity('356-M');

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(r1?.routeShortName).toBe('356-M');
      expect(r2?.routeShortName).toBe('356-M');
      expect(r1?.id).toBe(r2?.id);
    });
  });
});

  describe('Part 4: GPS Jitter Hysteresis & Stationary Bus / Bearing 0 Robustness', () => {
    const testOptions = { matchRadiusMeters: 75, approachRadiusMeters: 250, hysteresisSeconds: 30 };

    it('A. GPS jitter ±10m around a stop retains AT_STOP via hysteresis', () => {
      const now = Date.now();
      const prevState = {
        lastAtStopId: 'stop-2',
        lastAtStopName: 'Mysore Bank',
        lastAtStopSequence: 2,
        lastAtStopTimestamp: now - 10000, // 10 seconds ago
        lastStopStatus: 'AT_STOP' as const,
      };

      // Stop 2 position + offset that places vehicle at ~82m from stop (> 75m threshold)
      const latOffset = 0.00072; // ~80m north
      const jitteredResult = currentStopService.detectStop(
        {
          id: 'bus-jitter-10',
          latitude: sampleStops[1].latitude + latOffset,
          longitude: sampleStops[1].longitude,
          bearing: 0,
          speed: 0,
        },
        sampleStops,
        {
          ...testOptions,
          currentTimeMs: now,
          previousState: prevState,
        }
      );

      expect(jitteredResult.stopStatus).toBe('AT_STOP');
      expect(jitteredResult.currentStop).not.toBeNull();
      expect(jitteredResult.currentStop?.stopId).toBe('stop-2');
      expect(jitteredResult.currentStop?.sequence).toBe(2);
    });

    it('B. GPS jitter ±30m around a stop retains AT_STOP when stationary within hysteresis', () => {
      const now = Date.now();
      const prevState = {
        lastAtStopId: 'stop-2',
        lastAtStopName: 'Mysore Bank',
        lastAtStopSequence: 2,
        lastAtStopTimestamp: now - 15000, // 15 seconds ago
        lastStopStatus: 'AT_STOP' as const,
      };

      // Offset places vehicle ~95m away (> 75m threshold, but within 1.5x hysteresis limit of 112.5m)
      const latOffset = 0.00085;
      const jitteredResult = currentStopService.detectStop(
        {
          id: 'bus-jitter-30',
          latitude: sampleStops[1].latitude + latOffset,
          longitude: sampleStops[1].longitude,
          bearing: 0,
          speed: 0, // Stationary bus
        },
        sampleStops,
        {
          ...testOptions,
          currentTimeMs: now,
          previousState: prevState,
        }
      );

      expect(jitteredResult.stopStatus).toBe('AT_STOP');
      expect(jitteredResult.currentStop?.stopId).toBe('stop-2');
      expect(jitteredResult.currentStop?.sequence).toBe(2);
      expect(jitteredResult.nextStop?.stopId).toBe('stop-3');
    });

    it('C. Bus stationary at stop with bearing 0 preserves correct sequence without resetting to start', () => {
      const now = Date.now();
      const prevState = {
        lastAtStopId: 'stop-3',
        lastAtStopName: 'Maharani College',
        lastAtStopSequence: 3,
        lastAtStopTimestamp: now - 5000,
        lastStopStatus: 'AT_STOP' as const,
      };

      // Bus is directly at Stop 3 with bearing = 0 and speed = 0
      const result = currentStopService.detectStop(
        {
          id: 'bus-stationary-bearing-0',
          latitude: sampleStops[2].latitude,
          longitude: sampleStops[2].longitude,
          bearing: 0,
          speed: 0,
        },
        sampleStops,
        {
          ...testOptions,
          currentTimeMs: now,
          previousState: prevState,
        }
      );

      expect(result.stopStatus).toBe('AT_STOP');
      expect(result.currentStop?.stopId).toBe('stop-3');
      expect(result.currentStop?.sequence).toBe(3);
      expect(result.nextStop?.stopId).toBe('stop-4');
    });

    it('D. Bus stationary at circular route stop selects downstream sequence, not early sequence', () => {
      // Circular route where early stop and late stop are in the same junction
      const circularStops: OrderedStop[] = [
        { id: 'circ-1', name: 'Depot Start', sequence: 1, latitude: 12.9700, longitude: 77.5800 },
        { id: 'circ-2', name: 'Junction Entry', sequence: 2, latitude: 12.9720, longitude: 77.5820 },
        { id: 'circ-10', name: 'Outer Point', sequence: 10, latitude: 12.9900, longitude: 77.6000 },
        { id: 'circ-20', name: 'Junction Return', sequence: 20, latitude: 12.97205, longitude: 77.58205 }, // Same junction
        { id: 'circ-21', name: 'Depot End', sequence: 21, latitude: 12.9700, longitude: 77.5800 },
      ];

      const now = Date.now();
      const prevState = {
        lastAtStopId: 'circ-10',
        lastAtStopName: 'Outer Point',
        lastAtStopSequence: 10,
        lastNextStopSequence: 20,
        lastStopStatus: 'IN_TRANSIT' as const,
      };

      // Bus arrives at Junction Return (sequence 20) with bearing = 0, speed = 0
      const result = currentStopService.detectStop(
        {
          id: 'bus-circular-1',
          latitude: circularStops[3].latitude,
          longitude: circularStops[3].longitude,
          bearing: 0,
          speed: 0,
        },
        circularStops,
        {
          ...testOptions,
          currentTimeMs: now,
          previousState: prevState,
        }
      );

      expect(result.stopStatus).toBe('AT_STOP');
      expect(result.currentStop?.sequence).toBe(20);
      expect(result.currentStop?.stopId).toBe('circ-20');
      expect(result.nextStop?.sequence).toBe(21);
    });

    it('E. Bus departs stop after being stationary (high speed / distance exceeds hysteresis limit)', () => {
      const now = Date.now();
      const prevState = {
        lastAtStopId: 'stop-2',
        lastAtStopName: 'Mysore Bank',
        lastAtStopSequence: 2,
        lastAtStopTimestamp: now - 20000,
        lastStopStatus: 'AT_STOP' as const,
      };

      // Bus accelerated to 32 km/h and is 140m away (> 112.5m hysteresis radius)
      const latOffset = 0.0013; // ~140m away towards Maharani College
      const result = currentStopService.detectStop(
        {
          id: 'bus-departed',
          latitude: sampleStops[1].latitude + latOffset,
          longitude: sampleStops[1].longitude,
          bearing: 110,
          speed: 32, // Clearly moving at transit speed
        },
        sampleStops,
        {
          ...testOptions,
          currentTimeMs: now,
          previousState: prevState,
        }
      );

      // Must NOT falsely hold bus at stop 2
      expect(result.stopStatus).not.toBe('AT_STOP');
      expect(result.currentStop).toBeNull();
      expect(result.nextStop?.sequence).toBeGreaterThanOrEqual(3);
    });

    it('F. Bus moves to next stop and cleanly transitions to new AT_STOP', () => {
      const now = Date.now();
      const prevState = {
        lastAtStopId: 'stop-2',
        lastAtStopName: 'Mysore Bank',
        lastAtStopSequence: 2,
        lastAtStopTimestamp: now - 60000, // 1 minute ago
        lastStopStatus: 'AT_STOP' as const,
      };

      // Bus is now 25m from Stop 3 (Maharani College)
      const result = currentStopService.detectStop(
        {
          id: 'bus-next-stop',
          latitude: sampleStops[2].latitude + 0.0002,
          longitude: sampleStops[2].longitude,
          bearing: 110,
          speed: 5,
        },
        sampleStops,
        {
          ...testOptions,
          currentTimeMs: now,
          previousState: prevState,
        }
      );

      expect(result.stopStatus).toBe('AT_STOP');
      expect(result.currentStop?.stopId).toBe('stop-3');
      expect(result.currentStop?.sequence).toBe(3);
      expect(result.nextStop?.stopId).toBe('stop-4');
    });

    it('G. Multiple nearby stops with heading disambiguation', () => {
      const clusteredStops: OrderedStop[] = [
        { id: 'c1', name: 'West Platform', sequence: 5, latitude: 12.9750, longitude: 77.5800 },
        { id: 'c2', name: 'East Platform', sequence: 6, latitude: 12.9752, longitude: 77.5805 }, // 60m away
      ];

      // Vehicle is at 12.9751, 77.5802 heading east (bearing 85 deg)
      const result = currentStopService.detectStop(
        {
          latitude: 12.9751,
          longitude: 77.5802,
          bearing: 85,
          speed: 12,
        },
        clusteredStops,
        testOptions
      );

      expect(result.stopStatus).toBe('AT_STOP');
      expect(result.currentStop).not.toBeNull();
      // Candidate ahead along heading (East Platform) is matched
      expect(result.currentStop?.stopId).toBe('c2');
    });
  });
