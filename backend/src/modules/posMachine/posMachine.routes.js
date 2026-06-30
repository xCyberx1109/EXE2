import { Router } from 'express';
import {
  loginPosMachine,
  loginPosMachineByPin,
  listActivePosMachines,
  listPosMachines,
  getPosMachine,
  createPosMachine,
  updatePosMachine,
  toggleLockPosMachine,
  resetPosMachinePin,
  deletePosMachine,
} from './posMachine.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { createPosMachineRules, posDeviceIdParam } from '../../validators/pos.validator.js';

const router = Router();

router.post('/login', loginPosMachine);
router.post('/login-by-pin', loginPosMachineByPin);
router.get('/active', listActivePosMachines);

router.use(authenticate);

router.get('/', requirePermission('POS_DEVICE_VIEW'), listPosMachines);
router.get('/:id', requirePermission('POS_DEVICE_VIEW'), posDeviceIdParam, validate, getPosMachine);
router.post('/', requirePermission('POS_DEVICE_CREATE'), createPosMachineRules, validate, createPosMachine);
router.put('/:id', requirePermission('POS_DEVICE_UPDATE'), posDeviceIdParam, validate, updatePosMachine);
router.put('/:id/reset-pin', requirePermission('POS_DEVICE_UPDATE'), posDeviceIdParam, validate, resetPosMachinePin);
router.put('/:id/toggle-lock', requirePermission('POS_DEVICE_UPDATE'), posDeviceIdParam, validate, toggleLockPosMachine);
router.delete('/:id', requirePermission('POS_DEVICE_DELETE'), posDeviceIdParam, validate, deletePosMachine);

export default router;
