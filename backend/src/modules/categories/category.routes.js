import { Router } from 'express';
import {
  listCategories, getCategory, createCategory, updateCategory, deleteCategory,
} from './category.controller.js';
import { categoryRules, categoryUpdateRules, categoryIdParam } from './category.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requirePermission } from '../../middlewares/auth.js';

const router = Router();

// Public/optional read
router.get('/', optionalAuth, listCategories);
router.get('/:id', optionalAuth, categoryIdParam, validate, getCategory);

// Protected write
router.post('/', authenticate, requirePermission('CATEGORY_CREATE'), categoryRules, validate, createCategory);
router.put('/:id', authenticate, requirePermission('CATEGORY_UPDATE'), [...categoryIdParam, ...categoryUpdateRules], validate, updateCategory);
router.delete('/:id', authenticate, requirePermission('CATEGORY_DELETE'), categoryIdParam, validate, deleteCategory);

export default router;
