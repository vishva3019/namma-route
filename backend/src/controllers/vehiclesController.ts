import { Request, Response, NextFunction } from 'express';
import { vehicleService } from '../services/vehicleService';
import { stopService } from '../services/stopService';

export class VehiclesController {
  static async getVehicles(req: Request, res: Response, next: NextFunction) {
    try {
      const route = req.query.route as string | undefined;
      if (route) {
        const vehicles = await vehicleService.getVehiclesByRoute(route);
        return res.json({ status: 'SUCCESS', count: vehicles.length, data: vehicles });
      }

      const all = await vehicleService.getAllVehicles();
      res.json({ status: 'SUCCESS', count: all.vehicleCount, data: all.vehicles });
    } catch (err) {
      next(err);
    }
  }

  static async getVehicleById(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicleId = String(req.params.vehicleId);
      const vehicle = await vehicleService.getVehicleById(vehicleId);

      if (!vehicle) {
        return res.status(404).json({
          status: 'ERROR',
          message: `Vehicle not found: ${vehicleId}`,
        });
      }

      res.json({ status: 'SUCCESS', data: vehicle });
    } catch (err) {
      next(err);
    }
  }

  static async getRealtimeVehicles(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await vehicleService.getAllVehicles();
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getRealtimeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = vehicleService.getStatusDiagnostics();
      res.json(status);
    } catch (err) {
      next(err);
    }
  }

  static async getNearbyVehicles(req: Request, res: Response, next: NextFunction) {
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

      const vehicles = await stopService.getNearbyVehicles(lat, lng, radius);
      res.json({ status: 'SUCCESS', count: vehicles.length, data: vehicles });
    } catch (err) {
      next(err);
    }
  }
}
