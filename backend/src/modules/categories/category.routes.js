import { Router } from 'express';
import {
  listCategories, getCategory, getCategoryStats, createCategory, updateCategory, deleteCategory, restoreCategory,
} from './category.controller.js';
import { categoryRules, categoryUpdateRules, categoryIdParam, categoryQueryParams } from './category.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requirePermission } from '../../middlewares/auth.js';

const router = Router();

// Route cố định phải đặt trước /:id
router.get('/stats', optionalAuth, getCategoryStats);
router.get('/', optionalAuth, categoryQueryParams, validate, listCategories);
router.get('/:id', optionalAuth, categoryIdParam, validate, getCategory);

router.post('/', authenticate, requirePermission('CATEGORY_CREATE'), categoryRules, validate, createCategory);
router.put('/:id', authenticate, requirePermission('CATEGORY_UPDATE'), [...categoryIdParam, ...categoryUpdateRules], validate, updateCategory);
router.delete('/:id', authenticate, requirePermission('CATEGORY_DELETE'), categoryIdParam, validate, deleteCategory);
router.patch('/:id/restore', authenticate, requirePermission('CATEGORY_DELETE'), categoryIdParam, validate, restoreCategory);

export default router;
