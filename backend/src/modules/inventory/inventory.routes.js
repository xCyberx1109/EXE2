import { Router } from 'express';
import {
  listIngredients, getIngredient, createIngredient, updateIngredient,
  deleteIngredient, getLowStock, getStats, stockIn, stockOut,
  getIngredientTransactions, listTransactions,
} from './inventory.controller.js';
import {
  ingredientRules, ingredientIdParam, stockTransactionRules, inventoryListQuery,
} from '../../validators/inventory.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, optionalAuth } from '../../middlewares/auth.js';

const router = Router();

// Routes cố định phải đặt trước /:id
router.get('/ingredients/stats', optionalAuth, getStats);
router.get('/ingredients/low-stock', optionalAuth, getLowStock);
router.get('/ingredients', optionalAuth, inventoryListQuery, validate, listIngredients);
router.get('/ingredients/:id/transactions', optionalAuth, ingredientIdParam, validate, getIngredientTransactions);
router.get('/ingredients/:id', optionalAuth, ingredientIdParam, validate, getIngredient);
router.get('/inventory/transactions', authenticate, listTransactions);

router.post('/ingredients', authenticate, authorize('ADMIN', 'MANAGER'), ingredientRules, validate, createIngredient);
router.put('/ingredients/:id', authenticate, authorize('ADMIN', 'MANAGER'), [...ingredientIdParam, ...ingredientRules], validate, updateIngredient);
router.delete('/ingredients/:id', authenticate, authorize('ADMIN'), ingredientIdParam, validate, deleteIngredient);
router.post('/ingredients/:id/stock-in', authenticate, authorize('ADMIN', 'MANAGER'), [...ingredientIdParam, ...stockTransactionRules], validate, stockIn);
router.post('/ingredients/:id/stock-out', authenticate, authorize('ADMIN', 'MANAGER'), [...ingredientIdParam, ...stockTransactionRules], validate, stockOut);

export default router;
