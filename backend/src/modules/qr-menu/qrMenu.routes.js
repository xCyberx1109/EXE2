import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import {
  listTableQrLinks,
  resolvePublicMenu,
  submitPublicOrder,
} from './qrMenu.controller.js';

const router = Router();

// Owner / dashboard
router.get('/qr-menu/tables', authenticate, listTableQrLinks);

// Public for customer
router.get('/qr-menu/public', resolvePublicMenu);
router.post('/qr-menu/public/order', submitPublicOrder);

export default router;