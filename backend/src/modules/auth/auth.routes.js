import { Router } from 'express';
import { register, login, getMe, updateMe, changeMyPassword, resetMyPassword } from './auth.controller.js';
import { registerRules, loginRules, updateMeRules, changePasswordRules } from '../../validators/auth.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';

const router = Router();

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMeRules, validate, updateMe);
router.put('/change-password', authenticate, changePasswordRules, validate, changeMyPassword);
router.post('/reset-my-password', authenticate, resetMyPassword);

export default router;
