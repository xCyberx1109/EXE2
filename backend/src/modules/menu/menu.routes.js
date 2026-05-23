import { Router } from 'express';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  listMenuItems, getMenuItem, createMenuItem, updateMenuItem,
  toggleAvailability, deleteMenuItem, getTopSelling,
} from './menu.controller.js';
import {
  categoryRules, menuItemRules, menuItemIdParam, menuSearchQuery,
} from '../../validators/menu.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, optionalAuth } from '../../middlewares/auth.js';
import { param } from 'express-validator';

const router = Router();

// Public read - phục vụ POS & QR Menu (optionalAuth để MANAGER bị scope branch)
router.get('/menu-items', optionalAuth, menuSearchQuery, validate, listMenuItems);
router.get('/menu-items/top-selling', optionalAuth, getTopSelling);
router.get('/menu-items/:id', optionalAuth, menuItemIdParam, validate, getMenuItem);
router.get('/categories', optionalAuth, listCategories);

// Protected write - authenticate từng route (không dùng router.use để tránh chặn router khác)
router.post('/categories', authenticate, authorize('ADMIN'), categoryRules, validate, createCategory);
router.put('/categories/:id', authenticate, authorize('ADMIN'), categoryRules, validate, updateCategory);
router.delete('/categories/:id', authenticate, authorize('ADMIN'), [param('id').isUUID()], validate, deleteCategory);

router.post('/menu-items', authenticate, authorize('ADMIN', 'COOK'), menuItemRules, validate, createMenuItem);
router.put('/menu-items/:id', authenticate, authorize('ADMIN', 'COOK'), [...menuItemIdParam, ...menuItemRules], validate, updateMenuItem);
router.patch('/menu-items/:id/availability', authenticate, authorize('ADMIN', 'COOK'), menuItemIdParam, validate, toggleAvailability);
router.delete('/menu-items/:id', authenticate, authorize('ADMIN'), menuItemIdParam, validate, deleteMenuItem);

export default router;
