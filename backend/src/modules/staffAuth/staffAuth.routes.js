import { Router } from 'express';
import { staffLoginPin, staffLogout, staffSwitch, getActiveStaff } from './staffAuth.controller.js';
import { staffLoginPinRules, staffLogoutRules, staffSwitchRules } from '../../validators/staffAuth.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requirePosAuth } from '../../middlewares/posAuth.js';
import { attachDevicePermissions } from '../../middlewares/devicePermission.js';

const router = Router();

router.use(requirePosAuth);
router.use(attachDevicePermissions);

router.post('/login-pin', staffLoginPinRules, validate, staffLoginPin);
router.post('/logout', staffLogoutRules, validate, staffLogout);
router.post('/switch', staffSwitchRules, validate, staffSwitch);
router.get('/active', getActiveStaff);

export default router;
