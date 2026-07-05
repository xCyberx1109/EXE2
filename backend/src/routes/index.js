import { Router } from 'express';
import unifiedAuthRoutes from '../modules/unifiedAuth/unifiedAuth.routes.js';
import menuRoutes from '../modules/menu/menu.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import orderRoutes from '../modules/orders/order.routes.js';
import branchRoutes from './branch.routes.js';
import branchInvitationRoutes from './branchInvitation.routes.js';
import inviteRoutes from './invite.routes.js';
import rbacRoutes from '../modules/rbac/rbac.routes.js';
import tableRoutes from '../modules/tables/table.routes.js';
import billiardRoutes from '../modules/billiard/billiard.routes.js';
import employeeRoutes from '../modules/employee/employee.routes.js';
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
router.use('/', orderRoutes);
router.use('/branches', branchRoutes);
router.use('/branch-invitations', branchInvitationRoutes);
router.use('/invite', inviteRoutes);

router.use('/rbac', rbacRoutes);
router.use('/tables', tableRoutes);
router.use('/', billiardRoutes);
router.use('/employees', employeeRoutes);

// Legacy order routes kept for compatibility
router.get('/orders', (_req, res) => res.redirect('/api/orders'));
router.post('/orders', (_req, res) => res.redirect('/api/orders'));

export default router;
