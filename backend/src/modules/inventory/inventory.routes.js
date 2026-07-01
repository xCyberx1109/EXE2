import { Router } from 'express';
import {
  listIngredients, getIngredient, createIngredient, updateIngredient,
  deleteIngredient, getLowStock, getStats, stockIn, stockOut,
  getIngredientTransactions, listTransactions,
  getThreshold, updateThreshold, listAdjustmentRequests,
  approveAdjustmentRequest, rejectAdjustmentRequest,
  listIngredientBatches, listExpiringBatches,
  getWasteReport, getFoodCostReport,
} from './inventory.controller.js';
import {
  ingredientRules, ingredientUpdateRules, ingredientIdParam, stockInRules, stockOutRules, inventoryListQuery,
  adjustmentRequestIdParam, adjustmentRequestListQuery, rejectAdjustmentRequestRules, updateThresholdRules,
  expiringBatchesQuery, reportDateRangeQuery,
} from '../../validators/inventory.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requirePermission } from '../../middlewares/auth.js';

const router = Router();

// Routes cố định phải đặt trước /:id
router.get('/ingredients/stats', optionalAuth, requirePermission('INVENTORY_VIEW'), getStats);
router.get('/ingredients/low-stock', optionalAuth, requirePermission('INVENTORY_VIEW'), getLowStock);
router.get('/ingredients', optionalAuth, requirePermission('INVENTORY_VIEW'), inventoryListQuery, validate, listIngredients);
router.get('/ingredients/:id/transactions', optionalAuth, requirePermission('INVENTORY_VIEW'), ingredientIdParam, validate, getIngredientTransactions);
router.get('/ingredients/:id/batches', optionalAuth, requirePermission('INVENTORY_VIEW'), ingredientIdParam, validate, listIngredientBatches);
router.get('/ingredients/:id', optionalAuth, requirePermission('INVENTORY_VIEW'), ingredientIdParam, validate, getIngredient);
router.get('/inventory/transactions', authenticate, requirePermission('INVENTORY_VIEW'), listTransactions);
router.get('/inventory/expiring-batches', authenticate, requirePermission('INVENTORY_VIEW'), expiringBatchesQuery, validate, listExpiringBatches);

router.post('/ingredients', authenticate, requirePermission('INVENTORY_CREATE'), ingredientRules, validate, createIngredient);
router.put('/ingredients/:id', authenticate, requirePermission('INVENTORY_UPDATE'), [...ingredientIdParam, ...ingredientUpdateRules], validate, updateIngredient);
router.delete('/ingredients/:id', authenticate, requirePermission('INVENTORY_DELETE'), ingredientIdParam, validate, deleteIngredient);
router.post('/ingredients/:id/stock-in', authenticate, requirePermission('INVENTORY_IMPORT'), [...ingredientIdParam, ...stockInRules], validate, stockIn);
router.post('/ingredients/:id/stock-out', authenticate, requirePermission('INVENTORY_EXPORT'), [...ingredientIdParam, ...stockOutRules], validate, stockOut);

// Ngưỡng phê duyệt điều chỉnh/hao hụt lớn
router.get('/inventory/approval-threshold', authenticate, requirePermission('INVENTORY_VIEW'), getThreshold);
router.patch('/inventory/approval-threshold', authenticate, requirePermission('INVENTORY_APPROVE'), updateThresholdRules, validate, updateThreshold);

// Yêu cầu điều chỉnh/hao hụt tồn kho chờ duyệt (chỉ người có quyền INVENTORY_APPROVE mới thấy/xử lý)
router.get('/inventory/adjustment-requests', authenticate, requirePermission('INVENTORY_APPROVE'), adjustmentRequestListQuery, validate, listAdjustmentRequests);
router.post('/inventory/adjustment-requests/:id/approve', authenticate, requirePermission('INVENTORY_APPROVE'), adjustmentRequestIdParam, validate, approveAdjustmentRequest);
router.post('/inventory/adjustment-requests/:id/reject', authenticate, requirePermission('INVENTORY_APPROVE'), [...adjustmentRequestIdParam, ...rejectAdjustmentRequestRules], validate, rejectAdjustmentRequest);

// Báo cáo hao hụt / food cost %
router.get('/inventory/reports/waste', authenticate, requirePermission('REPORT_VIEW'), reportDateRangeQuery, validate, getWasteReport);
router.get('/inventory/reports/food-cost', authenticate, requirePermission('REPORT_VIEW'), reportDateRangeQuery, validate, getFoodCostReport);

export default router;
