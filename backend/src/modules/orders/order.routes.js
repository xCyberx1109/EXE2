import { Router } from 'express';
import {
  listOrders, listOrdersByDate, createOrder, deleteOrder, completeTablePayment,
  listOrdersLegacy, createOrderLegacy, deleteOrderLegacy,
} from './order.controller.js';
import { createOrderRules, orderIdParam, ordersByDateQuery } from '../../validators/order.validator.js';
import { validate } from '../../middlewares/validate.js';
import { optionalAuth } from '../../middlewares/auth.js';

const router = Router();

// API chuẩn - /orders/daily trước các route khác
router.get('/orders/daily', ordersByDateQuery, validate, listOrdersByDate);
router.get('/orders', listOrders);
router.post('/orders', optionalAuth, createOrderRules, validate, createOrder);
router.delete('/orders/:id', orderIdParam, validate, deleteOrder);
router.post('/orders/complete-payment', optionalAuth, completeTablePayment);

export default router;

/** Router legacy cho POS/QRMenu - mount tại /orders */
export const legacyOrdersRouter = Router();
legacyOrdersRouter.get('/', listOrdersLegacy);
legacyOrdersRouter.post('/', optionalAuth, createOrderRules, validate, createOrderLegacy);
legacyOrdersRouter.delete('/:id', orderIdParam, validate, deleteOrderLegacy);
