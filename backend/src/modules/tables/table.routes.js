import { Router } from 'express';
import {
  listTables, getTable, createTable, updateTable, deleteTable,
} from './table.controller.js';
import { tableRules, tableUpdateRules, tableIdParam } from './table.validation.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, requirePermission('TABLE_VIEW'), listTables);
router.get('/:id', authenticate, requirePermission('TABLE_VIEW'), tableIdParam, validate, getTable);
router.post('/', authenticate, requirePermission('TABLE_CREATE'), tableRules, validate, createTable);
router.put('/:id', authenticate, requirePermission('TABLE_UPDATE'), [...tableIdParam, ...tableUpdateRules], validate, updateTable);
router.delete('/:id', authenticate, requirePermission('TABLE_DELETE'), tableIdParam, validate, deleteTable);

export default router;
