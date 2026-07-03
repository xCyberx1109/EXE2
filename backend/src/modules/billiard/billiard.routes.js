import { Router } from 'express';
import {
  listBilliardTables, updateTableLayout,
  playNow, reserveTable, checkInReservation, cancelReservation,
  getCurrentSession, finishSession, getSessionOrder,
  addOrderItem, batchAddOrderItems, updateOrderItem, removeOrderItem, payOrder,
  getTableOrderSummary, createBilliardTable,
  listRestaurantTables, createRestaurantTable,
  openOrderForTable, getTableOrder,
  transferOrder, mergeTables, splitOrder,
  updateGuestCount, updateOrderNote,
  updateRestaurantTable, deleteRestaurantTable,
  updateRestaurantTableLayout,
} from './billiard.controller.js';
import {
  tableIdParam, idParam, updateLayoutRules, playNowRules, reserveRules,
  addOrderItemRules, batchAddOrderItemsRules, updateOrderItemRules, createTableRules,
  createOrderRules, transferRules, mergeRules, splitRules, payOrderRules,
  createRestaurantTableRules, updateRestaurantTableRules,
} from './billiard.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission, requireAnyPermission, optionalAuth } from '../../middlewares/auth.js';

const router = Router();

// ==================== BILLIARD TABLES ====================
router.get('/billiard/tables', optionalAuth, listBilliardTables);
router.post('/billiard/tables', authenticate, requirePermission('BILLIARD_TABLE_CREATE'), createTableRules, validate, createBilliardTable);
router.put('/billiard/tables/layout', authenticate, requirePermission('BILLIARD_TABLE_LAYOUT_EDIT'), updateLayoutRules, validate, updateTableLayout);

// ==================== BILLIARD PLAY NOW → SESSION START ====================
router.post('/billiard/tables/:tableId/play-now', authenticate, requirePermission('BILLIARD_SESSION_START'), [...tableIdParam, ...playNowRules], validate, playNow);

// ==================== BILLIARD RESERVATIONS ====================
router.post('/billiard/tables/:tableId/reserve', authenticate, requirePermission('BILLIARD_RESERVATION_CREATE'), [...tableIdParam, ...reserveRules], validate, reserveTable);
router.post('/billiard/tables/:tableId/check-in', authenticate, requirePermission('BILLIARD_SESSION_CHECKIN'), tableIdParam, validate, checkInReservation);
router.post('/billiard/tables/:tableId/cancel-reservation', authenticate, requirePermission('BILLIARD_RESERVATION_CANCEL'), tableIdParam, validate, cancelReservation);

// ==================== BILLIARD SESSIONS ====================
router.get('/billiard/tables/:tableId/current-session', optionalAuth, tableIdParam, validate, getCurrentSession);
router.post('/billiard/tables/:tableId/finish-session', authenticate, requirePermission('BILLIARD_SESSION_FINISH'), tableIdParam, validate, finishSession);

// ==================== BILLIARD ORDERS ====================
router.get('/billiard/tables/:tableId/order-summary', optionalAuth, tableIdParam, validate, getTableOrderSummary);
router.get('/billiard/sessions/:id/order', optionalAuth, idParam, validate, getSessionOrder);
router.post('/billiard/orders/:id/items/batch', authenticate, requireAnyPermission(['BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE']), [...idParam, ...batchAddOrderItemsRules], validate, batchAddOrderItems);
router.post('/billiard/orders/:id/items', authenticate, requireAnyPermission(['BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE']), [...idParam, ...addOrderItemRules], validate, addOrderItem);
router.put('/billiard/orders/:id/items/:itemId', authenticate, requirePermission('BILLIARD_ORDER_UPDATE'), [...idParam, ...updateOrderItemRules], validate, updateOrderItem);
router.delete('/billiard/orders/:id/items/:itemId', authenticate, requirePermission('BILLIARD_ORDER_DELETE'), [...idParam, ...idParam], validate, removeOrderItem);
router.post('/billiard/orders/:id/pay', authenticate, requirePermission('BILLIARD_PAY_PROCESS'), [...idParam, ...payOrderRules], validate, payOrder);

// ==================== RESTAURANT TABLES ====================
router.get('/restaurant/tables', authenticate, listRestaurantTables);
router.post('/restaurant/tables', authenticate, requirePermission('RESTAURANT_TABLE_CREATE'), createRestaurantTableRules, validate, createRestaurantTable);
router.put('/restaurant/tables/layout', authenticate, requirePermission('RESTAURANT_TABLE_LAYOUT_EDIT'), updateLayoutRules, validate, updateRestaurantTableLayout);
router.put('/restaurant/tables/:id', authenticate, requirePermission('RESTAURANT_TABLE_UPDATE'), [...tableIdParam, ...updateRestaurantTableRules], validate, updateRestaurantTable);
router.delete('/restaurant/tables/:id', authenticate, requirePermission('RESTAURANT_TABLE_DELETE'), tableIdParam, validate, deleteRestaurantTable);

// ==================== RESTAURANT ORDERS ====================
router.post('/restaurant/tables/:tableId/open-order', authenticate, requirePermission('RESTAURANT_ORDER_CREATE'), [...tableIdParam, ...createOrderRules], validate, openOrderForTable);
router.get('/restaurant/tables/:tableId/order', authenticate, tableIdParam, validate, getTableOrder);

router.post('/restaurant/orders/:id/items', authenticate, requireAnyPermission(['RESTAURANT_ORDER_ADD_ITEM', 'RESTAURANT_ORDER_UPDATE']), [...idParam, ...addOrderItemRules], validate, addOrderItem);
router.post('/restaurant/orders/:id/items/batch', authenticate, requireAnyPermission(['RESTAURANT_ORDER_ADD_ITEM', 'RESTAURANT_ORDER_UPDATE']), [...idParam, ...batchAddOrderItemsRules], validate, batchAddOrderItems);
router.put('/restaurant/orders/:id/items/:itemId', authenticate, requirePermission('RESTAURANT_ORDER_UPDATE'), [...idParam, ...updateOrderItemRules], validate, updateOrderItem);
router.delete('/restaurant/orders/:id/items/:itemId', authenticate, requirePermission('RESTAURANT_ORDER_DELETE'), [...idParam, ...idParam], validate, removeOrderItem);
router.post('/restaurant/orders/:id/pay', authenticate, requirePermission('RESTAURANT_PAY_PROCESS'), [...idParam, ...payOrderRules], validate, payOrder);
router.put('/restaurant/orders/:id/note', authenticate, requirePermission('RESTAURANT_ORDER_UPDATE'), idParam, validate, updateOrderNote);

// ==================== RESTAURANT TABLE TRANSFER/MERGE/SPLIT ====================
router.post('/restaurant/tables/:tableId/transfer', authenticate, requirePermission('RESTAURANT_TABLE_TRANSFER'), [...tableIdParam, ...transferRules], validate, transferOrder);
router.post('/restaurant/tables/:tableId/merge', authenticate, requirePermission('RESTAURANT_TABLE_MERGE'), [...tableIdParam, ...mergeRules], validate, mergeTables);
router.post('/restaurant/tables/:tableId/split', authenticate, requirePermission('RESTAURANT_TABLE_SPLIT'), [...tableIdParam, ...splitRules], validate, splitOrder);

// ==================== RESTAURANT GUEST COUNT ====================
router.put('/restaurant/tables/:tableId/guest-count', authenticate, requirePermission('RESTAURANT_ORDER_UPDATE'), tableIdParam, validate, updateGuestCount);

export default router;
