import { Router } from 'express';
import { rbacController } from './rbac.controller.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.use(authenticate);

router.get('/permissions', requirePermission('PERMISSION_VIEW'), rbacController.getPermissions);
router.get('/accounts', requirePermission('PERMISSION_VIEW'), rbacController.getAccounts);
router.get('/accounts/:accountId/permissions', requirePermission('PERMISSION_VIEW'), rbacController.getAccountPermissions);
router.put('/accounts/:accountId/permissions', requirePermission('PERMISSION_MANAGE'), rbacController.updateAccountPermissions);

export default router;
