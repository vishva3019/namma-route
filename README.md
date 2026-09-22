# NammaRoute 🚌

> **"Track Bengaluru. Catch the right bus."**

NammaRoute is a production-grade public transit live tracking platform for the Bengaluru Metropolitan Transport Corporation (BMTC) bus network. It pairs comprehensive static General Transit Feed Specification (GTFS) data with real-time vehicle positions, arrival ETAs, route geometry, journey planning, and an animated Leaflet live map.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: Static BMTC GTFS                 │
│   (routes, stops, trips, timetables, shapes, translations)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    GTFS Ingestion   │
                    │  Pipeline & Parser  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    │    (Prisma ORM)     │
                    └──────────┬──────────┘
                               │
┌─────────────────────────┐    │
│  Layer 2: Live BMTC     │    │
│  Configurable Realtime  │    │
│  Adapter (Bmtc/Mock)    │    │
└────────────┬────────────┘    │
             │                 │
             ▼                 │
┌─────────────────────────┐    │
│   BMTC Realtime Engine  │    │
│ (Normalizer, Freshness, │    │
│  Coalescing, Polling)   │    │
└────────────┬────────────┘    │
             │                 │
             ▼                 │
┌─────────────────────────┐    │
│    Cache Layer (TTL)    │    │
│   (Redis / In-Memory)   │    │
└────────────┬────────────┘    │
             │                 │
             └────────┬────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │   NammaRoute REST API     │
        │    (Express + TypeScript) │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │   React + Leaflet Client  │
        │ - Animated Bus Markers    │
        │ - Route Geometry & Stops  │
        │ - Proximity Radar         │
        │ - Journey Planner         │
        │ - Desktop & Mobile Sheet  │
        └───────────────────────────┘
```

---

## ✨ Features

- **Real-Time Bus Tracking**: Smooth SVG marker interpolation (no teleportation) with compass bearing rotation, speed, and status badges (`LIVE` vs `STALE`).
- **Data Freshness Guarantee**:
  - `0–60 sec`: **LIVE** (Emerald pulsing badge)
  - `60–120 sec`: **RECENT**
  - `120–300 sec`: **STALE** ("Data Delayed")
  - `>300 sec`: Filtered from live tracking view.
- **Truthful Multi-Source ETAs**:
  - `LIVE`: Absolute time from live GPS telemetry.
  - `ESTIMATED`: Calculated from current corridor velocity and distance to stop.
  - `SCHEDULED`: Retrieved from scheduled timetable when vehicles are out of range.
- **Proximity Radar**: Finds nearest BMTC stops and active buses within 500m, 1km, 2km, and 5km sorted by walking time. Never permanently stores user GPS coordinates.
- **Corridor Route Explorer**: Interactive route maps, morning/afternoon/evening timetables, stop sequences, and live vehicle count.
- **Multi-Modal Journey Planner**: Solves direct corridors and 1-transfer journeys with transfer buffer estimations.
- **Bilingual Transit Support**: Station names mapped with Kannada (`ಕನ್ನಡ`) translations.
- **Enterprise-Grade Coalescing**: 100 browser clients make 0 redundant upstream calls to BMTC servers; all read from synchronized backend caching.
- **Demo Mode**: Includes a simulated corridor fleet on genuine Bengaluru routes when upstream government endpoints are offline or firewalled.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, TanStack React Query, React Router, Leaflet, React-Leaflet, Lucide React.
- **Backend**: Node.js, Express, TypeScript, Prisma ORM.
- **Database**: PostgreSQL (production) with zero-dependency SQLite local developer support.
- **Caching**: Redis (with automatic in-memory TTL cache fallback).
- **Security**: Rate Limiting (`express-rate-limit`), Helmet, CORS, parameterized queries, and sanitized error responses.

---

## 📁 Project Structure

```
namma-route/
├── frontend/                 # React 18 + Vite + Leaflet UI
│   ├── src/
│   │   ├── components/       # MapView, BusMarker, BusPopup, BottomSheet, etc.
│   │   ├── pages/            # Home, Routes, RouteDetailsPage, Stops, Nearby, Journey
│   │   ├── services/         # API fetchers
│   │   ├── hooks/            # useLiveVehicles, useGeolocation, useRoutes, useStops
│   │   ├── types/            # Route, Stop, Vehicle, ETA, Journey types
│   │   └── utils/            # Distance, time, and vehicle formatters
├── backend/                  # Express + TypeScript REST API
│   ├── src/
│   │   ├── controllers/      # Routes, Stops, Vehicles, Journey controllers
│   │   ├── services/         # RouteService, StopService, VehicleService, JourneyService, DataStatsService
│   │   ├── providers/
│   │   │   ├── bmtc/         # BmtcApiClient, BmtcRealtimeProvider, MockRealtimeProvider
│   │   │   └── gtfs/         # GtfsNetworkImporter, GtfsParser, GtfsValidator
│   │   ├── cache/            # Redis / In-memory dual-mode cache
│   │   ├── db/               # Prisma client singleton
│   │   ├── routes/           # Express routers (routes, stops, vehicles, journey, data)
│   │   └── server.ts         # Server entry point
│   ├── prisma/               # schema.prisma (Postgres) & schema.sqlite.prisma (Dev)
│   ├── scripts/              # import-complete-network.ts, validate-network.ts, network-stats.ts, refresh-network.ts
│   └── tests/                # Vitest automated test suite (37 tests across 6 suites)
├── data/
│   └── gtfs/                 # Full BMTC GTFS dataset (4,434 routes, 9,960 stops, 1.54M stop_times)
├── docs/
│   └── API.md                # Comprehensive REST API specifications
├── .env.example              # Environment template
└── README.md                 # Project guide
```

---

## ⚡ Complete BMTC Network Commands

The project includes CLI scripts to ingest, validate, and query the complete BMTC network (4,434 routes, 9,960 stops, 7,475 variants, 57,836 trips, 1,540,686 stop times, 7,355 shapes):

```bash
# Ingest complete BMTC network from data/gtfs/ in ~25-30s
npm run data:import

