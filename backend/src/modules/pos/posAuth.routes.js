import { Router } from 'express';
import { posLogin, posLogout, posPing, posProfile } from './posAuth.controller.js';
import { posLoginRules } from '../../validators/pos.validator.js';
import { validate } from '../../middlewares/validate.js';
import { requirePosAuth } from '../../middlewares/posAuth.js';

const router = Router();

router.post('/auth/login', posLoginRules, validate, posLogin);
router.post('/auth/logout', requirePosAuth, posLogout);
router.post('/auth/ping', requirePosAuth, posPing);
router.get('/auth/profile', requirePosAuth, posProfile);

export default router;
