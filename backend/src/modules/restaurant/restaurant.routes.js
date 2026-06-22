import { Router } from 'express';
import {
  listTables, createTable, updateTableLayout,
  createOrderForTable, openOrderForTable, getTableOrder,
  addOrderItem, batchAddOrderItems, updateOrderItem, removeOrderItem,
  transferOrder, mergeTables, splitOrder,
  payOrder, updateTable, deleteTable, updateGuestCount, updateOrderNote,
} from './restaurant.controller.js';
import {
  tableIdParam, idParam, updateLayoutRules, createOrderRules,
  addOrderItemRules, batchAddOrderItemsRules, updateOrderItemRules,
  transferRules, mergeRules, splitRules, createTableRules, payOrderRules,
} from './restaurant.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission, requireAnyPermission } from '../../middlewares/auth.js';

const router = Router();

// ==================== TABLES ====================
router.get('/restaurant/tables', authenticate, listTables);
router.post('/restaurant/tables', authenticate, requirePermission('RESTAURANT_TABLE_CREATE'), createTableRules, validate, createTable);
router.put('/restaurant/tables/layout', authenticate, requirePermission('RESTAURANT_TABLE_LAYOUT_EDIT'), updateLayoutRules, validate, updateTableLayout);
router.put('/restaurant/tables/:id', authenticate, requirePermission('RESTAURANT_TABLE_UPDATE'), tableIdParam, validate, updateTable);
router.delete('/restaurant/tables/:id', authenticate, requirePermission('RESTAURANT_TABLE_DELETE'), tableIdParam, validate, deleteTable);

// ==================== ORDERS ====================
router.post('/restaurant/tables/:tableId/order', authenticate, requirePermission('RESTAURANT_ORDER_CREATE'), [...tableIdParam, ...createOrderRules], validate, createOrderForTable);
router.post('/restaurant/tables/:tableId/open-order', authenticate, requirePermission('RESTAURANT_ORDER_CREATE'), [...tableIdParam, ...createOrderRules], validate, openOrderForTable);
router.get('/restaurant/tables/:tableId/order', authenticate, tableIdParam, validate, getTableOrder);

router.post('/restaurant/orders/:id/items', authenticate, requireAnyPermission(['RESTAURANT_ORDER_ADD_ITEM', 'RESTAURANT_ORDER_UPDATE']), [...idParam, ...addOrderItemRules], validate, addOrderItem);
router.post('/restaurant/orders/:id/items/batch', authenticate, requireAnyPermission(['RESTAURANT_ORDER_ADD_ITEM', 'RESTAURANT_ORDER_UPDATE']), [...idParam, ...batchAddOrderItemsRules], validate, batchAddOrderItems);
router.put('/restaurant/orders/:id/items/:itemId', authenticate, requirePermission('RESTAURANT_ORDER_UPDATE'), [...idParam, ...updateOrderItemRules], validate, updateOrderItem);
router.delete('/restaurant/orders/:id/items/:itemId', authenticate, requirePermission('RESTAURANT_ORDER_DELETE'), [...idParam, ...idParam], validate, removeOrderItem);
router.post('/restaurant/orders/:id/pay', authenticate, requirePermission('RESTAURANT_PAY_PROCESS'), [...idParam, ...payOrderRules], validate, payOrder);
router.put('/restaurant/orders/:id/note', authenticate, requirePermission('RESTAURANT_ORDER_UPDATE'), idParam, validate, updateOrderNote);

// ==================== TABLE TRANSFER/MERGE/SPLIT ====================
router.post('/restaurant/tables/:tableId/transfer', authenticate, requirePermission('RESTAURANT_TABLE_TRANSFER'), [...tableIdParam, ...transferRules], validate, transferOrder);
router.post('/restaurant/tables/:tableId/merge', authenticate, requirePermission('RESTAURANT_TABLE_MERGE'), [...tableIdParam, ...mergeRules], validate, mergeTables);
router.post('/restaurant/tables/:tableId/split', authenticate, requirePermission('RESTAURANT_TABLE_SPLIT'), [...tableIdParam, ...splitRules], validate, splitOrder);

// ==================== GUEST COUNT ====================
router.put('/restaurant/tables/:tableId/guest-count', authenticate, requirePermission('RESTAURANT_ORDER_UPDATE'), tableIdParam, validate, updateGuestCount);

export default router;
