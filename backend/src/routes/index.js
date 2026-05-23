import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import menuRoutes from '../modules/menu/menu.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import revenueRoutes from '../modules/revenue/revenue.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';
import branchRoutes from './branch.routes.js';
import posAuthRoutes from '../modules/pos/posAuth.routes.js';
import posDeviceRoutes from '../modules/pos/posDevice.routes.js';
import { optionalAuth } from '../middlewares/auth.js';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API đang hoạt động', data: { status: 'ok' } });
});

router.get('/dashboard', optionalAuth, getDashboard);

router.use('/auth', authRoutes);
router.use('/', menuRoutes);
router.use('/', inventoryRoutes);
router.use('/', revenueRoutes);
router.use('/', orderRoutes);
router.use('/', branchRoutes);
router.use('/pos', posAuthRoutes);
router.use('/pos/devices', posDeviceRoutes);

// Thứ tự mount: menu → inventory → revenue → orders → pos

export default router;