# Run data integrity validation (route counts, orphan checks, 356-M verification)
npm run data:validate

# Print dynamic network counts directly from SQLite
npm run data:stats

# Refresh GTFS dataset
npm run data:refresh
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- npm or pnpm

### 1. Clone & Configure Environment
```bash
cp .env.example backend/.env
```

Review `backend/.env`:
```env
PORT=4000
DATABASE_URL="file:./dev.db" # or postgresql://postgres:postgres@localhost:5432/nammaroute
REALTIME_POLL_INTERVAL=30
DEMO_MODE=true # set to false when connecting to live BMTC endpoints
```

### 2. Install Dependencies & Ingest GTFS
```bash
# Backend setup
cd backend
npm install
npm run prisma:generate:sqlite
npm run prisma:push:sqlite

# Ingest BMTC GTFS dataset
npm run gtfs:import

# Run backend tests
npm test
```

### 3. Start Backend API
```bash
npm run dev
# Backend running at http://localhost:4000
```

### 4. Start Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
# Frontend running at http://localhost:5173
```

---

## 🧪 Automated Testing

Run the full Vitest suite verifying GTFS parsing, coordinate bounding box validation, vehicle normalization, freshness classification, distance calculations, and REST endpoints:

```bash
cd backend
npm test
```

---

---

## 📡 Realtime Data Configuration

NammaRoute supports dual operational modes controlled entirely via backend environment variables in `backend/.env`.

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `DEMO_MODE` | `false` | When `true`, activates simulated bus fleets along real routes. When `false`, connects to real BMTC endpoints. |
| `REALTIME_PROVIDER` | `bmtc` | Provider engine (`bmtc` for live BMTC or `mock` for simulated). |
| `BMTC_API_BASE_URL` | `https://bmtcmobileapi.karnataka.gov.in/WebAPI` | Government BMTC mobile API root URL. |
| `BMTC_API_TIMEOUT` | `4000` | HTTP request timeout in milliseconds. |
| `REALTIME_POLL_INTERVAL` | `30` | Interval in seconds between backend vehicle polling cycles (minimum 10s). |
| `CACHE_TTL` | `30` | Redis/Memory cache time-to-live for live vehicle telemetry. |

