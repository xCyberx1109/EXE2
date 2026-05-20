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
import { authenticate, authorize } from '../../middlewares/auth.js';
import { param } from 'express-validator';

const router = Router();

// Public read - phục vụ POS & QR Menu
router.get('/menu-items', menuSearchQuery, validate, listMenuItems);
router.get('/menu-items/top-selling', getTopSelling);
router.get('/menu-items/:id', menuItemIdParam, validate, getMenuItem);
router.get('/categories', listCategories);

// Protected write - authenticate từng route (không dùng router.use để tránh chặn router khác)
router.post('/categories', authenticate, authorize('ADMIN'), categoryRules, validate, createCategory);
router.put('/categories/:id', authenticate, authorize('ADMIN'), categoryRules, validate, updateCategory);
router.delete('/categories/:id', authenticate, authorize('ADMIN'), [param('id').isUUID()], validate, deleteCategory);

router.post('/menu-items', authenticate, authorize('ADMIN', 'STAFF'), menuItemRules, validate, createMenuItem);
router.put('/menu-items/:id', authenticate, authorize('ADMIN', 'STAFF'), [...menuItemIdParam, ...menuItemRules], validate, updateMenuItem);
router.patch('/menu-items/:id/availability', authenticate, authorize('ADMIN', 'STAFF'), menuItemIdParam, validate, toggleAvailability);
router.delete('/menu-items/:id', authenticate, authorize('ADMIN'), menuItemIdParam, validate, deleteMenuItem);

export default router;
