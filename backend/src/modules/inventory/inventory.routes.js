import { Router } from 'express';
import {
  listIngredients, getIngredient, createIngredient, updateIngredient,
  deleteIngredient, getLowStock, getStats, stockIn, stockOut,
  getIngredientTransactions, listTransactions,
  listSellableInventory, bulkImport, bulkExport,
} from './inventory.controller.js';
import {
  ingredientRules, ingredientUpdateRules, ingredientIdParam, stockInRules, stockOutRules, inventoryListQuery,
  bulkImportRules, bulkExportRules,
} from '../../validators/inventory.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requirePermission, requireAnyPermission } from '../../middlewares/auth.js';

const router = Router();

router.get('/inventory/sellable', authenticate, requireAnyPermission(['BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE']), listSellableInventory);

// Routes cố định phải đặt trước /:id
router.get('/ingredients/stats', optionalAuth, requirePermission('INVENTORY_VIEW'), getStats);
router.get('/ingredients/low-stock', optionalAuth, requirePermission('INVENTORY_VIEW'), getLowStock);
router.get('/ingredients', optionalAuth, requirePermission('INVENTORY_VIEW'), inventoryListQuery, validate, listIngredients);
router.get('/ingredients/:id/transactions', optionalAuth, requirePermission('INVENTORY_VIEW'), ingredientIdParam, validate, getIngredientTransactions);
router.get('/ingredients/:id', optionalAuth, requirePermission('INVENTORY_VIEW'), ingredientIdParam, validate, getIngredient);
router.get('/inventory/transactions', authenticate, requirePermission('INVENTORY_TRANSACTION_VIEW'), listTransactions);

router.post('/ingredients', authenticate, requirePermission('INVENTORY_CREATE'), ingredientRules, validate, createIngredient);
router.put('/ingredients/:id', authenticate, requirePermission('INVENTORY_UPDATE'), [...ingredientIdParam, ...ingredientUpdateRules], validate, updateIngredient);
router.delete('/ingredients/:id', authenticate, requirePermission('INVENTORY_DELETE'), ingredientIdParam, validate, deleteIngredient);
router.post('/ingredients/:id/stock-in', authenticate, requirePermission('INVENTORY_IMPORT'), [...ingredientIdParam, ...stockInRules], validate, stockIn);
router.post('/ingredients/:id/stock-out', authenticate, requirePermission('INVENTORY_EXPORT'), [...ingredientIdParam, ...stockOutRules], validate, stockOut);

// Bulk import/export — nhập/xuất nhiều nguyên liệu trong 1 lần
router.post('/inventory/import', authenticate, requirePermission('INVENTORY_IMPORT'), bulkImportRules, validate, bulkImport);
router.post('/inventory/export', authenticate, requirePermission('INVENTORY_EXPORT'), bulkExportRules, validate, bulkExport);

export default router;