---

### 🎮 Demo Mode (`DEMO_MODE=true`)

Demo mode enables development, testing, and UI presentations without requiring upstream network connectivity to government servers.

- **Provider**: `MockRealtimeProvider` (`provider: "MOCK_DEMO_PROVIDER"`)
- **Source Attribute**: All vehicles and payloads are stamped with `"source": "DEMO"`.
- **Physics Simulation**: Simulated buses travel along actual BMTC route geometries parsed from GTFS `shapes.txt` and stop sequences, with variable speeds (22–40 km/h) and dynamic bearings.
- **Activation**:
  ```env
  DEMO_MODE=true
  REALTIME_PROVIDER=mock
  ```
- **Response Format (`GET /api/realtime/vehicles`)**:
  ```json
  {
    "status": "LIVE",
    "provider": "MOCK_DEMO_PROVIDER",
    "source": "DEMO",
    "timestamp": "2026-09-22T14:10:00.000Z",
    "dataAge": 0,
    "vehicleCount": 10,
    "vehicles": [...],
    "demoMode": true
  }
  ```

---

### 🛰️ Real BMTC Mode (`DEMO_MODE=false`)

In real BMTC mode, NammaRoute polls live vehicle telemetry directly from the BMTC backend.

- **Provider**: `BmtcRealtimeProvider` (`provider: "BMTC_REALTIME"`)
- **Source Attribute**: All vehicles and payloads are stamped with `"source": "BMTC"`.
- **Telemetry Endpoints Used**:
  - `POST /SearchByRouteDetails_v4` (`{"routeid": ..., "servicetypeid": 0}`) — retrieves live vehicle coordinates and ETAs on active corridors.
  - `POST /SearchRoute_v2` (`{"routetext": ...}`) — resolves route numbers to route parent IDs.
  - `POST /VehicleTripDetails_v2` (`{"vehicleId": ...}`) — retrieves high-resolution trip positions.
- **Normalization & Validation Rules**:
  - **Bengaluru Bounding Box**: Discards any coordinates outside Latitude `12.60` to `13.40` and Longitude `77.20` to `77.95`.
  - **Freshness Classification**:
    - `0–60s`: `LIVE`
    - `60–120s`: `RECENT`
    - `120–300s`: `STALE`
    - `>300s`: Dropped from live tracking.
  - **Strict Null Handling**: Never fabricates fake registration numbers, coordinates, or ghost buses.
- **Strict Non-Fallback Guarantee**: If the upstream BMTC API is unreachable, firewalled, returns HTTP 403 Forbidden, or times out, NammaRoute **never falls back silently to mock data**. Instead, it returns an explicit `UNAVAILABLE` diagnostic payload:
  ```json
  {
    "status": "UNAVAILABLE",
    "provider": "BMTC_REALTIME",
    "source": "BMTC",
    "vehicleCount": 0,
    "vehicles": [],
    "error": "Realtime BMTC data unavailable"
  }
  ```
- **Activation**:
  ```env
  DEMO_MODE=false
  REALTIME_PROVIDER=bmtc
  BMTC_API_BASE_URL="https://bmtcmobileapi.karnataka.gov.in/WebAPI"
  ```

---

### 🔍 Provider Health Checks & Diagnostics

#### 1. Backend Diagnostic Endpoint: `GET /api/realtime/status`
Returns real-time operational metrics of the active provider:
```json
{
  "provider": "BMTC_REALTIME",
  "configured": true,
  "reachable": true,
  "lastSuccessfulUpdate": "2026-09-22T14:10:24.108Z",
  "lastAttempt": "2026-09-22T14:10:12.944Z",
  "vehicleCount": 122,
  "dataAge": 8,
  "error": null
}
```

