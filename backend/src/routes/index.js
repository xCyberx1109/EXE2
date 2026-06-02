import { Router } from 'express';
import unifiedAuthRoutes from '../modules/unifiedAuth/unifiedAuth.routes.js';
import menuRoutes from '../modules/menu/menu.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import revenueRoutes from '../modules/revenue/revenue.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';
import branchRoutes from './branch.routes.js';
import posDevicesRoutes from '../modules/posDevices/posDevices.routes.js';
import staffAuthRoutes from '../modules/staffAuth/staffAuth.routes.js';
import shiftRoutes from '../modules/shifts/shift.routes.js';
import rbacRoutes from '../modules/rbac/rbac.routes.js';
import tableRoutes from '../modules/tables/table.routes.js';
import { optionalAuth } from '../middlewares/auth.js';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API đang hoạt động', data: { status: 'ok' } });
});

router.get('/dashboard', optionalAuth, getDashboard);

// ===== Unified Auth (merged: user login + POS device login) =====
router.use('/auth', unifiedAuthRoutes);

router.use('/', menuRoutes);
router.use('/', inventoryRoutes);
router.use('/', revenueRoutes);
router.use('/', orderRoutes);
router.use('/', branchRoutes);

// POS v2 modules (enterprise-grade)
router.use('/pos-v2/devices', posDevicesRoutes);
router.use('/pos-v2/staff-auth', staffAuthRoutes);
router.use('/pos-v2/shifts', shiftRoutes);
router.use('/rbac', rbacRoutes);
router.use('/tables', tableRoutes);

// Legacy order routes kept for compatibility
router.get('/orders', (_req, res) => res.redirect('/api/orders'));
router.post('/orders', (_req, res) => res.redirect('/api/orders'));

export default router;
