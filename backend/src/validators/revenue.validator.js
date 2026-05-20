import { query } from 'express-validator';

export const revenueRangeQuery = [
  query('range').optional().isIn(['7days', '14days', '30days']),
  query('period').optional().isIn(['day', 'month', 'year']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
];