If upstream BMTC servers are offline or blocking traffic:
```json
{
  "provider": "BMTC_REALTIME",
  "configured": true,
  "reachable": false,
  "lastSuccessfulUpdate": null,
  "lastAttempt": "2026-09-22T14:10:12.944Z",
  "vehicleCount": 0,
  "dataAge": 0,
  "error": "Realtime BMTC data unavailable: Upstream BMTC server returned 403 Forbidden"
}
```

#### 2. System Health Endpoint: `GET /api/health`
Returns overall system status (Database, Cache, Realtime Provider, Uptime).

#### 3. Startup Logging
When the backend starts up, the configured provider settings are output directly to the console:
```text
Realtime provider: BMTC
Demo mode: false
Polling interval: 30s
🚀 NammaRoute Backend running on port 4000
📍 Health check: http://localhost:4000/api/health
🚌 Realtime endpoint: http://localhost:4000/api/realtime/vehicles
🔍 Realtime status: http://localhost:4000/api/realtime/status
```

---

### 🔧 Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `status: "UNAVAILABLE"` with `HTTP 403 Forbidden` | Upstream BMTC endpoints (`bmtcmobileapi.karnataka.gov.in`) enforce IP geo-fencing or firewalls on certain networks. | Verify network connectivity or switch to `DEMO_MODE=true` in `backend/.env` for local testing. |
| `vehicleCount: 0` in Real Mode | Upstream server timed out or returned no active trips for queried corridors. | Check `GET /api/realtime/status` to view `reachable` and `error` details. You can increase `BMTC_API_TIMEOUT=6000` in `.env`. |
| Coordinates not displaying on map | Telemetry coordinate fell outside Bengaluru bounding box (`12.60–13.40`, `77.20–77.95`). | Coordinate is automatically discarded by `BmtcNormalizer` to prevent map distortion. |
| `EADDRINUSE: address already in use :::4000` | Port 4000 is occupied by another process. | Change `PORT=4001` in `backend/.env` or terminate the existing process. |

---

## 🛰️ Realtime Provider Abstraction

All live telemetry operations are decoupled behind the `RealtimeProvider` interface:

```typescript
export interface RealtimeProvider {
  readonly name: string;
  getVehicles(): Promise<NormalizedVehicle[]>;
  getVehiclesByRoute(routeId: string): Promise<NormalizedVehicle[]>;
  getVehicle(vehicleId: string): Promise<NormalizedVehicle | null>;
  getHealth(): Promise<ProviderHealth>;
  getStatus(): RealtimeProviderStatus;
}
```

### Switching to an Official BMTC GTFS-RT Feed
When an official GTFS-Realtime Protobuf feed (`VehiclePositions.pb`) is issued by BMTC, simply implement:

```typescript
export class OfficialGtfsRealtimeProvider implements RealtimeProvider {
  // Feed reading & parsing logic
}
```
And set `REALTIME_PROVIDER=gtfs_rt` in `.env`. No frontend code changes are required.

---

## 🚢 Production Deployment

### Frontend (Vercel / Netlify / Cloudflare Pages)
```bash
cd frontend
npm run build
# Deploy the 'dist' directory
```

### Backend (Render / Railway / Fly.io)
1. Provision a managed PostgreSQL instance (Supabase, Neon, or Railway).
2. Set `DATABASE_URL=postgresql://...`
3. Run migrations:
   ```bash
   npx prisma db push --schema=prisma/schema.prisma
   npm run gtfs:import
   ```
4. Build and start:
   ```bash
   npm run build
   npm start
   ```

---

## 📜 Data Attribution & Legal Disclaimers

### Data Sources
- **BMTC Static GTFS Dataset**: Derived from the community-maintained BMTC GTFS repository by [Vonter](https://github.com/Vonter/bmtc-gtfs) distributed under the **Open Database License (ODbL)**.
- **Cartography**: &copy; [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- **Live Telemetry**: BMTC realtime provider adapter configured for this deployment.

### Legal Disclaimer
**NammaRoute is an independent civic technology project and is not affiliated with, authorized, or endorsed by the Bangalore Metropolitan Transport Corporation (BMTC) or the Government of Karnataka.** Transit schedules and live GPS positions are provided strictly for informational purposes.
