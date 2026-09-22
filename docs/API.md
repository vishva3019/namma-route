# NammaRoute REST API Documentation

"Track Bengaluru. Catch the right bus."

NammaRoute exposes a high-performance, rate-limited REST API designed to serve static GTFS schedules, route geometries, stops, live vehicle positions, multi-source ETAs, and journey planning for Bengaluru's BMTC network.

---

## Base URL
```
http://localhost:4000/api
```

---

## Authentication & Headers
- No private tokens or credentials are leaked to or required from clients.
- Rate limits:
  - Standard API: 120 requests / min / IP (`/api/*`)
  - Realtime Polling: 60 requests / min / IP (`/api/realtime/*`)

---

## Summary of Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health (Database, Cache, Realtime feed, Uptime) |
| `GET` | `/api/stats` | Dashboard statistics (Live buses, Active routes, Stops) |
| `GET` | `/api/routes` | Search and list routes |
| `GET` | `/api/routes/:routeId` | Route details, geometry, and active buses |
| `GET` | `/api/routes/:routeId/stops` | Ordered list of stops for this route |
| `GET` | `/api/routes/:routeId/vehicles` | Vehicles currently operating on this route |
| `GET` | `/api/stops` | Search and list stops |
| `GET` | `/api/stops/:stopId` | Stop details and serving routes |
| `GET` | `/api/stops/:stopId/vehicles` | Vehicles approaching this stop |
| `GET` | `/api/stops/:stopId/eta` | Upcoming arrivals with `LIVE`, `ESTIMATED`, `SCHEDULED` tags |
| `GET` | `/api/vehicles` | Active tracked vehicle fleet |
| `GET` | `/api/vehicles/:vehicleId` | Single vehicle telemetry, bearing, and speed |
| `GET` | `/api/nearby/stops` | Stops within radius sorted by walking distance |
| `GET` | `/api/nearby/vehicles` | Live buses within radius |
| `GET` | `/api/journey` | Journey planner: direct & 1-transfer routes |
| `GET` | `/api/realtime/vehicles` | Sanitized live vehicle fleet status |
| `GET` | `/api/realtime/status` | Realtime provider diagnostics |

---

## Detailed Endpoint Specifications

### 1. Health Monitoring
**`GET /api/health`**

Returns health status of the database, cache layer, and live provider adapter.

#### Response: `200 OK`
```json
{
  "database": "OK",
  "cache": "OK",
  "realtime": "LIVE",
  "provider": "BMTC_REALTIME",
  "providerHealth": "HEALTHY",
  "lastUpdate": "2026-09-22T12:45:00.000Z",
  "vehicles": 128,
  "demoMode": false,
  "uptimeSeconds": 1420
}
```

---

### 2. Dashboard Statistics
**`GET /api/stats`**

Provides non-hardcoded counts of active transit assets.

#### Response: `200 OK`
```json
{
  "status": "SUCCESS",
  "data": {
    "liveBuses": 24,
    "activeRoutes": 10,
    "stops": 52,
    "lastUpdate": "2026-09-22T12:45:00.000Z",
    "dataAgeSeconds": 18,
    "provider": "BMTC_REALTIME",
    "demoMode": false
  }
}
```

---

### 3. Routes

#### `GET /api/routes`
Search routes by number, origin, or destination.

**Query Parameters:**
- `q` *(optional)*: Search term (e.g. `500D`, `335E`, `Hebbal`)
- `limit` *(optional, default 50)*: Number of records to return
- `offset` *(optional, default 0)*: Pagination offset

**Response: `200 OK`**
```json
{
  "status": "SUCCESS",
  "data": {
    "total": 10,
    "limit": 50,
    "offset": 0,
    "routes": [
      {
        "id": "clx...",
        "gtfsRouteId": "500-D",
        "routeNumber": "500-D",
        "routeName": "Hebbal Bus Station ↔ Central Silk Board",
        "origin": "Hebbal Bus Station",
        "destination": "Central Silk Board",
        "direction": 0,
        "routeType": 3,
        "activeBusesCount": 2
      }
    ]
  }
}
```

#### `GET /api/routes/:routeId`
Get single route details including polyline geometry and active buses.

