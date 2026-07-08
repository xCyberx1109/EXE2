import { Router } from 'express';

import { authenticate, requirePermission } from '../../middlewares/auth.js';
import {
  listTableLinks,
  resolvePublicMenu,
  submitPublicOrder,
} from './qrMenu.controller.js';

const router = Router();

router.get(
  '/qr-menu/tables',
  authenticate,
  requirePermission('RESTAURANT_TABLE_VIEW'),
  listTableLinks,
);

router.get('/qr-menu/public', resolvePublicMenu);
router.post('/qr-menu/public/order', submitPublicOrder);

export default router;
