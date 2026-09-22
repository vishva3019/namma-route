import { Request, Response, NextFunction } from 'express';
import { routeService } from '../services/routeService';
import { vehicleService } from '../services/vehicleService';

export class RoutesController {
  static async getRoutes(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string | undefined;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const data = await routeService.searchRoutes(q, limit, offset);
      res.json({ status: 'SUCCESS', data });
    } catch (err) {
      next(err);
    }
  }

  static async getRouteById(req: Request, res: Response, next: NextFunction) {
    try {
      const routeId = String(req.params.routeId || req.params.routeNumber);
      const route = await routeService.getRouteById(routeId);

      if (!route) {
        return res.status(404).json({
          status: 'ERROR',
          message: `Route not found for ID/Number: ${routeId}`,
        });
      }

      res.json({ status: 'SUCCESS', data: route });
    } catch (err) {
      next(err);
    }
  }

  static async getRouteDirections(req: Request, res: Response, next: NextFunction) {
    try {
      const routeId = String(req.params.routeId || req.params.routeNumber);
      const directions = await routeService.getRouteDirections(routeId);
      res.json({ status: 'SUCCESS', count: directions.length, data: directions });
    } catch (err) {
      next(err);
    }
  }

  static async getRouteStops(req: Request, res: Response, next: NextFunction) {
    try {
      const routeId = String(req.params.routeId || req.params.routeNumber);
      const direction = parseInt(req.query.direction as string, 10) || 0;
      const stops = await routeService.getRouteStops(routeId, direction);
      res.json({ status: 'SUCCESS', direction, count: stops.length, data: stops });
    } catch (err) {
      next(err);
    }
  }

  static async getRouteTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const routeId = String(req.params.routeId || req.params.routeNumber);
      const direction = parseInt(req.query.direction as string, 10) || 0;
      const timetable = await routeService.getRouteTimetable(routeId, direction);
      res.json({ status: 'SUCCESS', direction, count: timetable.length, data: timetable });
    } catch (err) {
      next(err);
    }
  }

  static async getRouteVehicles(req: Request, res: Response, next: NextFunction) {
    try {
      const routeId = String(req.params.routeId || req.params.routeNumber);
      const vehicles = await vehicleService.getVehiclesByRoute(routeId);
      res.json({ status: 'SUCCESS', count: vehicles.length, data: vehicles });
    } catch (err) {
      next(err);
    }
  }

  static async debugRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const routeId = String(req.params.routeId || req.params.routeNumber);
      const debugData = await routeService.debugRoute(routeId);
      res.json({ status: 'SUCCESS', data: debugData });
    } catch (err) {
      next(err);
    }
  }
}
