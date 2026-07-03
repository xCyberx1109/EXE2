import { Router } from 'express';
import {
  register, login,
  getMe, updateMe, changeMyPassword,
  forgotPassword, resetPassword,
} from './unifiedAuth.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import {
  registerRules, loginRules, updateMeRules, changePasswordRules,
  forgotPasswordRules, resetPasswordRules,
} from '../../validators/unifiedAuth.validator.js';

const router = Router();

// User auth
router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMeRules, validate, updateMe);
router.put('/change-password', authenticate, changePasswordRules, validate, changeMyPassword);

// Forgot / Reset password
router.post('/forgot-password', forgotPasswordRules, validate, forgotPassword);
router.post('/reset-password', resetPasswordRules, validate, resetPassword);

export default router;
