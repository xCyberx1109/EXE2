import { revenueService } from './revenue.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const getDailyReports = asyncHandler(async (req, res) => {
  const data = await revenueService.getDailyReports(req.query);
  sendSuccess(res, { message: 'Lấy báo cáo doanh thu thành công', data });
});

export const getSummary = asyncHandler(async (req, res) => {
  const data = await revenueService.getSummary(req.query);
  sendSuccess(res, { message: 'Lấy tổng hợp doanh thu thành công', data });
});

export const getStatsByPeriod = asyncHandler(async (req, res) => {
  const period = req.query.period || 'day';
  const data = await revenueService.getStatsByPeriod(period);
  sendSuccess(res, { message: 'Lấy thống kê theo kỳ thành công', data });
});

export const getTopSelling = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const data = await revenueService.getTopSellingItems(limit);
  sendSuccess(res, { message: 'Lấy top món bán chạy thành công', data });
});

export const getOverview = asyncHandler(async (_req, res) => {
  const data = await revenueService.getOverview();
  sendSuccess(res, { message: 'Lấy tổng quan thành công', data });
});

export const syncReports = asyncHandler(async (_req, res) => {
  const count = await revenueService.syncRevenueReports();
  sendSuccess(res, { message: `Đồng bộ ${count} báo cáo thành công`, data: { syncedDays: count } });
});
