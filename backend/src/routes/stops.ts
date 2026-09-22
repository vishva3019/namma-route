import { Router } from 'express';
import { StopsController } from '../controllers/stopsController';

const router = Router();

router.get('/search', StopsController.getStops);
router.get('/nearby', StopsController.getNearbyStops);
router.get('/', StopsController.getStops);
router.get('/:stopId', StopsController.getStopById);
router.get('/:stopId/vehicles', StopsController.getStopVehicles);
router.get('/:stopId/eta', StopsController.getStopEta);

export default router;
