import { Router, Request, Response, NextFunction } from 'express';
import { dataStatsService } from '../services/dataStatsService';

const router = Router();

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await dataStatsService.getNetworkStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/coverage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coverage = await dataStatsService.getNetworkCoverage();
    res.json(coverage);
  } catch (err) {
    next(err);
  }
});

router.get('/completeness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const completeness = await dataStatsService.getNetworkCompleteness();
    res.json(completeness);
  } catch (err) {
    next(err);
  }
});

export default router;
