import { Router } from 'express';
import {
  getDailyReports, getSummary, getStatsByPeriod,
  getTopSelling, getOverview, syncReports,
} from './revenue.controller.js';
import { revenueRangeQuery } from '../../validators/revenue.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, optionalAuth } from '../../middlewares/auth.js';

const router = Router();

router.get('/revenue/daily', optionalAuth, revenueRangeQuery, validate, getDailyReports);
router.get('/revenue/summary', optionalAuth, revenueRangeQuery, validate, getSummary);
router.get('/revenue/stats', optionalAuth, revenueRangeQuery, validate, getStatsByPeriod);
router.get('/revenue/top-items', optionalAuth, revenueRangeQuery, validate, getTopSelling);
router.get('/revenue/overview', optionalAuth, getOverview);

router.post('/revenue/sync', authenticate, authorize('ADMIN'), syncReports);

export default router;
