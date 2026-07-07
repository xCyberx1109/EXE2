import { Router } from 'express';
import {
  listOrders, listOrdersByDate, createOrder, deleteOrder, getActiveTableOrder,
  listKitchenQueue, updateKitchenStatus,
  listOrderHistory, getOrderDetail,
  listOrderQueue, createOrderQueue, updateOrderQueue, payOrderQueue, cancelOrderQueue,
  listOrdersLegacy, createOrderLegacy, deleteOrderLegacy,
} from './order.controller.js';
import { createOrderRules, createOrderQueueRules, orderIdParam, ordersByDateQuery } from '../../validators/order.validator.js';
import { validate } from '../../middlewares/validate.js';
import { optionalAuth, authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

// API chuẩn - /orders/daily trước các route khác
router.get('/orders/daily', optionalAuth, ordersByDateQuery, validate, listOrdersByDate);
router.get('/orders/history', optionalAuth, requirePermission('ORDER_HISTORY_VIEW'), listOrderHistory);
router.get('/orders', optionalAuth, listOrders);
router.post('/orders', optionalAuth, createOrderRules, validate, createOrder);
router.delete('/orders/:id', optionalAuth, orderIdParam, validate, deleteOrder);
// No-cache middleware for order queue endpoints (fresh data always)
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

// Order Queue POS endpoints - independent no-table POS workflow
router.get('/orders/queue', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_VIEW'), listOrderQueue);
router.post('/orders/queue', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_CREATE'), createOrderQueueRules, validate, createOrderQueue);
router.put('/orders/queue/:id', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_UPDATE'), orderIdParam, validate, updateOrderQueue);
router.post('/orders/queue/:id/payment', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_PAY'), orderIdParam, validate, payOrderQueue);
router.post('/orders/queue/:id/cancel', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_DELETE'), orderIdParam, validate, cancelOrderQueue);

// Backward-compatible aliases for older clients
router.get('/orders/order-queue', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_VIEW'), listOrderQueue);
router.post('/orders/order-queue', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_CREATE'), createOrderQueueRules, validate, createOrderQueue);
router.patch('/orders/order-queue/:id', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_UPDATE'), orderIdParam, validate, updateOrderQueue);
router.post('/orders/order-queue/:id/payment', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_PAY'), orderIdParam, validate, payOrderQueue);
router.delete('/orders/order-queue/:id', noCache, optionalAuth, requirePermission('POS_ORDER_QUEUE_DELETE'), orderIdParam, validate, cancelOrderQueue);

// Table-order endpoints
router.get('/orders/by-table/:tableId', optionalAuth, getActiveTableOrder);

// Kitchen endpoints
router.get('/orders/kitchen-queue', optionalAuth, listKitchenQueue);
router.patch('/orders/:id/kitchen-status', authenticate, requirePermission('ORDER_UPDATE'), updateKitchenStatus);

// Order detail
router.get('/orders/:orderId', optionalAuth, requirePermission('ORDER_HISTORY_VIEW'), getOrderDetail);

export default router;

/** Router legacy cho POS/QRMenu - mount tại /orders */
export const legacyOrdersRouter = Router();
legacyOrdersRouter.get('/', optionalAuth, listOrdersLegacy);
legacyOrdersRouter.post('/', optionalAuth, createOrderRules, validate, createOrderLegacy);
legacyOrdersRouter.delete('/:id', optionalAuth, orderIdParam, validate, deleteOrderLegacy);
