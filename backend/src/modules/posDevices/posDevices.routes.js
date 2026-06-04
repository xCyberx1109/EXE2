import { Router } from 'express';
import {
  createPosDevice, listPosDevices, getPosDevice,
  regenerateSetupPin, revokePosDevice,
  resetPosDevice, togglePosDevice, deletePosDevice,
  updatePosDeviceMode, getDeviceActivityLogs,
} from './posDevices.controller.js';
import {
  createPosDeviceRules, resetDeviceRules,
  revokeDeviceRules, regenerateSetupPinRules, deviceIdParam,
  toggleDeviceRules, updateModeRules,
} from '../../validators/posDevices.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.use(authenticate, requirePermission('MANAGE_POS_DEVICES'));

router.get('/', listPosDevices);
router.get('/:id', deviceIdParam, validate, getPosDevice);
router.get('/:id/logs', deviceIdParam, validate, getDeviceActivityLogs);
router.post('/', createPosDeviceRules, validate, createPosDevice);
router.put('/:id/toggle', [...deviceIdParam, ...toggleDeviceRules], validate, togglePosDevice);
router.put('/:id/mode', [...deviceIdParam, ...updateModeRules], validate, updatePosDeviceMode);
router.delete('/:id', deviceIdParam, validate, deletePosDevice);

router.post('/regenerate-pin', regenerateSetupPinRules, validate, regenerateSetupPin);
router.post('/reset', resetDeviceRules, validate, resetPosDevice);
router.post('/revoke', revokeDeviceRules, validate, revokePosDevice);

export default router;
