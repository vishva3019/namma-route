import { Request, Response, NextFunction } from 'express';
import { journeyService } from '../services/journeyService';

export class JourneyController {
  static async planJourney(req: Request, res: Response, next: NextFunction) {
    try {
      const from = (req.query.from || req.query.origin) as string;
      const to = (req.query.to || req.query.destination) as string;

      if (!from || !to) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Both "from" (or "origin") and "to" (or "destination") query parameters are required',
        });
      }

      const plans = await journeyService.planJourney(from, to);
      res.json({
        status: 'SUCCESS',
        from,
        to,
        count: plans.length,
        data: plans,
        plans,
      });
    } catch (err) {
      next(err);
    }
  }
}
