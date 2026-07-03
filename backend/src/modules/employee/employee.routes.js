import { Router } from 'express';
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  resetEmployeePin,
  deleteEmployee,
  getEmployeeLogs,
  getEmployeePermissions,
  updateEmployeePermissions,
  getPermissionTemplates,
  loginByPin,
} from './employee.controller.js';
import {
  createEmployeeRules,
  updateEmployeeRules,
  employeeIdParam,
  employeeQueryParams,
} from './employee.validation.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';

const router = Router();

router.post('/login-by-pin', loginByPin);

router.use(authenticate);

router.get('/templates/list', requirePermission('STAFF_CREATE'), getPermissionTemplates);
router.get('/', requirePermission('STAFF_VIEW'), employeeQueryParams, validate, listEmployees);
router.get('/:id', requirePermission('STAFF_VIEW'), employeeIdParam, validate, getEmployee);
router.post('/', requirePermission('STAFF_CREATE'), createEmployeeRules, validate, createEmployee);
router.put('/:id', requirePermission('STAFF_UPDATE'), [...employeeIdParam, ...updateEmployeeRules], validate, updateEmployee);
router.post('/:id/reset-pin', requirePermission('STAFF_RESET_PIN'), employeeIdParam, validate, resetEmployeePin);
router.delete('/:id', requirePermission('STAFF_DELETE'), employeeIdParam, validate, deleteEmployee);
router.get('/:id/logs', requirePermission('STAFF_VIEW'), employeeIdParam, validate, getEmployeeLogs);
router.get('/:id/permissions', requirePermission('STAFF_VIEW'), employeeIdParam, validate, getEmployeePermissions);
router.put('/:id/permissions', requirePermission('STAFF_MANAGE'), employeeIdParam, validate, updateEmployeePermissions);

export default router;
