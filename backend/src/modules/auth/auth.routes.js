import { Router } from 'express';
import { register, login, getMe } from './auth.controller.js';
import { registerRules, loginRules } from '../../validators/auth.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';

const router = Router();

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', authenticate, getMe);

export default router;
