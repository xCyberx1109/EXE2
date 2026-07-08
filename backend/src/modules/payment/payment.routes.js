import { Router } from 'express';
import { initiatePayment, confirmPayment, cancelPayment } from './payment.controller.js';
import { idParam, payOrderRules } from '../billiard/billiard.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.post('/payment/orders/:id/pay', authenticate, requirePermission('RESTAURANT_PAY_PROCESS'), [...idParam, ...payOrderRules], validate, initiatePayment);
router.post('/payment/orders/:id/confirm', authenticate, requirePermission('RESTAURANT_PAY_PROCESS'), [...idParam, ...payOrderRules], validate, confirmPayment);
router.post('/payment/orders/:id/cancel', authenticate, requirePermission('RESTAURANT_PAY_PROCESS'), idParam, validate, cancelPayment);

export default router;
