import { Router } from 'express';
import {
  listBilliardTables, updateTableLayout,
  playNow, reserveTable, checkInReservation, cancelReservation,
  getCurrentSession, extendSession, finishSession, getSessionOrder,
  addOrderItem, batchAddOrderItems, updateOrderItem, removeOrderItem, payOrder,
  getTableOrderSummary, createBilliardTable,
} from './billiard.controller.js';
import {
  tableIdParam, idParam, updateLayoutRules, playNowRules, reserveRules,
  extendSessionRules, addOrderItemRules, batchAddOrderItemsRules, updateOrderItemRules, createTableRules,
} from './billiard.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission, requireAnyPermission, optionalAuth } from '../../middlewares/auth.js';

const router = Router();

// ==================== TABLES ====================
router.get('/billiard/tables', optionalAuth, listBilliardTables);
router.post('/billiard/tables', authenticate, requirePermission('BILLIARD_TABLE_CREATE'), createTableRules, validate, createBilliardTable);
router.put('/billiard/tables/layout', authenticate, requirePermission('BILLIARD_TABLE_LAYOUT_EDIT'), updateLayoutRules, validate, updateTableLayout);

// ==================== PLAY NOW → SESSION START ====================
router.post('/billiard/tables/:tableId/play-now', authenticate, requirePermission('BILLIARD_SESSION_START'), [...tableIdParam, ...playNowRules], validate, playNow);

// ==================== RESERVATIONS ====================
router.post('/billiard/tables/:tableId/reserve', authenticate, requirePermission('BILLIARD_RESERVATION_CREATE'), [...tableIdParam, ...reserveRules], validate, reserveTable);
router.post('/billiard/tables/:tableId/check-in', authenticate, requirePermission('BILLIARD_SESSION_CHECKIN'), tableIdParam, validate, checkInReservation);
router.post('/billiard/tables/:tableId/cancel-reservation', authenticate, requirePermission('BILLIARD_RESERVATION_CANCEL'), tableIdParam, validate, cancelReservation);

// ==================== SESSIONS ====================
router.get('/billiard/tables/:tableId/current-session', optionalAuth, tableIdParam, validate, getCurrentSession);
router.post('/billiard/sessions/:id/extend', authenticate, requirePermission('BILLIARD_SESSION_EXTEND'), [...idParam, ...extendSessionRules], validate, extendSession);
router.post('/billiard/tables/:tableId/finish-session', authenticate, requirePermission('BILLIARD_SESSION_FINISH'), tableIdParam, validate, finishSession);

// ==================== ORDERS ====================
router.get('/billiard/tables/:tableId/order-summary', optionalAuth, tableIdParam, validate, getTableOrderSummary);
router.get('/billiard/sessions/:id/order', optionalAuth, idParam, validate, getSessionOrder);
router.post('/billiard/orders/:id/items/batch', authenticate, requireAnyPermission(['BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE']), [...idParam, ...batchAddOrderItemsRules], validate, batchAddOrderItems);
router.post('/billiard/orders/:id/items', authenticate, requireAnyPermission(['BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE']), [...idParam, ...addOrderItemRules], validate, addOrderItem);
router.put('/billiard/orders/:id/items/:itemId', authenticate, requirePermission('BILLIARD_ORDER_UPDATE'), [...idParam, ...updateOrderItemRules], validate, updateOrderItem);
router.delete('/billiard/orders/:id/items/:itemId', authenticate, requirePermission('BILLIARD_ORDER_DELETE'), [...idParam, ...idParam], validate, removeOrderItem);
router.post('/billiard/orders/:id/pay', authenticate, requirePermission('BILLIARD_PAY_PROCESS'), idParam, validate, payOrder);

export default router;
