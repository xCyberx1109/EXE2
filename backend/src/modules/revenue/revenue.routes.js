import { Router } from 'express';
import {
  getDailyReports, getSummary, getStatsByPeriod,
  getTopSelling, getOverview, syncReports,
} from './revenue.controller.js';
import { revenueRangeQuery } from '../../validators/revenue.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, requirePermission } from '../../middlewares/auth.js';

const router = Router();

router.get('/revenue/daily', optionalAuth, requirePermission('REPORT_VIEW'), revenueRangeQuery, validate, getDailyReports);
router.get('/revenue/summary', optionalAuth, requirePermission('REPORT_VIEW'), revenueRangeQuery, validate, getSummary);
router.get('/revenue/stats', optionalAuth, requirePermission('REPORT_VIEW'), revenueRangeQuery, validate, getStatsByPeriod);
router.get('/revenue/top-items', optionalAuth, requirePermission('REPORT_VIEW'), revenueRangeQuery, validate, getTopSelling);
router.get('/revenue/overview', optionalAuth, requirePermission('REPORT_VIEW'), getOverview);

router.post('/revenue/sync', authenticate, requirePermission('REPORT_VIEW'), syncReports);

export default router;
