import { Request, Response, NextFunction } from 'express';
import { stopService } from '../services/stopService';
import { etaService } from '../services/etaService';
import { vehicleService } from '../services/vehicleService';
import { GeoUtils } from '../utils/geo';

export class StopsController {
  static async getStops(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string | undefined;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const data = await stopService.searchStops(q, limit, offset);
      res.json({ status: 'SUCCESS', data });
    } catch (err) {
      next(err);
    }
  }

  static async getStopById(req: Request, res: Response, next: NextFunction) {
    try {
      const stopId = String(req.params.stopId);
      const stop = await stopService.getStopById(stopId);

      if (!stop) {
        return res.status(404).json({
          status: 'ERROR',
          message: `Stop not found for ID: ${stopId}`,
        });
      }

      res.json({ status: 'SUCCESS', data: stop });
    } catch (err) {
      next(err);
    }
  }

  static async getStopVehicles(req: Request, res: Response, next: NextFunction) {
    try {
      const stopId = String(req.params.stopId);
      const stop = await stopService.getStopById(stopId);
      if (!stop) {
        return res.status(404).json({ status: 'ERROR', message: `Stop not found: ${stopId}` });
      }

      const allVehicles = (await vehicleService.getAllVehicles()).vehicles;
      const servingRouteIds = new Set(stop.routesServing.map((r) => r.id));

      const approaching = allVehicles
        .filter((v) => v.routeId && servingRouteIds.has(v.routeId))
        .map((v) => {
          const dist = GeoUtils.haversineDistanceMeters(v.latitude, v.longitude, stop.latitude, stop.longitude);
          return {
            ...v,
            distanceToStopMeters: Math.round(dist),
          };
        })
        .sort((a, b) => a.distanceToStopMeters - b.distanceToStopMeters);

      res.json({ status: 'SUCCESS', count: approaching.length, data: approaching });
    } catch (err) {
      next(err);
    }
  }

  static async getStopEta(req: Request, res: Response, next: NextFunction) {
    try {
      const stopId = String(req.params.stopId);
      const arrivals = await etaService.getUpcomingArrivals(stopId);
      res.json({ status: 'SUCCESS', count: arrivals.length, data: arrivals });
    } catch (err) {
      next(err);
    }
  }

  static async getNearbyStops(req: Request, res: Response, next: NextFunction) {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 3000;

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Valid latitude and longitude query parameters are required',
        });
      }

      const stops = await stopService.getNearbyStops(lat, lng, radius);
      res.json({ status: 'SUCCESS', count: stops.length, data: stops });
    } catch (err) {
      next(err);
    }
  }
}
