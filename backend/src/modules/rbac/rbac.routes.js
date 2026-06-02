import { Router } from 'express';
import { rbacController } from './rbac.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

// Tất cả các route này yêu cầu quyền quản lý permissions
router.use(authenticate);

router.get('/permissions', requirePermission('PERMISSION_VIEW'), rbacController.getPermissions);

router.get('/accounts', requirePermission('PERMISSION_VIEW'), rbacController.getAccounts);
router.get('/accounts/:accountId/permissions', requirePermission('PERMISSION_VIEW'), rbacController.getAccountPermissions);
router.put('/accounts/:accountId/permissions', requirePermission('PERMISSION_ASSIGN'), rbacController.updateAccountPermissions);

export default router;