**Response: `200 OK`**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": "clx...",
    "gtfsRouteId": "500-D",
    "routeNumber": "500-D",
    "routeName": "Hebbal Bus Station ↔ Central Silk Board",
    "origin": "Hebbal Bus Station",
    "destination": "Central Silk Board",
    "geometry": [
      [12.9176, 77.6234],
      [12.9121, 77.6385],
      [12.9238, 77.6521]
    ],
    "activeBusesCount": 2,
    "liveBuses": [],
    "stops": []
  }
}
```

---

### 4. Stops

#### `GET /api/stops`
Search BMTC stops by English name, Kannada name, or GTFS stop ID.

**Query Parameters:**
- `q` *(optional)*: Query string (e.g. `Majestic`, `ಮಾರತ್‌ಹಳ್ಳಿ`, `KBS`)

**Response: `200 OK`**
```json
{
  "status": "SUCCESS",
  "data": {
    "total": 52,
    "stops": [
      {
        "id": "clx...",
        "gtfsStopId": "KBS",
        "name": "Kempegowda Bus Station (Majestic)",
        "nameKannada": "ಕೆಂಪೇಗೌಡ ಬಸ್ ನಿಲ್ದಾಣ (ಮೆಜೆಸ್ಟಿಕ್)",
        "latitude": 12.9778,
        "longitude": 77.5726,
        "platform": "1A",
        "routes": []
      }
    ]
  }
}
```

#### `GET /api/stops/:stopId/eta`
Upcoming arrivals with strict source classification (`LIVE`, `ESTIMATED`, `SCHEDULED`).

**Response: `200 OK`**
```json
{
  "status": "SUCCESS",
  "count": 3,
  "data": [
    {
      "routeId": "clx...",
      "routeNumber": "500-D",
      "destination": "Central Silk Board",
      "vehicleId": "DEMO-BUS-500-D-1",
      "vehicleNumber": "KA-01-FA-1001",
      "etaMinutes": 6,
      "expectedTime": "18:24",
      "source": "LIVE",
      "distanceMeters": 1850,
      "status": "LIVE"
    },
    {
      "routeId": "clx...",
      "routeNumber": "335-E",
      "destination": "Kadugodi Bus Station",
      "vehicleId": null,
      "vehicleNumber": null,
      "etaMinutes": 18,
      "expectedTime": "18:35",
      "source": "SCHEDULED",
      "distanceMeters": null
    }
  ]
}
```

---

### 5. Nearby Radar

#### `GET /api/nearby/stops`
Find stops within a specified meter radius sorted by distance.

**Query Parameters:**
- `lat`: User latitude (e.g. `12.9716`)
- `lng`: User longitude (e.g. `77.5946`)
- `radius`: Search radius in meters (default: `3000`)

#### `GET /api/nearby/vehicles`
Find live vehicles within a specified radius.

**Query Parameters:**
- `lat`: User latitude
- `lng`: User longitude
- `radius`: Radius in meters (500, 1000, 2000, 5000)

---

### 6. Journey Planner

#### `GET /api/journey`
Calculates optimal direct routes and 1-transfer routes between two BMTC stops.

**Query Parameters:**
- `from`: Origin stop name or ID (e.g. `Majestic`)
- `to`: Destination stop name or ID (e.g. `Electronic City`)

**Response: `200 OK`**
```json
{
  "status": "SUCCESS",
  "from": "Majestic",
  "to": "Electronic City",
  "count": 2,
  "data": [
    {
      "id": "direct-clx...",
      "type": "DIRECT",
      "totalDurationMinutes": 48,
      "totalDistanceKm": 21.4,
      "transferCount": 0,
      "hasLiveBuses": true,
      "legs": [
        {
          "routeId": "clx...",
          "routeNumber": "356-M",
          "routeName": "Kempegowda Bus Station ↔ Electronic City Wipro Gate",
          "fromStop": { "id": "...", "name": "Kempegowda Bus Station (Majestic)" },
          "toStop": { "id": "...", "name": "Electronic City Wipro Gate" },
          "durationMinutes": 48,
          "distanceKm": 21.4,
          "activeBusesCount": 2,
          "geometry": [[12.9778, 77.5726], [12.8452, 77.6602]]
        }
      ]
    }
  ]
}
```

---

### 7. Realtime Stream / Polling

#### `GET /api/realtime/vehicles`
Returns the canonical live vehicle fleet status.

**Response: `200 OK`**
```json
{
  "status": "LIVE",
  "provider": "BMTC_REALTIME",
  "timestamp": "2026-09-22T12:45:10.000Z",
  "dataAge": 12,
  "vehicleCount": 20,
  "vehicles": [
    {
      "id": "DEMO-BUS-500-D-1",
      "vehicleNumber": "KA-01-FA-1001",
      "routeId": "clx...",
      "routeNumber": "500-D",
      "tripId": null,
      "latitude": 12.9344,
      "longitude": 77.6917,
      "bearing": 135,
      "speed": 28,
      "currentStopId": "BELLANDUR",
      "nextStopId": "DEVARABIS",
      "timestamp": "2026-09-22T12:45:10.000Z",
      "freshnessSeconds": 12,
      "status": "LIVE",
      "destination": "Central Silk Board"
    }
  ],
  "demoMode": false
}
```
