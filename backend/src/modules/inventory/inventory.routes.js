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
import { authenticate, authorize } from '../../middlewares/auth.js';

const router = Router();

// Routes cố định phải đặt trước /:id
router.get('/ingredients/stats', getStats);
router.get('/ingredients/low-stock', getLowStock);
router.get('/ingredients', inventoryListQuery, validate, listIngredients);
router.get('/ingredients/:id/transactions', ingredientIdParam, validate, getIngredientTransactions);
router.get('/ingredients/:id', ingredientIdParam, validate, getIngredient);
router.get('/inventory/transactions', authenticate, listTransactions);

router.post('/ingredients', authenticate, authorize('ADMIN', 'STAFF'), ingredientRules, validate, createIngredient);
router.put('/ingredients/:id', authenticate, authorize('ADMIN', 'STAFF'), [...ingredientIdParam, ...ingredientRules], validate, updateIngredient);
router.delete('/ingredients/:id', authenticate, authorize('ADMIN'), ingredientIdParam, validate, deleteIngredient);
router.post('/ingredients/:id/stock-in', authenticate, authorize('ADMIN', 'STAFF'), [...ingredientIdParam, ...stockTransactionRules], validate, stockIn);
router.post('/ingredients/:id/stock-out', authenticate, authorize('ADMIN', 'STAFF'), [...ingredientIdParam, ...stockTransactionRules], validate, stockOut);

export default router;
