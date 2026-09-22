import fs from 'fs';
import path from 'path';

export interface GtfsAgency {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_lang?: string;
}

export interface GtfsRoute {
  route_id: string;
  agency_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
}

export interface GtfsStop {
  stop_id: string;
  stop_code?: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  location_type?: string;
  parent_station?: string;
  platform_code?: string;
}

export interface GtfsTrip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
  direction_id?: string;
  shape_id?: string;
}

export interface GtfsStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
}

export interface GtfsShapePoint {
  shape_id: string;
  shape_pt_lat: string;
  shape_pt_lon: string;
  shape_pt_sequence: string;
}

export interface GtfsTranslation {
  table_name: string;
  field_name: string;
  language: string;
  translation: string;
  record_id?: string;
  record_sub_id?: string;
  field_value?: string;
}

export class GtfsParser {
  /**
   * Parse CSV content into an array of objects
   */
  static parseCsv<T = Record<string, string>>(csvContent: string): T[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return [];

    const headers = this.parseLine(lines[0]);
    const results: T[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseLine(lines[i]);
      if (values.length === 0) continue;

      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] !== undefined ? values[j].trim() : '';
      }
      results.push(row as unknown as T);
    }

    return results;
  }

  /**
   * Parse a single CSV line supporting quotes and commas inside quotes
   */
  static parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Parse a GTFS file from filesystem
   */
  static parseFile<T = Record<string, string>>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseCsv<T>(content);
  }

  /**
   * Parse all GTFS files from directory
   */
  static parseDirectory(dirPath: string) {
    return {
      agency: this.parseFile<GtfsAgency>(path.join(dirPath, 'agency.txt')),
      routes: this.parseFile<GtfsRoute>(path.join(dirPath, 'routes.txt')),
      stops: this.parseFile<GtfsStop>(path.join(dirPath, 'stops.txt')),
      trips: this.parseFile<GtfsTrip>(path.join(dirPath, 'trips.txt')),
      stopTimes: this.parseFile<GtfsStopTime>(path.join(dirPath, 'stop_times.txt')),
      shapes: this.parseFile<GtfsShapePoint>(path.join(dirPath, 'shapes.txt')),
      translations: this.parseFile<GtfsTranslation>(path.join(dirPath, 'translations.txt')),
    };
  }
}
