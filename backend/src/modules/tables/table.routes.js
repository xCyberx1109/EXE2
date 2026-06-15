import { Router } from 'express';
import {
  listTables, getTable, createTable, updateTable, deleteTable,
  listPosTables, assignOrder, releaseTable, updateTableStatus, checkInReservation, updateTableLayout,
} from './table.controller.js';
import { tableRules, tableUpdateRules, tableIdParam, tablePosStatusRules, tableLayoutRules } from './table.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission, optionalAuth } from '../../middlewares/auth.js';
import { requireDevicePermission } from '../../middlewares/devicePermission.js';

const router = Router();

// Admin CRUD
router.get('/', authenticate, requirePermission('TABLE_VIEW'), listTables);
router.get('/:id', authenticate, requirePermission('TABLE_VIEW'), tableIdParam, validate, getTable);
router.post('/', authenticate, requirePermission('TABLE_CREATE'), tableRules, validate, createTable);
router.put('/:id', authenticate, requirePermission('TABLE_UPDATE'), [...tableIdParam, ...tableUpdateRules], validate, updateTable);
router.delete('/:id', authenticate, requirePermission('TABLE_DELETE'), tableIdParam, validate, deleteTable);

// Layout
router.put('/layout', authenticate, requirePermission('TABLE_LAYOUT_EDIT'), tableLayoutRules, validate, updateTableLayout);

// POS endpoints
router.get('/pos/list', optionalAuth, listPosTables);
router.post('/:id/assign-order', optionalAuth, tableIdParam, validate, assignOrder);
router.post('/:id/release', optionalAuth, tableIdParam, validate, releaseTable);
router.put('/:id/status', optionalAuth, [...tableIdParam, ...tablePosStatusRules], validate, updateTableStatus);
router.post('/:id/check-in', optionalAuth, tableIdParam, validate, checkInReservation);

export default router;
