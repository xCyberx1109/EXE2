import { Router } from 'express';
import {
  loginPosMachine,
  listPosMachines,
  getPosMachine,
  createPosMachine,
  updatePosMachine,
  toggleLockPosMachine,
  resetPosMachinePin,
  deletePosMachine,
  updatePosMachinePermissions,
} from './posMachine.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.post('/login', loginPosMachine);

router.use(authenticate);

router.get('/', requirePermission('POS_DEVICE_VIEW'), listPosMachines);
router.get('/:id', requirePermission('POS_DEVICE_VIEW'), getPosMachine);
router.post('/', requirePermission('POS_DEVICE_CREATE'), createPosMachine);
router.put('/:id', requirePermission('POS_DEVICE_UPDATE'), updatePosMachine);
router.put('/:id/reset-pin', requirePermission('POS_DEVICE_UPDATE'), resetPosMachinePin);
router.put('/:id/toggle-lock', requirePermission('POS_DEVICE_UPDATE'), toggleLockPosMachine);
router.put('/:id/permissions', requirePermission('POS_DEVICE_UPDATE'), updatePosMachinePermissions);
router.delete('/:id', requirePermission('POS_DEVICE_DELETE'), deletePosMachine);

export default router;
