import { Router } from 'express';
import {
  createPosDevice, listPosDevices, getPosDevice,
  resetPosPin, togglePosDevice, deletePosDevice,
} from './posDevice.controller.js';
import {
  createPosDeviceRules, resetPinRules, toggleDeviceRules, posDeviceIdParam,
} from '../../validators/pos.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, requireManager } from '../../middlewares/auth.js';

const router = Router();

// Tất cả routes đều cần xác thực và quyền MANAGER trở lên
router.use(authenticate, requireManager);

router.get('/', listPosDevices);
router.get('/:id', posDeviceIdParam, validate, getPosDevice);
router.post('/', createPosDeviceRules, validate, createPosDevice);
router.put('/:id/toggle', [...posDeviceIdParam, ...toggleDeviceRules], validate, togglePosDevice);
router.delete('/:id', posDeviceIdParam, validate, deletePosDevice);

// Reset PIN - dùng body deviceId thay vì params
router.post('/reset-pin', resetPinRules, validate, resetPosPin);

export default router;
