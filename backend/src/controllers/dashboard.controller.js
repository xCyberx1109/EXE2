import prisma from '../prisma/client.js';
import { buildBranchWhere } from '../middlewares/branchScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { menuItemRepository } from '../repositories/menuItem.repository.js';

function getContext(req) {
  return req.user || req.posDevice;
}

// Timezone offset for Vietnam (UTC+7) - used for date boundary calculations
const VIETNAM_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Convert a UTC Date to Vietnam timezone start-of-day (midnight) as UTC timestamp.
 * E.g. Vietnam 2024-06-06 00:00:00 UTC+7 = 2024-06-05 17:00:00 UTC
 */
function vietnamMidnight(date) {
  const vietnamTime = new Date(date.getTime() + VIETNAM_TZ_OFFSET_MS);
  const vietnamMidnight = new Date(Date.UTC(
    vietnamTime.getUTCFullYear(),
    vietnamTime.getUTCMonth(),
    vietnamTime.getUTCDate(),
  ));
  return new Date(vietnamMidnight.getTime() - VIETNAM_TZ_OFFSET_MS);
}

export const getDashboard = asyncHandler(async (req, res) => {
  const ctx = getContext(req);

  const branchWhere = buildBranchWhere(ctx);
  const accountWhere = buildBranchWhere(ctx, {}, 'accountId');
  const orderWhere = buildBranchWhere(ctx, {}, 'accountId');
  const chartRange = req.query.chartRange || '7days';

  const now = new Date();
  const todayStart = vietnamMidnight(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const twelveMonthsAgo = new Date(new Date(todayStart).setMonth(todayStart.getMonth() - 12));

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
      where: { status: 'COMPLETED', completedAt: { gte: todayStart }, ...orderWhere },
      _sum: { total: true, cost: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: yesterdayStart, lt: todayStart }, ...orderWhere },
      _sum: { total: true, cost: true },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { ...orderWhere },
      _count: { id: true },
    }),
    getTopSellingItems(ctx, orderWhere),
    getLowStockItems(accountWhere),
    prisma.menuItem.count({ where: { available: true, deletedAt: null, ...accountWhere } }),
    getRecentActivities(branchWhere),
    getQuickStats(orderWhere, thirtyDaysAgo),
  ]);

  const todayOrders = todayAgg._count.id;
  const todayTotal = Number(todayAgg._sum.total || 0);
  const todayCost = Number(todayAgg._sum.cost || 0);
  const todayProfit = todayTotal - todayCost;

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

  const revenueChart = await getRevenueChartData(orderWhere, chartRange, todayStart, sevenDaysAgo, thirtyDaysAgo, twelveMonthsAgo);

  const responseData = {
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
  };

  sendSuccess(res, responseData);
});

async function getRevenueChartData(orderWhere, range, _todayStart, sevenDaysAgo, thirtyDaysAgo, twelveMonthsAgo) {
  let startDate;
  if (range === '30days') startDate = thirtyDaysAgo;
  else if (range === '12months') startDate = twelveMonthsAgo;
  else startDate = sevenDaysAgo;

  const orders = await prisma.order.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: startDate }, ...orderWhere },
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

async function getTopSellingItems(ctx, orderWhere) {
  const canAccessAll = ctx?.permissions?.includes('BRANCH_ALL_ACCESS') || ctx?.permissions?.includes('CROSS_BRANCH_ACCESS');
  const accountId = !canAccessAll ? orderWhere.accountId : undefined;

  const where = { menuItemId: { not: { equals: null } }, order: { status: 'COMPLETED' } };
  if (accountId) where.order.accountId = accountId;

  const grouped = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where,
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });

  console.log("[TOP SELLING ITEMS grouped]", JSON.stringify(grouped, null, 2));

  if (grouped.length === 0) return [];

  const ids = grouped.map(g => g.menuItemId);
  const [menuItems, orderItems] = await Promise.all([
    prisma.menuItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
    prisma.orderItem.findMany({
      where: { menuItemId: { in: ids }, order: { status: 'COMPLETED' } },
      select: { menuItemId: true, price: true, quantity: true },
    }),
  ]);
  const menuMap = Object.fromEntries(menuItems.map(m => [m.id, m]));

  const revenueMap = {};
  for (const item of orderItems) {
    if (!item.menuItemId) continue;
    revenueMap[item.menuItemId] = (revenueMap[item.menuItemId] || 0) + Number(item.price) * item.quantity;
  }

  const result = grouped.map(g => ({
    menuItemId: g.menuItemId,
    name: menuMap[g.menuItemId]?.name || 'Unknown',
    category: menuMap[g.menuItemId]?.category?.name || '',
    soldQuantity: g._sum.quantity,
    revenue: revenueMap[g.menuItemId] || 0,
  }));

  console.log("[TOP SELLING RESULT]", JSON.stringify(result, null, 2));
  return result;
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

async function getQuickStats(orderWhere, thirtyDaysAgo) {
  const agg = await prisma.order.aggregate({
    where: { status: 'COMPLETED', completedAt: { gte: thirtyDaysAgo }, ...orderWhere },
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
