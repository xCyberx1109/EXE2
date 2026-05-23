import { Router } from 'express';
import {
  createPosDevice, listPosDevices, getPosDevice,
  resetPosPin, togglePosDevice, deletePosDevice, updatePosDeviceMode,
} from './posDevice.controller.js';
import {
  createPosDeviceRules, resetPinRules, toggleDeviceRules, posDeviceIdParam, updateModeRules,
} from '../../validators/pos.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireManager } from '../../middlewares/auth.js';

const router = Router();

// Tất cả routes đều cần xác thực và quyền MANAGER trở lên
router.use(authenticate, requireManager);

router.get('/', listPosDevices);
router.get('/:id', posDeviceIdParam, validate, getPosDevice);
router.post('/', createPosDeviceRules, validate, createPosDevice);
router.put('/:id/toggle', [...posDeviceIdParam, ...toggleDeviceRules], validate, togglePosDevice);
router.put('/:id/mode', [...posDeviceIdParam, ...updateModeRules], validate, updatePosDeviceMode);
router.delete('/:id', posDeviceIdParam, validate, deletePosDevice);

// Reset PIN - dùng body deviceId thay vì params
router.post('/reset-pin', resetPinRules, validate, resetPosPin);

export default router;
