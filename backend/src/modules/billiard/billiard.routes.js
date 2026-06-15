import { Router } from 'express';
import {
  listBilliardTables, updateTableLayout,
  playNow, reserveTable, checkInReservation, cancelReservation,
  getCurrentSession, extendSession, finishSession, getSessionOrder,
  addOrderItem, updateOrderItem, removeOrderItem, payOrder,
  createBilliardTable,
} from './billiard.controller.js';
import {
  tableIdParam, idParam, updateLayoutRules, playNowRules, reserveRules,
  extendSessionRules, addOrderItemRules, updateOrderItemRules, createTableRules,
} from './billiard.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission, optionalAuth } from '../../middlewares/auth.js';

const router = Router();

// ==================== TABLES ====================
router.get('/billiard/tables', optionalAuth, listBilliardTables);
router.post('/billiard/tables', authenticate, requirePermission('TABLE_CREATE'), createTableRules, validate, createBilliardTable);
router.put('/billiard/tables/layout', authenticate, requirePermission('TABLE_LAYOUT_EDIT'), updateLayoutRules, validate, updateTableLayout);

// ==================== PLAY NOW ====================
router.post('/billiard/tables/:tableId/play-now', authenticate, requirePermission('TABLE_PLAY_NOW'), [...tableIdParam, ...playNowRules], validate, playNow);

// ==================== RESERVATIONS ====================
router.post('/billiard/tables/:tableId/reserve', authenticate, requirePermission('TABLE_RESERVE'), [...tableIdParam, ...reserveRules], validate, reserveTable);
router.post('/billiard/tables/:tableId/check-in', authenticate, requirePermission('TABLE_CHECKIN'), tableIdParam, validate, checkInReservation);
router.post('/billiard/tables/:tableId/cancel-reservation', authenticate, requirePermission('RESERVATION_CANCEL'), tableIdParam, validate, cancelReservation);

// ==================== SESSIONS ====================
router.get('/billiard/tables/:tableId/current-session', optionalAuth, tableIdParam, validate, getCurrentSession);
router.post('/billiard/sessions/:id/extend', authenticate, requirePermission('SESSION_EXTEND'), [...idParam, ...extendSessionRules], validate, extendSession);
router.post('/billiard/tables/:tableId/finish-session', authenticate, requirePermission('SESSION_FINISH'), tableIdParam, validate, finishSession);

// ==================== ORDERS ====================
router.get('/billiard/sessions/:id/order', optionalAuth, idParam, validate, getSessionOrder);
router.post('/billiard/orders/:id/items', authenticate, requirePermission('ORDER_MANAGE'), [...idParam, ...addOrderItemRules], validate, addOrderItem);
router.put('/billiard/orders/:id/items/:itemId', authenticate, requirePermission('ORDER_MANAGE'), [...idParam, ...updateOrderItemRules], validate, updateOrderItem);
router.delete('/billiard/orders/:id/items/:itemId', authenticate, requirePermission('ORDER_MANAGE'), [...idParam, ...idParam], validate, removeOrderItem);
router.post('/billiard/orders/:id/pay', authenticate, requirePermission('ORDER_PAY'), idParam, validate, payOrder);

export default router;
