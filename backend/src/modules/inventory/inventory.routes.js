import { Router } from 'express';
import {
  listIngredients, getIngredient, createIngredient, updateIngredient,
  deleteIngredient, getLowStock, getStats, stockIn, stockOut,
  getIngredientTransactions, listTransactions,
} from './inventory.controller.js';
import {
  ingredientRules, ingredientUpdateRules, ingredientIdParam, stockInRules, stockOutRules, inventoryListQuery,
} from '../../validators/inventory.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requirePermission } from '../../middlewares/auth.js';

const router = Router();

// Routes cố định phải đặt trước /:id
router.get('/ingredients/stats', optionalAuth, requirePermission('INVENTORY_VIEW'), getStats);
router.get('/ingredients/low-stock', optionalAuth, requirePermission('INVENTORY_VIEW'), getLowStock);
router.get('/ingredients', optionalAuth, requirePermission('INVENTORY_VIEW'), inventoryListQuery, validate, listIngredients);
router.get('/ingredients/:id/transactions', optionalAuth, requirePermission('INVENTORY_VIEW'), ingredientIdParam, validate, getIngredientTransactions);
router.get('/ingredients/:id', optionalAuth, requirePermission('INVENTORY_VIEW'), ingredientIdParam, validate, getIngredient);
router.get('/inventory/transactions', authenticate, requirePermission('INVENTORY_VIEW'), listTransactions);

router.post('/ingredients', authenticate, requirePermission('INVENTORY_CREATE'), ingredientRules, validate, createIngredient);
router.put('/ingredients/:id', authenticate, requirePermission('INVENTORY_UPDATE'), [...ingredientIdParam, ...ingredientUpdateRules], validate, updateIngredient);
router.delete('/ingredients/:id', authenticate, requirePermission('INVENTORY_DELETE'), ingredientIdParam, validate, deleteIngredient);
router.post('/ingredients/:id/stock-in', authenticate, requirePermission('INVENTORY_IMPORT'), [...ingredientIdParam, ...stockInRules], validate, stockIn);
router.post('/ingredients/:id/stock-out', authenticate, requirePermission('INVENTORY_EXPORT'), [...ingredientIdParam, ...stockOutRules], validate, stockOut);

export default router;
