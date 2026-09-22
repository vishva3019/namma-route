import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import routesRouter from './routes/routes';
import stopsRouter from './routes/stops';
import vehiclesRouter from './routes/vehicles';
import journeyRouter from './routes/journey';
import dataRouter from './routes/data';
import { RoutesController } from './controllers/routesController';
import { StopsController } from './controllers/stopsController';
import { VehiclesController } from './controllers/vehiclesController';
import { apiLimiter, realtimeLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { vehicleService } from './services/vehicleService';
import { gtfsService } from './services/gtfsService';
import { cacheService } from './cache/cacheService';
import prisma from './db/prisma';
import Logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl) or matching frontend
    if (!origin || origin === allowedOrigin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev, configurable in prod
    }
  },
  credentials: true,
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.includes('/api/realtime') && !req.url.includes('/api/health')) {
      Logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/realtime/', realtimeLimiter);

// Base Routes
app.use('/api/routes', routesRouter);
app.use('/api/stops', stopsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/journey', journeyRouter);
app.use('/api/data', dataRouter);

// Debug Routes
app.get('/api/debug/routes/:routeNumber', RoutesController.debugRoute);

// Proximity Nearby Routes
app.get('/api/nearby/stops', StopsController.getNearbyStops);
app.get('/api/nearby/vehicles', VehiclesController.getNearbyVehicles);

// Realtime Engine Routes
app.get('/api/realtime/vehicles', VehiclesController.getRealtimeVehicles);
app.get('/api/realtime/status', VehiclesController.getRealtimeStatus);

// Dashboard Statistics Endpoint
app.get('/api/stats', async (req, res, next) => {
  try {
    const [gtfsStats, realtimeInfo] = await Promise.all([
      gtfsService.getStats(),
      vehicleService.getAllVehicles(),
    ]);

    res.json({
      status: 'SUCCESS',
      data: {
        liveBuses: realtimeInfo.vehicleCount,
        activeRoutes: gtfsStats.routes,
        stops: gtfsStats.stops,
        lastUpdate: realtimeInfo.timestamp || new Date().toISOString(),
        dataAgeSeconds: realtimeInfo.dataAge ?? 0,
        provider: realtimeInfo.provider,
        source: realtimeInfo.source,
        demoMode: realtimeInfo.demoMode ?? false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Health Monitoring Endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'OK';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'DOWN';
  }

  const cacheStatus = cacheService.getStatus().connected ? 'OK' : 'DEGRADED';
  const providerHealth = await vehicleService.getProviderHealth();
  const realtimeData = await vehicleService.getAllVehicles();

  const isHealthy = dbStatus === 'OK';
  res.status(isHealthy ? 200 : 503).json({
    database: dbStatus,
    cache: cacheStatus,
    realtime: realtimeData.status,
    provider: providerHealth.provider,
    providerHealth: providerHealth.status,
    lastUpdate: realtimeData.timestamp || new Date().toISOString(),
    vehicles: realtimeData.vehicleCount,
    source: realtimeData.source,
    demoMode: realtimeData.demoMode ?? false,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// 404 & Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    const isDemo = process.env.DEMO_MODE === 'true';
    const providerName = isDemo ? 'MOCK' : (process.env.REALTIME_PROVIDER?.toUpperCase() === 'MOCK' ? 'MOCK' : 'BMTC');
    const intervalSec = process.env.REALTIME_POLL_INTERVAL || '30';

    console.log(`Realtime provider: ${providerName}`);
    console.log(`Demo mode: ${isDemo}`);
    console.log(`Polling interval: ${intervalSec}s`);

    Logger.info(`🚀 NammaRoute Backend running on port ${PORT}`);
    Logger.info(`Realtime provider: ${providerName}`);
    Logger.info(`Demo mode: ${isDemo}`);
    Logger.info(`Polling interval: ${intervalSec}s`);
    Logger.info(`📍 Health check: http://localhost:${PORT}/api/health`);
    Logger.info(`🚌 Realtime endpoint: http://localhost:${PORT}/api/realtime/vehicles`);
    Logger.info(`🔍 Realtime status: http://localhost:${PORT}/api/realtime/status`);
  });
}

export default app;
