import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import menuRoutes from '../modules/menu/menu.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import revenueRoutes from '../modules/revenue/revenue.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';
import { getDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'API đang hoạt động', data: { status: 'ok' } });
});

router.get('/dashboard', getDashboard);

router.use('/auth', authRoutes);
router.use('/', menuRoutes);
router.use('/', inventoryRoutes);
router.use('/', revenueRoutes);
router.use('/', orderRoutes);

// Thứ tự mount: menu → inventory → revenue → orders (không dùng router.use(authenticate) chung)

export default router;
