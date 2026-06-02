import { Router } from 'express';
import {
  listOrders, listOrdersByDate, createOrder, deleteOrder, completeTablePayment,
  listKitchenQueue, updateKitchenStatus,
  listOrdersLegacy, createOrderLegacy, deleteOrderLegacy,
} from './order.controller.js';
import { createOrderRules, orderIdParam, ordersByDateQuery } from '../../validators/order.validator.js';
import { validate } from '../../middlewares/validate.js';
import { optionalAuth, requireDeviceAuth } from '../../middlewares/auth.js';
import { requireDevicePermission, requireDeviceType } from '../../middlewares/devicePermission.js';

const router = Router();

// API chuẩn - /orders/daily trước các route khác
router.get('/orders/daily', optionalAuth, ordersByDateQuery, validate, listOrdersByDate);
router.get('/orders', optionalAuth, listOrders);
router.post('/orders', requireDeviceAuth, requireDevicePermission('order:create'), createOrderRules, validate, createOrder);
router.delete('/orders/:id', requireDeviceAuth, requireDevicePermission('order:cancel'), orderIdParam, validate, deleteOrder);
router.post('/orders/complete-payment', requireDeviceAuth, requireDevicePermission('payment:process'), completeTablePayment);

// Kitchen endpoints
router.get('/orders/kitchen-queue', optionalAuth, listKitchenQueue);
router.patch('/orders/:id/kitchen-status', requireDeviceAuth, requireDevicePermission('kitchen:update_status'), updateKitchenStatus);

export default router;

/** Router legacy cho POS/QRMenu - mount tại /orders */
export const legacyOrdersRouter = Router();
legacyOrdersRouter.get('/', optionalAuth, listOrdersLegacy);
legacyOrdersRouter.post('/', optionalAuth, createOrderRules, validate, createOrderLegacy);
legacyOrdersRouter.delete('/:id', optionalAuth, orderIdParam, validate, deleteOrderLegacy);
