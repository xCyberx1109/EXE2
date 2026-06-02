import { Router } from 'express';
import { openShift, closeShift, getCurrentShift, getShiftHistory, getShiftById } from './shift.controller.js';
import { openShiftRules, closeShiftRules, shiftIdParam } from '../../validators/shift.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requirePosAuth } from '../../middlewares/posAuth.js';
import { attachDevicePermissions } from '../../middlewares/devicePermission.js';

const router = Router();

router.use(requirePosAuth);
router.use(attachDevicePermissions);

router.post('/open', openShiftRules, validate, openShift);
router.post('/close', closeShiftRules, validate, closeShift);
router.get('/current', getCurrentShift);
router.get('/history', getShiftHistory);
router.get('/:id', shiftIdParam, validate, getShiftById);

export default router;
