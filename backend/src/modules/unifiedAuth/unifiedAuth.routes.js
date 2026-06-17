import { Router } from 'express';
import {
  register, login, deviceLogin, deviceRefresh,
  deviceLogout, revokeSession, getSessions,
  getMe, updateMe, changeMyPassword,
  forgotPassword, resetPassword,
} from './unifiedAuth.controller.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requireDeviceAuth } from '../../middlewares/auth.js';
import {
  registerRules, loginRules, updateMeRules, changePasswordRules,
  deviceLoginRules, deviceRefreshRules,
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

// POS device auth
router.post('/pos/login', deviceLoginRules, validate, deviceLogin);
router.post('/pos/refresh', requireDeviceAuth, deviceRefreshRules, validate, deviceRefresh);
router.post('/pos/logout', requireDeviceAuth, deviceLogout);
router.get('/pos/sessions', requireDeviceAuth, getSessions);
router.delete('/pos/sessions/:sessionId', requireDeviceAuth, revokeSession);

export default router;
