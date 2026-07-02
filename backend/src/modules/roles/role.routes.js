import { Router } from 'express';
import {
  listRoles, getRole, createRole, updateRole, deleteRole, updateRolePermissions,
} from './role.controller.js';
import { roleRules, roleUpdateRules, roleIdParam, rolePermissionsRules } from './role.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.use(authenticate, requirePermission('ROLE_MANAGE'));

router.get('/', listRoles);
router.get('/:id', roleIdParam, validate, getRole);
router.post('/', roleRules, validate, createRole);
router.put('/:id', [...roleIdParam, ...roleUpdateRules], validate, updateRole);
router.delete('/:id', roleIdParam, validate, deleteRole);
router.put('/:id/permissions', [...roleIdParam, ...rolePermissionsRules], validate, updateRolePermissions);

export default router;
