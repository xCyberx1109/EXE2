import { Router } from 'express';
import { deviceRefresh, deviceLogout } from './deviceAuth.controller.js';
import { requirePosAuth } from '../../middlewares/posAuth.js';

const router = Router();

router.post('/refresh', requirePosAuth, deviceRefresh);
router.post('/logout', requirePosAuth, deviceLogout);

export default router;
