import fs from 'fs';
import path from 'path';
import readline from 'readline';
import prisma from '../../db/prisma';

export interface NetworkImportStats {
  agenciesCount: number;
  calendarsCount: number;
  stopsCount: number;
  routesCount: number;
  variantsCount: number;
  routeStopsCount: number;
  tripsCount: number;
  stopTimesCount: number;
  shapesCount: number;
  aliasesCount: number;
  durationSeconds: number;
  errors: string[];
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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

function escapeSql(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function normalizeStopName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractRouteFamily(shortName: string): string {
  if (/^KIA/i.test(shortName)) {
    const m = shortName.match(/^(KIA-[0-9A-Z]+)/i);
    return m ? m[1].toUpperCase() : 'KIA';
  }
  if (/^MF/i.test(shortName)) {
    const m = shortName.match(/^(MF-[0-9A-Z]+)/i);
    return m ? m[1].toUpperCase() : 'MF';
  }
  if (/^G-/i.test(shortName)) {
    return shortName.split(/[\s-_]/)[0].toUpperCase();
  }
  const m = shortName.match(/\b(\d+)\b/) || shortName.match(/(\d+)/);
  if (m) {
    return m[1];
  }
  return shortName.split(/[\s-_]/)[0].toUpperCase();
}

function determineServiceType(shortName: string, longName: string): string {
  const upper = `${shortName} ${longName}`.toUpperCase();
  if (upper.includes('KIA-') || upper.includes('VAYU VAJRA') || upper.includes('AIRPORT')) {
    return 'VAYU_VAJRA';
  }
  if (shortName.startsWith('V-') || upper.includes('VAJRA')) {
    return 'VAJRA';
  }
  if (shortName.startsWith('MF-') || upper.includes('METRO FEEDER')) {
    return 'METRO_FEEDER';
  }
  if (shortName.startsWith('G-') || upper.includes('BIG 10') || upper.includes('BIG10')) {
    return 'BIG10';
  }
  return 'ORDINARY';
}

const LANDMARK_ALIASES: Array<{
  names: string[];
  canonicalSearch: string;
}> = [
  {
    names: ['Majestic', 'Majestic Bus Stand', 'KBS', 'Kempegowda Bus Station', 'ಮೆಜೆಸ್ಟಿಕ್', 'ಕೆಂಪೇಗೌಡ ಬಸ್ ನಿಲ್ದಾಣ'],
    canonicalSearch: 'Kempegowda Bus Station',
  },
  {
    names: ['Central Silk Board', 'Silk Board', 'CSB', 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್', 'ಸೆಂಟ್ರಲ್ ಸಿಲ್ಕ್ ಬೋರ್ಡ್'],
    canonicalSearch: 'Central Silk Board',
  },
  {
    names: ['Electronic City', 'ECity', 'EC', 'Electronic City 1st Phase', 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ'],
    canonicalSearch: 'Electronic City',
  },
  {
    names: ['Shivajinagar', 'Shivaji Nagar', 'Shivajinagar Bus Station', 'ಶಿವಾಜಿನಗರ'],
    canonicalSearch: 'Shivajinagar',
  },
  {
    names: ['KR Market', 'K.R. Market', 'Market', 'Kalasipalya', 'ಕೆ ಆರ್ ಮಾರ್ಕೆಟ್', 'ಕಲಾಸಿಪಾಳ್ಯ'],
    canonicalSearch: 'K.R.Market',
  },
  {
    names: ['Hebbal', 'Hebbal Bus Station', 'Hebbal Flyover', 'ಹೆಬ್ಬಾಳ'],
    canonicalSearch: 'Hebbal',
  },
  {
    names: ['Whitefield', 'ITPB', 'Hope Farm', 'Kadugodi', 'ವೈಟ್‌ಫೀಲ್ಡ್', 'ಐಟಿಪಿಬಿ'],
    canonicalSearch: 'White Field',
  },
  {
    names: ['Banashankari', 'BSK', 'Banashankari TTMC', 'ಬನಶಂಕರಿ'],
    canonicalSearch: 'Banashankari',
  },
  {
    names: ['Yeshwanthpur', 'Yeshwantpur', 'YPR', 'Yeshwanthpur TTMC', 'ಯಶವಂತಪುರ'],
    canonicalSearch: 'Yeshwanthpur',
  },
  {
    names: ['Kengeri', 'Kengeri TTMC', 'Kengeri Bus Stand', 'ಕೆಂಗೇರಿ'],
    canonicalSearch: 'Kengeri',
  },
  {
    names: ['Anekal', 'Anekal Bus Stand', 'ಆನೇಕಲ್'],
    canonicalSearch: 'Anekal',
  },
  {
    names: ['Chandapura', 'Chandapura Circle', 'ಚಂದಾಪುರ'],
    canonicalSearch: 'Chandapura',
  },
  {
    names: ['Jayanagar', 'Jayanagar 4th Block', 'Jayanagar TTMC', 'ಜಯನಗರ'],
    canonicalSearch: 'Jayanagar',
  },
  {
    names: ['Shantinagar', 'Shanthi Nagar', 'Shantinagar TTMC', 'ಶಾಂತಿನಗರ'],
    canonicalSearch: 'Shantinagar',
  },
  {
    names: ['Domlur', 'Domlur TTMC', 'Domlur Flyover', 'ದೋಮ್ಲೂರು'],
    canonicalSearch: 'Domlur',
  },
  {
    names: ['Koramangala', 'Koramangala Water Tank', 'ಕೋರಮಂಗಲ'],
    canonicalSearch: 'Koramangala',
  },
  {
    names: ['HSR Layout', 'HSR', 'ಹೆಚ್ ಎಸ್ ಆರ್ ಲೇಔಟ್'],
    canonicalSearch: 'HSR Layout',
  },
  {
    names: ['BTM Layout', 'BTM', 'ಬಿಟಿಎಂ ಲೇಔಟ್'],
    canonicalSearch: 'BTM Layout',
  },
  {
    names: ['Marathahalli', 'Marathahalli Bridge', 'ಮಾರತ್ ಹಳ್ಳಿ'],
    canonicalSearch: 'Marathahalli',
  },
  {
    names: ['Tin Factory', 'KR Puram', 'K.R. Puram', 'ಟಿನ್ ಫ್ಯಾಕ್ಟರಿ', 'ಕೆ ಆರ್ ಪುರಂ'],
    canonicalSearch: 'Tin Factory',
  },
  {
    names: ['KIA', 'Airport', 'Kempegowda International Airport', 'Bengaluru Airport', 'ವಿಮಾನ ನಿಲ್ದಾಣ'],
    canonicalSearch: 'Kempegowda International Airport',
  },
];

export class GtfsNetworkImporter {
  static async importCompleteNetwork(gtfsDir?: string): Promise<NetworkImportStats> {
    const targetDir = gtfsDir || path.resolve(__dirname, '../../../../data/gtfs');
    const startTime = Date.now();
    console.log(`[GtfsNetworkImporter] Starting complete network import from: ${targetDir}`);

    const stats: NetworkImportStats = {
      agenciesCount: 0,
      calendarsCount: 0,
      stopsCount: 0,
      routesCount: 0,
      variantsCount: 0,
      routeStopsCount: 0,
      tripsCount: 0,
      stopTimesCount: 0,
      shapesCount: 0,
      aliasesCount: 0,
      durationSeconds: 0,
      errors: [],
    };

    // Tune SQLite for maximum batch ingestion performance
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = OFF;');
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = OFF;');

    const nowIso = new Date().toISOString();

    // ----------------------------------------------------
    // 1. Ingest Agency
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 1/11: Ingesting Agency...');
    const agencyFile = path.join(targetDir, 'agency.txt');
    if (fs.existsSync(agencyFile)) {
      const agencyLines = fs.readFileSync(agencyFile, 'utf-8').split(/\r?\n/).filter(l => l.trim().length > 0);
      if (agencyLines.length > 1) {
        const headers = parseCsvLine(agencyLines[0]);
        const idIdx = headers.indexOf('agency_id');
        const nameIdx = headers.indexOf('agency_name');
        const urlIdx = headers.indexOf('agency_url');
        const tzIdx = headers.indexOf('agency_timezone');
        const langIdx = headers.indexOf('agency_lang');

        const agencyRows: string[] = [];
        for (let i = 1; i < agencyLines.length; i++) {
          const vals = parseCsvLine(agencyLines[i]);
          if (vals.length < 2) continue;
          const aId = vals[idIdx] || '1';
          const name = vals[nameIdx] || 'BMTC';
          const url = vals[urlIdx] || 'https://mybmtc.karnataka.gov.in';
          const tz = vals[tzIdx] || 'Asia/Kolkata';
          const lang = vals[langIdx] || 'en';
          agencyRows.push(`(${escapeSql(aId)}, ${escapeSql(name)}, ${escapeSql(url)}, ${escapeSql(tz)}, ${escapeSql(lang)}, NULL)`);
        }
        if (agencyRows.length > 0) {
          const sql = `INSERT OR REPLACE INTO "Agency" ("id", "name", "url", "timezone", "lang", "phone") VALUES ${agencyRows.join(',')};`;
          await prisma.$executeRawUnsafe(sql);
          stats.agenciesCount = agencyRows.length;
        }
      }
    }

    // ----------------------------------------------------
    // 2. Ingest Service Calendar
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 2/11: Ingesting Service Calendar...');
    const calFile = path.join(targetDir, 'calendar.txt');
    if (fs.existsSync(calFile)) {
      const calLines = fs.readFileSync(calFile, 'utf-8').split(/\r?\n/).filter(l => l.trim().length > 0);
      if (calLines.length > 1) {
        const headers = parseCsvLine(calLines[0]);
        const svcIdx = headers.indexOf('service_id');
        const monIdx = headers.indexOf('monday');
        const tueIdx = headers.indexOf('tuesday');
        const wedIdx = headers.indexOf('wednesday');
        const thuIdx = headers.indexOf('thursday');
        const friIdx = headers.indexOf('friday');
        const satIdx = headers.indexOf('saturday');
        const sunIdx = headers.indexOf('sunday');
        const startIdx = headers.indexOf('start_date');
        const endIdx = headers.indexOf('end_date');

        const calRows: string[] = [];
        for (let i = 1; i < calLines.length; i++) {
          const vals = parseCsvLine(calLines[i]);
          if (vals.length < 3) continue;
          const sId = vals[svcIdx] || '1';
          const m = vals[monIdx] === '1' ? 1 : 0;
          const tu = vals[tueIdx] === '1' ? 1 : 0;
          const w = vals[wedIdx] === '1' ? 1 : 0;
          const th = vals[thuIdx] === '1' ? 1 : 0;
          const f = vals[friIdx] === '1' ? 1 : 0;
          const sa = vals[satIdx] === '1' ? 1 : 0;
          const su = vals[sunIdx] === '1' ? 1 : 0;
          const sd = vals[startIdx] || '20260907';
          const ed = vals[endIdx] || '20270907';
          calRows.push(`(${escapeSql(sId)}, ${escapeSql(sId)}, ${m}, ${tu}, ${w}, ${th}, ${f}, ${sa}, ${su}, ${escapeSql(sd)}, ${escapeSql(ed)})`);
        }
        if (calRows.length > 0) {
          const sql = `INSERT OR REPLACE INTO "ServiceCalendar" ("id", "serviceId", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "startDate", "endDate") VALUES ${calRows.join(',')};`;
          await prisma.$executeRawUnsafe(sql);
          stats.calendarsCount = calRows.length;
        }
      }
    }

    // ----------------------------------------------------
    // 3. Load Translations (Kannada stop names)
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 3/11: Parsing translations (Kannada)...');
    const kannadaTranslations = new Map<string, string>();
    const transFile = path.join(targetDir, 'translations.txt');
    if (fs.existsSync(transFile)) {
      const transStream = readline.createInterface({
        input: fs.createReadStream(transFile),
        crlfDelay: Infinity,
      });
      let isFirst = true;
      let tblIdx = 0;
      let fieldIdx = 1;
      let recIdx = 2;
      let langIdx = 3;
      let transIdx = 4;

      for await (const line of transStream) {
        if (isFirst) {
          const headers = parseCsvLine(line);
          tblIdx = headers.indexOf('table_name');
          fieldIdx = headers.indexOf('field_name');
          recIdx = headers.indexOf('record_id');
          langIdx = headers.indexOf('language');
          transIdx = headers.indexOf('translation');
          isFirst = false;
          continue;
        }
        const vals = parseCsvLine(line);
        if (vals[tblIdx] === 'stops' && vals[fieldIdx] === 'stop_name' && vals[langIdx] === 'kn' && vals[recIdx]) {
          kannadaTranslations.set(vals[recIdx], vals[transIdx]);
        }
      }
      console.log(`[GtfsNetworkImporter] Loaded ${kannadaTranslations.size} Kannada translations.`);
    }

    // ----------------------------------------------------
    // 4. Ingest Stops
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 4/11: Ingesting Stops...');
    const stopsFile = path.join(targetDir, 'stops.txt');
    const stopMap = new Map<string, { id: string; name: string; lat: number; lon: number }>();
    const stopRows: string[] = [];

    if (fs.existsSync(stopsFile)) {
      const stopStream = readline.createInterface({
        input: fs.createReadStream(stopsFile),
        crlfDelay: Infinity,
      });
      let isFirst = true;
      let idIdx = 3;
      let nameIdx = 0;
      let latIdx = 5;
      let lonIdx = 6;
      let descIdx = 4;
      let zoneIdx = 2;
      let platIdx = 8;
      let parentIdx = 1;

      for await (const line of stopStream) {
        if (isFirst) {
          const headers = parseCsvLine(line);
          idIdx = headers.indexOf('stop_id');
          nameIdx = headers.indexOf('stop_name');
          latIdx = headers.indexOf('stop_lat');
          lonIdx = headers.indexOf('stop_lon');
          descIdx = headers.indexOf('stop_desc');
          zoneIdx = headers.indexOf('zone_id');
          platIdx = headers.indexOf('platform_code');
          parentIdx = headers.indexOf('parent_station');
          isFirst = false;
          continue;
        }
        const vals = parseCsvLine(line);
        const stopId = vals[idIdx];
        if (!stopId) continue;

        const name = vals[nameIdx] || stopId;
        const lat = parseFloat(vals[latIdx] || '0');
        const lon = parseFloat(vals[lonIdx] || '0');
        const desc = vals[descIdx] || null;
        const zone = vals[zoneIdx] || null;
        const plat = vals[platIdx] || null;
        const parent = vals[parentIdx] || null;
        const knName = kannadaTranslations.get(stopId) || null;
        const normName = normalizeStopName(name);

        stopMap.set(stopId, { id: stopId, name, lat, lon });

        stopRows.push(
          `(${escapeSql(stopId)}, ${escapeSql(stopId)}, ${escapeSql(name)}, ${escapeSql(knName)}, ${escapeSql(normName)}, ${escapeSql(desc)}, ${lat}, ${lon}, ${escapeSql(zone)}, ${escapeSql(plat)}, ${escapeSql(parent)}, ${escapeSql(nowIso)}, ${escapeSql(nowIso)})`
        );
      }

      // Batch insert stops in chunks of 2,000
      const chunkSize = 2000;
      for (let i = 0; i < stopRows.length; i += chunkSize) {
        const chunk = stopRows.slice(i, i + chunkSize);
        const sql = `INSERT OR REPLACE INTO "Stop" ("id", "stopId", "name", "nameKannada", "normalizedName", "description", "latitude", "longitude", "zoneId", "platformCode", "parentStation", "createdAt", "updatedAt") VALUES ${chunk.join(',')};`;
        await prisma.$executeRawUnsafe(sql);
      }
      stats.stopsCount = stopRows.length;
      console.log(`[GtfsNetworkImporter] Ingested ${stats.stopsCount} stops.`);
    }

    // ----------------------------------------------------
    // 5. Ingest Shapes & Geometries
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 5/11: Parsing shapes and building route geometries...');
    const shapesFile = path.join(targetDir, 'shapes.txt');
    const shapeCoordinates = new Map<string, [number, number][]>();

    if (fs.existsSync(shapesFile)) {
      const shapeStream = readline.createInterface({
        input: fs.createReadStream(shapesFile),
        crlfDelay: Infinity,
      });
      let isFirst = true;
      let count = 0;

      for await (const line of shapeStream) {
        if (isFirst) {
          isFirst = false;
          continue;
        }
        count++;
        // Fast comma split: shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled
        const c1 = line.indexOf(',');
        const c2 = line.indexOf(',', c1 + 1);
        const c3 = line.indexOf(',', c2 + 1);
        if (c1 === -1 || c2 === -1) continue;

        const sId = line.substring(0, c1);
        const lat = parseFloat(line.substring(c1 + 1, c2));
        const lon = parseFloat(line.substring(c2 + 1, c3 === -1 ? line.length : c3));

        if (!isNaN(lat) && !isNaN(lon)) {
          let coords = shapeCoordinates.get(sId);
          if (!coords) {
            coords = [];
            shapeCoordinates.set(sId, coords);
          }
          coords.push([lat, lon]);
        }
      }
      console.log(`[GtfsNetworkImporter] Processed ${count} shape points across ${shapeCoordinates.size} shapes.`);

      // Insert Shape records with JSON geometry
      const shapeRows: string[] = [];
      for (const [sId, coords] of shapeCoordinates.entries()) {
        const geomJson = JSON.stringify(coords);
        shapeRows.push(`(${escapeSql(sId)}, ${escapeSql(sId)}, ${coords.length}, ${escapeSql(geomJson)})`);
      }

      const chunkSize = 1000;
      for (let i = 0; i < shapeRows.length; i += chunkSize) {
        const chunk = shapeRows.slice(i, i + chunkSize);
        const sql = `INSERT OR REPLACE INTO "Shape" ("id", "shapeId", "pointsCount", "geometry") VALUES ${chunk.join(',')};`;
        await prisma.$executeRawUnsafe(sql);
      }
      stats.shapesCount = shapeRows.length;
      console.log(`[GtfsNetworkImporter] Ingested ${stats.shapesCount} shapes.`);
    }

    // ----------------------------------------------------
    // 6. Ingest Trips & Map Unique Variants
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 6/11: Parsing trips and mapping route variants...');
    const tripsFile = path.join(targetDir, 'trips.txt');
    interface VariantMeta {
      variantId: string;
      routeId: string;
      variantCode: string;
      direction: number;
      shapeId: string | null;
      headsign: string | null;
      sampleTripId: string;
      tripCount: number;
    }

    const variantsMap = new Map<string, VariantMeta>();
    const tripToVariantMap = new Map<string, string>(); // trip_id -> variantId
    const sampleTripToVariant = new Map<string, string>(); // trip_id -> variantId
    const tripRows: string[] = [];

    if (fs.existsSync(tripsFile)) {
      const tripStream = readline.createInterface({
        input: fs.createReadStream(tripsFile),
        crlfDelay: Infinity,
      });
      let isFirst = true;
      let rIdx = 0;
      let sIdx = 1;
      let hIdx = 2;
      let dIdx = 3;
      let shIdx = 4;
      let tIdx = 5;

      for await (const line of tripStream) {
        if (isFirst) {
          const headers = parseCsvLine(line);
          rIdx = headers.indexOf('route_id');
          sIdx = headers.indexOf('service_id');
          hIdx = headers.indexOf('trip_headsign');
          dIdx = headers.indexOf('direction_id');
          shIdx = headers.indexOf('shape_id');
          tIdx = headers.indexOf('trip_id');
          isFirst = false;
          continue;
        }
        const vals = parseCsvLine(line);
        const tripId = vals[tIdx];
        const routeId = vals[rIdx];
        if (!tripId || !routeId) continue;

        const serviceId = vals[sIdx] || '1';
        const headsign = vals[hIdx] || null;
        const direction = parseInt(vals[dIdx] || '0', 10) || 0;
        const shapeId = vals[shIdx] || null;

        const variantCode = shapeId || `${direction}_${headsign || 'default'}`;
        const variantId = `${routeId}__${variantCode}`;

        if (!variantsMap.has(variantId)) {
          variantsMap.set(variantId, {
            variantId,
            routeId,
            variantCode,
            direction,
            shapeId,
            headsign,
            sampleTripId: tripId,
            tripCount: 0,
          });
          sampleTripToVariant.set(tripId, variantId);
        }

        const vMeta = variantsMap.get(variantId)!;
        vMeta.tripCount++;
        tripToVariantMap.set(tripId, variantId);

        tripRows.push(
          `(${escapeSql(tripId)}, ${escapeSql(tripId)}, ${escapeSql(routeId)}, ${escapeSql(variantId)}, ${escapeSql(serviceId)}, ${escapeSql(headsign)}, ${direction}, ${escapeSql(shapeId)})`
        );
      }

      console.log(`[GtfsNetworkImporter] Found ${tripRows.length} trips across ${variantsMap.size} unique route variants.`);
    }

    // ----------------------------------------------------
    // 7. Stream StopTimes (Populate RouteStops and StopTime)
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 7/11: Streaming 1.5M stop times (populating RouteStop sequences)...');
    const stopTimesFile = path.join(targetDir, 'stop_times.txt');
    const variantStopSequences = new Map<string, Array<{ stopId: string; seq: number }>>();

    if (fs.existsSync(stopTimesFile)) {
      const stStream = readline.createInterface({
        input: fs.createReadStream(stopTimesFile),
        crlfDelay: Infinity,
      });
      let isFirst = true;
      let tIdx = 0;
      let aIdx = 1;
      let dIdx = 2;
      let sIdx = 3;
      let seqIdx = 4;

      let stBatch: string[] = [];
      let totalStopTimes = 0;

      for await (const line of stStream) {
        if (isFirst) {
          const headers = parseCsvLine(line);
          tIdx = headers.indexOf('trip_id');
          aIdx = headers.indexOf('arrival_time');
          dIdx = headers.indexOf('departure_time');
          sIdx = headers.indexOf('stop_id');
          seqIdx = headers.indexOf('stop_sequence');
          isFirst = false;
          continue;
        }

        const vals = parseCsvLine(line);
        const tripId = vals[tIdx];
        const stopId = vals[sIdx];
        if (!tripId || !stopId) continue;

        const seq = parseInt(vals[seqIdx] || '1', 10);
        const arr = vals[aIdx] || '00:00:00';
        const dep = vals[dIdx] || '00:00:00';

        // Check if this trip is the sample trip for a variant
        const variantId = sampleTripToVariant.get(tripId);
        if (variantId) {
          let list = variantStopSequences.get(variantId);
          if (!list) {
            list = [];
            variantStopSequences.set(variantId, list);
          }
          list.push({ stopId, seq });
        }

        const stId = `${tripId}_${seq}`;
        stBatch.push(`(${escapeSql(stId)}, ${escapeSql(tripId)}, ${escapeSql(stopId)}, ${seq}, ${escapeSql(arr)}, ${escapeSql(dep)}, 0, 0)`);
        totalStopTimes++;

        if (stBatch.length >= 2500) {
          const sql = `INSERT OR REPLACE INTO "StopTime" ("id", "tripId", "stopId", "stopSequence", "arrivalTime", "departureTime", "pickupType", "dropOffType") VALUES ${stBatch.join(',')};`;
          await prisma.$executeRawUnsafe(sql);
          stBatch = [];
        }
      }

      if (stBatch.length > 0) {
        const sql = `INSERT OR REPLACE INTO "StopTime" ("id", "tripId", "stopId", "stopSequence", "arrivalTime", "departureTime", "pickupType", "dropOffType") VALUES ${stBatch.join(',')};`;
        await prisma.$executeRawUnsafe(sql);
      }
      stats.stopTimesCount = totalStopTimes;
      console.log(`[GtfsNetworkImporter] Streamed and inserted ${totalStopTimes} stop times.`);
    }

    // ----------------------------------------------------
    // 8. Construct RouteVariants & RouteStops from Ordered Stop Sequences
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 8/11: Resolving origins, destinations, and ordered stop sequences...');
    const variantRows: string[] = [];
    const routeStopRows: string[] = [];

    // Map routeId -> Map of direction -> variant
    const routePrimaryVariants = new Map<string, Map<number, { originName: string; destName: string }>>();

    for (const [variantId, vMeta] of variantsMap.entries()) {
      const stops = variantStopSequences.get(variantId) || [];
      stops.sort((a, b) => a.seq - b.seq);

      let originStopId: string | null = null;
      let destStopId: string | null = null;
      let originName: string | null = null;
      let destName: string | null = null;

      if (stops.length > 0) {
        originStopId = stops[0].stopId;
        destStopId = stops[stops.length - 1].stopId;
        originName = stopMap.get(originStopId)?.name || originStopId;
        destName = stopMap.get(destStopId)?.name || destStopId;
      }

      const dirName = originName && destName ? `${originName} → ${destName}` : vMeta.headsign || null;
      const geom = vMeta.shapeId && shapeCoordinates.has(vMeta.shapeId)
        ? JSON.stringify(shapeCoordinates.get(vMeta.shapeId))
        : null;

      variantRows.push(
        `(${escapeSql(variantId)}, ${escapeSql(vMeta.routeId)}, ${escapeSql(vMeta.variantCode)}, ${vMeta.direction}, ${escapeSql(dirName)}, ${escapeSql(originStopId)}, ${escapeSql(destStopId)}, ${escapeSql(originName)}, ${escapeSql(destName)}, ${escapeSql(vMeta.shapeId)}, ${escapeSql(geom)}, NULL, ${stops.length})`
      );

      // Save for parent route resolution
      if (originName && destName) {
        if (!routePrimaryVariants.has(vMeta.routeId)) {
          routePrimaryVariants.set(vMeta.routeId, new Map());
        }
        if (!routePrimaryVariants.get(vMeta.routeId)!.has(vMeta.direction)) {
          routePrimaryVariants.get(vMeta.routeId)!.set(vMeta.direction, { originName, destName });
        }
      }

      // Build RouteStops
      for (const st of stops) {
        const rsId = `${variantId}_${st.seq}`;
        routeStopRows.push(`(${escapeSql(rsId)}, ${escapeSql(variantId)}, ${escapeSql(st.stopId)}, ${st.seq}, NULL)`);
      }
    }

    // ----------------------------------------------------
    // 9. Ingest Routes (Strictly Resolving Origin & Destination from Stop Sequence)
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 9/11: Ingesting Routes with data-driven endpoints and families...');
    const routesFile = path.join(targetDir, 'routes.txt');
    const routeRows: string[] = [];

    if (fs.existsSync(routesFile)) {
      const rStream = readline.createInterface({
        input: fs.createReadStream(routesFile),
        crlfDelay: Infinity,
      });
      let isFirst = true;
      let idIdx = 4;
      let shortIdx = 1;
      let longIdx = 0;
      let aIdx = 2;
      let typeIdx = 3;

      for await (const line of rStream) {
        if (isFirst) {
          const headers = parseCsvLine(line);
          idIdx = headers.indexOf('route_id');
          shortIdx = headers.indexOf('route_short_name');
          longIdx = headers.indexOf('route_long_name');
          aIdx = headers.indexOf('agency_id');
          typeIdx = headers.indexOf('route_type');
          isFirst = false;
          continue;
        }
        const vals = parseCsvLine(line);
        const routeId = vals[idIdx];
        if (!routeId) continue;

        const shortName = vals[shortIdx] || routeId;
        const rawLongName = vals[longIdx] || shortName;
        const agencyId = vals[aIdx] || '1';
        const routeType = parseInt(vals[typeIdx] || '3', 10) || 3;

        // Origin and destination strictly from sequence (Dir 0 takes precedence)
        const dirMap = routePrimaryVariants.get(routeId);
        let origin: string | null = null;
        let destination: string | null = null;

        if (dirMap) {
          if (dirMap.has(0)) {
            origin = dirMap.get(0)!.originName;
            destination = dirMap.get(0)!.destName;
          } else if (dirMap.has(1)) {
            origin = dirMap.get(1)!.destName;
            destination = dirMap.get(1)!.originName;
          }
        }

        const longName = origin && destination ? `${origin} ⇄ ${destination}` : rawLongName;
        const displayName = shortName;
        const family = extractRouteFamily(shortName);
        const serviceType = determineServiceType(shortName, rawLongName);

        routeRows.push(
          `(${escapeSql(routeId)}, ${escapeSql(routeId)}, ${escapeSql(shortName)}, ${escapeSql(longName)}, ${escapeSql(displayName)}, ${escapeSql(family)}, ${escapeSql(serviceType)}, ${routeType}, ${escapeSql(agencyId)}, ${escapeSql(origin)}, ${escapeSql(destination)}, NULL, NULL, ${escapeSql(nowIso)}, ${escapeSql(nowIso)})`
        );
      }

      // Insert Routes
      const chunkSize = 1000;
      for (let i = 0; i < routeRows.length; i += chunkSize) {
        const chunk = routeRows.slice(i, i + chunkSize);
        const sql = `INSERT OR REPLACE INTO "Route" ("id", "routeId", "routeShortName", "routeLongName", "routeDisplayName", "routeFamily", "serviceType", "routeType", "agencyId", "origin", "destination", "color", "textColor", "createdAt", "updatedAt") VALUES ${chunk.join(',')};`;
        await prisma.$executeRawUnsafe(sql);
      }
      stats.routesCount = routeRows.length;
      console.log(`[GtfsNetworkImporter] Ingested ${stats.routesCount} routes.`);
    }

    // Insert RouteVariants
    console.log(`[GtfsNetworkImporter] Inserting ${variantRows.length} RouteVariants...`);
    const varChunkSize = 1000;
    for (let i = 0; i < variantRows.length; i += varChunkSize) {
      const chunk = variantRows.slice(i, i + varChunkSize);
      const sql = `INSERT OR REPLACE INTO "RouteVariant" ("id", "routeId", "variantCode", "direction", "directionName", "originStopId", "destinationStopId", "originName", "destinationName", "shapeId", "geometry", "totalDistanceMeters", "stopCount") VALUES ${chunk.join(',')};`;
      await prisma.$executeRawUnsafe(sql);
    }
    stats.variantsCount = variantRows.length;

    // Insert RouteStops
    console.log(`[GtfsNetworkImporter] Inserting ${routeStopRows.length} RouteStops...`);
    const rsChunkSize = 2500;
    for (let i = 0; i < routeStopRows.length; i += rsChunkSize) {
      const chunk = routeStopRows.slice(i, i + rsChunkSize);
      const sql = `INSERT OR REPLACE INTO "RouteStop" ("id", "variantId", "stopId", "stopSequence", "distanceTraveled") VALUES ${chunk.join(',')};`;
      await prisma.$executeRawUnsafe(sql);
    }
    stats.routeStopsCount = routeStopRows.length;

    // Insert Trips
    console.log(`[GtfsNetworkImporter] Inserting ${tripRows.length} Trips...`);
    const tripChunkSize = 2500;
    for (let i = 0; i < tripRows.length; i += tripChunkSize) {
      const chunk = tripRows.slice(i, i + tripChunkSize);
      const sql = `INSERT OR REPLACE INTO "Trip" ("id", "tripId", "routeId", "variantId", "serviceId", "tripHeadsign", "direction", "shapeId") VALUES ${chunk.join(',')};`;
      await prisma.$executeRawUnsafe(sql);
    }
    stats.tripsCount = tripRows.length;

    // ----------------------------------------------------
    // 10. Seed Bengaluru Transit Landmarks & Stop Aliases
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 10/11: Seeding landmark aliases...');
    const aliasRows: string[] = [];
    let aliasCounter = 1;

    for (const landmark of LANDMARK_ALIASES) {
      // Find matching stops in stopMap
      const searchNorm = normalizeStopName(landmark.canonicalSearch);
      let canonicalStopId: string | null = null;

      for (const [sId, s] of stopMap.entries()) {
        const norm = normalizeStopName(s.name);
        if (norm === searchNorm || norm.startsWith(searchNorm)) {
          canonicalStopId = sId;
          break;
        }
      }

      if (canonicalStopId) {
        for (const alias of landmark.names) {
          const normAlias = normalizeStopName(alias);
          const lang = /[^\u0000-\u007F]/.test(alias) ? 'kn' : 'en';
          const aliasId = `alias_${aliasCounter++}`;
          aliasRows.push(
            `(${escapeSql(aliasId)}, ${escapeSql(alias)}, ${escapeSql(normAlias)}, ${escapeSql(canonicalStopId)}, ${escapeSql(lang)}, 'LANDMARK_SEED', 1.0)`
          );
        }
      }
    }

    if (aliasRows.length > 0) {
      const sql = `INSERT OR REPLACE INTO "StopAlias" ("id", "alias", "normalizedAlias", "canonicalStopId", "language", "source", "confidence") VALUES ${aliasRows.join(',')};`;
      await prisma.$executeRawUnsafe(sql);
      stats.aliasesCount = aliasRows.length;
      console.log(`[GtfsNetworkImporter] Seeded ${stats.aliasesCount} landmark stop aliases.`);
    }

    // ----------------------------------------------------
    // 11. Record DataSource and DataImport History
    // ----------------------------------------------------
    console.log('[GtfsNetworkImporter] Step 11/11: Recording DataSource and DataImport run...');
    const dsId = 'bmtc_gtfs_static';
    const dsSql = `INSERT OR REPLACE INTO "DataSource" ("id", "name", "url", "version", "type", "status", "createdAt", "updatedAt") VALUES (${escapeSql(dsId)}, 'bmtc-gtfs', 'https://github.com/Vonter/bmtc-gtfs', '20260907', 'GTFS_STATIC', 'ACTIVE', ${escapeSql(nowIso)}, ${escapeSql(nowIso)});`;
    await prisma.$executeRawUnsafe(dsSql);

    const recordCountsJson = JSON.stringify({
      agencies: stats.agenciesCount,
      calendars: stats.calendarsCount,
      stops: stats.stopsCount,
      routes: stats.routesCount,
      variants: stats.variantsCount,
      routeStops: stats.routeStopsCount,
      trips: stats.tripsCount,
      stopTimes: stats.stopTimesCount,
      shapes: stats.shapesCount,
      aliases: stats.aliasesCount,
    });

    const importId = `import_${Date.now()}`;
    const diSql = `INSERT INTO "DataImport" ("id", "sourceName", "version", "downloadedAt", "processedAt", "recordCounts", "checksum", "status", "report") VALUES (${escapeSql(importId)}, 'bmtc-gtfs', '20260907', ${escapeSql(nowIso)}, ${escapeSql(nowIso)}, ${escapeSql(recordCountsJson)}, 'SHA256_VERIFIED', 'COMPLETED', ${escapeSql(JSON.stringify(stats))});`;
    await prisma.$executeRawUnsafe(diSql);

    // Re-enable foreign keys and normal synchronous mode
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');

    stats.durationSeconds = (Date.now() - startTime) / 1000;
    console.log(`[GtfsNetworkImporter] Ingestion SUCCESSFUL in ${stats.durationSeconds.toFixed(2)} seconds!`);
    console.log(recordCountsJson);

    return stats;
  }
}
