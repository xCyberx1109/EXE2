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
import { authenticate, requireBranchManager, requirePermission } from '../../middlewares/auth.js';
import { enforceBranchScope } from '../../middlewares/branchScope.js';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

router.get('/', requirePermission('POS_DEVICE_VIEW'), listPosDevices);
router.get('/:id', requirePermission('POS_DEVICE_VIEW'), deviceIdParam, validate, getPosDevice);
router.get('/:id/logs', requirePermission('POS_DEVICE_VIEW'), deviceIdParam, validate, getDeviceActivityLogs);
router.post('/', requirePermission('POS_DEVICE_CREATE'), createPosDeviceRules, validate, createPosDevice);
router.put('/:id/toggle', requirePermission('POS_DEVICE_UPDATE'), [...deviceIdParam, ...toggleDeviceRules], validate, togglePosDevice);
router.put('/:id/mode', requirePermission('POS_DEVICE_UPDATE'), [...deviceIdParam, ...updateModeRules], validate, updatePosDeviceMode);
router.delete('/:id', requirePermission('POS_DEVICE_DELETE'), deviceIdParam, validate, deletePosDevice);

router.post('/regenerate-pin', requirePermission('POS_DEVICE_RESET'), regenerateSetupPinRules, validate, regenerateSetupPin);
router.post('/reset', requirePermission('POS_DEVICE_RESET'), resetDeviceRules, validate, resetPosDevice);
router.post('/revoke', requirePermission('POS_DEVICE_UPDATE'), revokeDeviceRules, validate, revokePosDevice);

export default router;
