import { Router } from 'express';
import { RoutesController } from '../controllers/routesController';

const router = Router();

router.get('/', RoutesController.getRoutes);
router.get('/:routeId', RoutesController.getRouteById);
router.get('/:routeId/directions', RoutesController.getRouteDirections);
router.get('/:routeId/stops', RoutesController.getRouteStops);
router.get('/:routeId/timetable', RoutesController.getRouteTimetable);
router.get('/:routeId/vehicles', RoutesController.getRouteVehicles);
router.get('/:routeId/debug', RoutesController.debugRoute);

export default router;
