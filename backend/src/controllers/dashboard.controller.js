import prisma from '../prisma/client.js';
import { buildBranchWhere } from '../middlewares/branchScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { menuItemRepository } from '../repositories/menuItem.repository.js';

function getContext(req) {
  return req.user || req.posDevice;
}

export const getDashboard = asyncHandler(async (req, res) => {
  const ctx = getContext(req);
  const branchWhere = buildBranchWhere(ctx);
  const chartRange = req.query.chartRange || '7days';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  const [
    todayAgg,
    yesterdayAgg,
    statusCounts,
    topItemsData,
    lowStockData,
    menuCount,
    activityData,
    quickStatsAgg,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: todayStart }, ...branchWhere },
      _sum: { total: true, cost: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: yesterdayStart, lt: todayStart }, ...branchWhere },
      _sum: { total: true, cost: true },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { ...branchWhere },
      _count: { id: true },
    }),
    getTopSellingItems(ctx, branchWhere),
    getLowStockItems(branchWhere),
    prisma.menuItem.count({ where: { available: true, deletedAt: null, ...branchWhere } }),
    getRecentActivities(branchWhere),
    getQuickStats(branchWhere, thirtyDaysAgo),
  ]);

  const todayTotal = Number(todayAgg._sum.total || 0);
  const todayCost = Number(todayAgg._sum.cost || 0);
  const todayProfit = todayTotal - todayCost;
  const todayOrders = todayAgg._count.id;

  const yesterdayTotal = Number(yesterdayAgg._sum.total || 0);
  const yesterdayCost = Number(yesterdayAgg._sum.cost || 0);
  const yesterdayProfit = yesterdayTotal - yesterdayCost;
  const yesterdayOrders = yesterdayAgg._count.id;

  const calcTrend = (curr, prev) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0);

  const statusMap = {};
  for (const s of statusCounts) {
    statusMap[s.status] = s._count.id;
  }

  const revenueChart = await getRevenueChartData(branchWhere, chartRange, todayStart, sevenDaysAgo, thirtyDaysAgo, twelveMonthsAgo);

  sendSuccess(res, {
    message: 'Lấy dữ liệu dashboard thành công',
    data: {
      kpi: {
        todayRevenue: todayTotal,
        todayRevenueTrend: calcTrend(todayTotal, yesterdayTotal),
        todayProfit: todayProfit,
        todayProfitTrend: calcTrend(todayProfit, yesterdayProfit),
        todayOrders: todayOrders,
        todayOrdersTrend: calcTrend(todayOrders, yesterdayOrders),
        activeMenuItems: menuCount,
        lowInventoryAlerts: lowStockData.length,
      },
      revenueChart,
      orderStatus: statusMap,
      topItems: topItemsData,
      lowStockItems: lowStockData,
      recentActivities: activityData,
      quickStats: quickStatsAgg,
    },
  });
});

async function getRevenueChartData(branchWhere, range, _todayStart, sevenDaysAgo, thirtyDaysAgo, twelveMonthsAgo) {
  let startDate;
  if (range === '30days') startDate = thirtyDaysAgo;
  else if (range === '12months') startDate = twelveMonthsAgo;
  else startDate = sevenDaysAgo;

  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: startDate }, ...branchWhere },
    select: { total: true, cost: true, completedAt: true, createdAt: true },
    orderBy: { completedAt: 'asc' },
    take: 5000,
  });

  const byDate = {};
  for (const order of orders) {
    const d = order.completedAt || order.createdAt;
    let key;
    if (range === '12months') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];
    }
    if (!byDate[key]) byDate[key] = { date: key, revenue: 0, profit: 0, orderCount: 0 };
    byDate[key].revenue += Number(order.total);
    byDate[key].profit += Number(order.total) - Number(order.cost);
    byDate[key].orderCount += 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

async function getTopSellingItems(ctx, branchWhere) {
  const canAccessAll = ctx?.permissions?.includes('BRANCH_ALL_ACCESS') || ctx?.permissions?.includes('CROSS_BRANCH_ACCESS');
  const branchId = !canAccessAll ? branchWhere.branchId : undefined;

  const where = { menuItemId: { not: null }, order: { status: 'COMPLETED' } };
  if (branchId) where.order.branchId = branchId;

  const grouped = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where,
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });

  if (grouped.length === 0) return [];

  const ids = grouped.map(g => g.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, category: { select: { name: true } } },
  });
  const menuMap = Object.fromEntries(menuItems.map(m => [m.id, m]));

  return grouped.map(g => ({
    menuItemId: g.menuItemId,
    name: menuMap[g.menuItemId]?.name || 'Unknown',
    category: menuMap[g.menuItemId]?.category?.name || '',
    quantity: g._sum.quantity,
    revenue: 0,
  }));
}

async function getLowStockItems(branchWhere) {
  const items = await prisma.ingredient.findMany({
    where: { ...branchWhere, available: true },
    select: { id: true, name: true, unit: true, quantity: true, warningQuantity: true },
    orderBy: { quantity: 'asc' },
    take: 50,
  });
  return items
    .filter((i) => Number(i.quantity) <= Number(i.warningQuantity))
    .slice(0, 10)
    .map(i => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      quantity: Number(i.quantity),
      warningQuantity: Number(i.warningQuantity),
      status: Number(i.quantity) === 0 ? 'out_of_stock' : 'low_stock',
    }));
}

async function getRecentActivities(branchWhere) {
  if (!branchWhere?.branchId) return [];
  const logs = await prisma.activityLog.findMany({
    where: branchWhere,
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { account: { select: { id: true, fullName: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    module: l.module,
    details: l.details,
    createdAt: l.createdAt,
    user: l.account?.fullName || null,
  }));
}

async function getQuickStats(branchWhere, thirtyDaysAgo) {
  const agg = await prisma.order.aggregate({
    where: { status: 'COMPLETED', completedAt: { gte: thirtyDaysAgo }, ...branchWhere },
    _sum: { total: true, cost: true, guestCount: true },
    _count: { id: true },
  });

  const totalRevenue = Number(agg._sum.total || 0);
  const totalCost = Number(agg._sum.cost || 0);
  const totalOrders = agg._count.id;
  const totalCustomers = Number(agg._sum.guestCount || 0);

  return {
    totalRevenue30d: totalRevenue,
    totalProfit30d: totalRevenue - totalCost,
    avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    totalCustomersServed: totalCustomers,
    profitMargin: totalRevenue > 0 ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 1000) / 10 : 0,
  };
}
