import { describe, it, expect } from 'vitest';
import { GtfsParser } from '../src/providers/gtfs/GtfsParser';
import { GtfsValidator } from '../src/providers/gtfs/GtfsValidator';

describe('GTFS Parser & Validator', () => {
  it('should correctly parse CSV lines with quoted commas', () => {
    const csv = `route_id,route_name,desc\n500D,"Hebbal, Silk Board",Fast bus`;
    const rows = GtfsParser.parseCsv<any>(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].route_id).toBe('500D');
    expect(rows[0].route_name).toBe('Hebbal, Silk Board');
    expect(rows[0].desc).toBe('Fast bus');
  });

  it('should validate coordinates within Bengaluru bbox', () => {
    // Kempegowda Bus Station (Majestic): 12.9778, 77.5726
    expect(GtfsValidator.isValidCoordinate(12.9778, 77.5726)).toBe(true);

    // Silk Board: 12.9176, 77.6234
    expect(GtfsValidator.isValidCoordinate(12.9176, 77.6234)).toBe(true);

    // Delhi coordinates: should fail Bengaluru check
    expect(GtfsValidator.isValidCoordinate(28.6139, 77.2090)).toBe(false);

    // Invalid coordinates (NaN, out of range)
    expect(GtfsValidator.isValidCoordinate(NaN, 77.5726)).toBe(false);
    expect(GtfsValidator.isValidCoordinate(12.9778, 200)).toBe(false);
  });

  it('should validate stops correctly', () => {
    const validStop = {
      stop_id: 'KBS',
      stop_name: 'Majestic',
      stop_lat: '12.9778',
      stop_lon: '77.5726',
    };
    expect(GtfsValidator.validateStop(validStop).valid).toBe(true);

    const invalidStop = {
      stop_id: 'BAD',
      stop_name: '',
      stop_lat: '999',
      stop_lon: '77.5726',
    };
    const res = GtfsValidator.validateStop(invalidStop);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
