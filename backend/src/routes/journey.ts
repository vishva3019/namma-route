import { Router } from 'express';
import { JourneyController } from '../controllers/journeyController';

const router = Router();

router.get('/', JourneyController.planJourney);

export default router;
