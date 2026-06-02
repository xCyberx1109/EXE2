import { revenueService } from './revenue.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { buildBranchWhere } from '../../middlewares/branchScope.js';

export const getDailyReports = asyncHandler(async (req, res) => {
  const data = await revenueService.getDailyReports(req.query, req.user);
  sendSuccess(res, { message: 'Lấy báo cáo doanh thu thành công', data });
});

export const getSummary = asyncHandler(async (req, res) => {
  const data = await revenueService.getSummary(req.query, req.user);
  sendSuccess(res, { message: 'Lấy tổng hợp doanh thu thành công', data });
});

export const getStatsByPeriod = asyncHandler(async (req, res) => {
  const period = req.query.period || 'day';
  const data = await revenueService.getStatsByPeriod(period, req.user);
  sendSuccess(res, { message: 'Lấy thống kê theo kỳ thành công', data });
});

export const getTopSelling = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10);
  const data = await revenueService.getTopSellingItems(limit, req.user);
  sendSuccess(res, { message: 'Lấy top món bán chạy thành công', data });
});

export const getOverview = asyncHandler(async (req, res) => {
  const data = await revenueService.getOverview(req.user);
  sendSuccess(res, { message: 'Lấy tổng quan thành công', data });
});

export const syncReports = asyncHandler(async (req, res) => {
  const branchWhere = buildBranchWhere(req.user);
  const branchId = branchWhere.branchId;
  const count = await revenueService.syncRevenueReports(branchId);
  sendSuccess(res, { message: `Đồng bộ ${count} báo cáo thành công`, data: { syncedDays: count } });
});
