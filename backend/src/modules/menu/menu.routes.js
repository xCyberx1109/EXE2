import { Router } from 'express';
import {
  listMenuItems, getMenuItem, createMenuItem, updateMenuItem,
  toggleAvailability, deleteMenuItem, getTopSelling,
} from './menu.controller.js';
import {
  menuItemRules, menuItemUpdateRules, menuItemIdParam, menuSearchQuery,
} from '../../validators/menu.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requirePermission } from '../../middlewares/auth.js';
import { param } from 'express-validator';

const router = Router();

// Public read - phục vụ POS & QR Menu (optionalAuth để MANAGER bị scope branch)
router.get('/menu-items', optionalAuth, menuSearchQuery, validate, listMenuItems);
router.get('/menu-items/top-selling', optionalAuth, getTopSelling);
router.get('/menu-items/:id', optionalAuth, menuItemIdParam, validate, getMenuItem);

// Protected write - authenticate từng route (không dùng router.use để tránh chặn router khác)
router.post('/menu-items', authenticate, requirePermission('MENU_CREATE'), menuItemRules, validate, createMenuItem);
router.put('/menu-items/:id', authenticate, requirePermission('MENU_UPDATE'), [...menuItemIdParam, ...menuItemUpdateRules], validate, updateMenuItem);
router.patch('/menu-items/:id/availability', authenticate, requirePermission('MENU_UPDATE'), menuItemIdParam, validate, toggleAvailability);
router.delete('/menu-items/:id', authenticate, requirePermission('MENU_DELETE'), menuItemIdParam, validate, deleteMenuItem);

export default router;
