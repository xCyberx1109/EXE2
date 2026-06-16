import { Router } from 'express';
import {
  createPosDevice, listPosDevices, getPosDevice,
  resetPosPin, togglePosDevice, deletePosDevice, updatePosDeviceMode,
} from './posDevice.controller.js';
import {
  createPosDeviceRules, resetPinRules, toggleDeviceRules, posDeviceIdParam, updateModeRules,
} from '../../validators/pos.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('POS_DEVICE_VIEW'), listPosDevices);
router.get('/:id', requirePermission('POS_DEVICE_VIEW'), posDeviceIdParam, validate, getPosDevice);
router.post('/', requirePermission('POS_DEVICE_CREATE'), createPosDeviceRules, validate, createPosDevice);
router.put('/:id/toggle', requirePermission('POS_DEVICE_UPDATE'), [...posDeviceIdParam, ...toggleDeviceRules], validate, togglePosDevice);
router.put('/:id/mode', requirePermission('POS_DEVICE_UPDATE'), [...posDeviceIdParam, ...updateModeRules], validate, updatePosDeviceMode);
router.delete('/:id', requirePermission('POS_DEVICE_DELETE'), posDeviceIdParam, validate, deletePosDevice);

// Reset PIN - dùng body deviceId thay vì params
router.post('/reset-pin', requirePermission('POS_DEVICE_UPDATE'), resetPinRules, validate, resetPosPin);

export default router;
