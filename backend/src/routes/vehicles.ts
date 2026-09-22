import { Router } from 'express';
import { VehiclesController } from '../controllers/vehiclesController';

const router = Router();

router.get('/', VehiclesController.getVehicles);
router.get('/:vehicleId', VehiclesController.getVehicleById);

export default router;
