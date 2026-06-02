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
import { authenticate, optionalAuth, requirePermission } from '../../middlewares/auth.js';
import { param } from 'express-validator';

const router = Router();

// Public read - phục vụ POS & QR Menu (optionalAuth để MANAGER bị scope branch)
router.get('/menu-items', optionalAuth, menuSearchQuery, validate, listMenuItems);
router.get('/menu-items/top-selling', optionalAuth, getTopSelling);
router.get('/menu-items/:id', optionalAuth, menuItemIdParam, validate, getMenuItem);
router.get('/categories', optionalAuth, listCategories);

// Protected write - authenticate từng route (không dùng router.use để tránh chặn router khác)
router.post('/categories', authenticate, requirePermission('MENU_MANAGE'), categoryRules, validate, createCategory);
router.put('/categories/:id', authenticate, requirePermission('MENU_MANAGE'), categoryRules, validate, updateCategory);
router.delete('/categories/:id', authenticate, requirePermission('MENU_MANAGE'), [param('id').isUUID()], validate, deleteCategory);

router.post('/menu-items', authenticate, requirePermission('MENU_MANAGE'), menuItemRules, validate, createMenuItem);
router.put('/menu-items/:id', authenticate, requirePermission('MENU_UPDATE'), [...menuItemIdParam, ...menuItemRules], validate, updateMenuItem);
router.patch('/menu-items/:id/availability', authenticate, requirePermission('MENU_MANAGE'), menuItemIdParam, validate, toggleAvailability);
router.delete('/menu-items/:id', authenticate, requirePermission('MENU_DELETE'), menuItemIdParam, validate, deleteMenuItem);

export default router;
