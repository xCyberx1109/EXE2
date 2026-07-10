import prisma from '../prisma/client.js';
import { buildBranchWhere } from '../middlewares/branchScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { menuItemRepository } from '../repositories/menuItem.repository.js';

function getContext(req) {
  return req.user || req.employee;
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

function vietnamNextDay(date) {
  const vietnamTime = new Date(date.getTime() + VIETNAM_TZ_OFFSET_MS);
  const nextDay = new Date(Date.UTC(
    vietnamTime.getUTCFullYear(),
    vietnamTime.getUTCMonth(),
    vietnamTime.getUTCDate() + 1,
  ));
  return new Date(nextDay.getTime() - VIETNAM_TZ_OFFSET_MS);
}

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - VIETNAM_TZ_OFFSET_MS);
}

function getDateRange(chartRange, todayStart, sevenDaysAgo, thirtyDaysAgo, customStart, customEnd) {
  if (customStart && customEnd) {
    const durationMs = customEnd.getTime() - customStart.getTime();
    const prevStart = new Date(customStart.getTime() - durationMs);
    return { startDate: customStart, endDate: customEnd, prevStart, prevEnd: customStart };
  }
  switch (chartRange) {
    case 'today':
      return { startDate: todayStart, prevDays: 1 };
    case '7days':
      return { startDate: sevenDaysAgo, prevDays: 7 };
    case '30days':
      return { startDate: thirtyDaysAgo, prevDays: 30 };
    default:
      return { startDate: sevenDaysAgo, prevDays: 7 };
  }
}

function buildDateWhere(startDate) {
  return {
    OR: [
      { completedAt: { gte: startDate } },
      { completedAt: null, createdAt: { gte: startDate } },
    ],
  };
}

function buildDateRangeWhere(startDate, endDate) {
  return {
    OR: [
      { completedAt: { gte: startDate, lt: endDate } },
      { completedAt: null, createdAt: { gte: startDate, lt: endDate } },
    ],
  };
}

export const getDashboard = asyncHandler(async (req, res) => {
  const ctx = getContext(req);

  const branchWhere = buildBranchWhere(ctx, {}, 'branchId');
  const accountWhere = buildBranchWhere(ctx, {}, 'accountId');
  const orderWhere = buildBranchWhere(ctx, {}, 'accountId');
  const chartRange = req.query.chartRange || '7days';

  const customStartDate = req.query.startDate ? parseLocalDate(req.query.startDate) : null;
  const customEndDate = req.query.endDate ? parseLocalDate(req.query.endDate) : null;
  const hasCustomRange = customStartDate && customEndDate && !isNaN(customStartDate.getTime()) && !isNaN(customEndDate.getTime());

  if (hasCustomRange) {
    customEndDate.setTime(vietnamNextDay(customEndDate).getTime());
  }

  const now = new Date();
  const todayStart = vietnamMidnight(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const twelveMonthsAgo = new Date(new Date(todayStart).setMonth(todayStart.getMonth() - 12));

  const { startDate, prevDays, prevStart, prevEnd, endDate: rangeEndDate } = getDateRange(
    chartRange, todayStart, sevenDaysAgo, thirtyDaysAgo,
    hasCustomRange ? customStartDate : null,
    hasCustomRange ? customEndDate : null,
  );

  const isCustom = hasCustomRange;
  const effectiveEndDate = isCustom ? rangeEndDate : undefined;

  let prevStartDate;
  if (isCustom && prevStart && prevEnd) {
    prevStartDate = prevStart;
  } else {
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - prevDays);
  }

  const currentWhere = effectiveEndDate
    ? buildDateRangeWhere(startDate, effectiveEndDate)
    : buildDateWhere(startDate);
  const prevWhere = isCustom && prevStart && prevEnd
    ? buildDateRangeWhere(prevStart, prevEnd)
    : buildDateRangeWhere(prevStartDate, startDate);

  const [rangeAgg, prevRangeAgg, statusCounts, topItemsData, lowStockData, menuCount, activityData, quickStatsAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'COMPLETED', ...currentWhere, ...orderWhere },
      _sum: { total: true, cost: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: { status: 'COMPLETED', ...prevWhere, ...orderWhere },
      _sum: { total: true, cost: true },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { ...currentWhere, ...orderWhere },
      _count: { id: true },
    }),
    getTopSellingItems(ctx, orderWhere, startDate, effectiveEndDate),
    getLowStockItems(accountWhere),
    prisma.menuItem.count({ where: { available: true, deletedAt: null, ...accountWhere } }),
    getRecentActivities(accountWhere),
    getQuickStats(orderWhere, thirtyDaysAgo),
  ]);

  const rangeOrders = rangeAgg._count.id;
  const rangeTotal = Number(rangeAgg._sum.total || 0);
  const rangeCost = Number(rangeAgg._sum.cost || 0);
  const rangeProfit = rangeTotal - rangeCost;

  const prevTotal = Number(prevRangeAgg._sum.total || 0);
  const prevCost = Number(prevRangeAgg._sum.cost || 0);
  const prevProfit = prevTotal - prevCost;
  const prevOrders = prevRangeAgg._count.id;

  const calcTrend = (curr, prev) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0);

  const statusMap = {};
  for (const s of statusCounts) {
    statusMap[s.status] = s._count.id;
  }

  const chartType = chartRange === 'today' && !isCustom ? 'hourly' : 'daily';
  const revenueChart = await getRevenueChartData(
    orderWhere, chartRange, todayStart, sevenDaysAgo, thirtyDaysAgo, twelveMonthsAgo,
    isCustom ? customStartDate : null,
    isCustom ? customEndDate : null,
  );

  const responseData = {
    message: 'Lấy dữ liệu dashboard thành công',
    data: {
      kpi: {
        todayRevenue: rangeTotal,
        todayRevenueTrend: calcTrend(rangeTotal, prevTotal),
        todayProfit: rangeProfit,
        todayProfitTrend: calcTrend(rangeProfit, prevProfit),
        todayOrders: rangeOrders,
        todayOrdersTrend: calcTrend(rangeOrders, prevOrders),
        todayCost: rangeCost,
        todayCostTrend: calcTrend(rangeCost, prevCost),
        todayAvgOrderValue: rangeOrders > 0 ? Math.round(rangeTotal / rangeOrders) : 0,
        todayAvgOrderValueTrend: calcTrend(
          rangeOrders > 0 ? Math.round(rangeTotal / rangeOrders) : 0,
          prevOrders > 0 ? Math.round(prevTotal / prevOrders) : 0
        ),
        activeMenuItems: menuCount,
        lowInventoryAlerts: lowStockData.length,
      },
      revenueChart,
      chartType,
      orderStatus: statusMap,
      topItems: topItemsData,
      lowStockItems: lowStockData,
      recentActivities: activityData,
      quickStats: quickStatsAgg,
    },
  };

  sendSuccess(res, responseData);
});

async function getRevenueChartData(orderWhere, range, todayStart, sevenDaysAgo, thirtyDaysAgo, twelveMonthsAgo, customStart, customEnd) {
  let startDate;
  let endDate;
  if (customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
  } else if (range === 'today') {
    startDate = todayStart;
    endDate = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  } else if (range === '30days') {
    startDate = thirtyDaysAgo;
  } else if (range === '12months') {
    startDate = twelveMonthsAgo;
  } else {
    startDate = sevenDaysAgo;
  }

  const dateFilter = endDate
    ? { completedAt: { gte: startDate, lt: endDate } }
    : { completedAt: { gte: startDate } };

  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      OR: [
        dateFilter,
        { completedAt: null, createdAt: dateFilter.completedAt },
      ],
      ...orderWhere,
    },
    select: { total: true, cost: true, completedAt: true, createdAt: true },
    orderBy: { completedAt: 'asc' },
    take: range === 'today' ? 5000 : 5000,
  });

  const isCustomRange = !!(customStart && customEnd);
  const useHourly = range === 'today' && !isCustomRange;

  if (useHourly) {
    const byHour = {};
    for (const order of orders) {
      const d = order.completedAt || order.createdAt;
      const vn = new Date(d.getTime() + VIETNAM_TZ_OFFSET_MS);
      const hour = String(vn.getUTCHours()).padStart(2, '0');
      const key = `${hour}:00`;
      if (!byHour[key]) byHour[key] = { date: key, revenue: 0, profit: 0, orderCount: 0 };
      byHour[key].revenue += Number(order.total);
      byHour[key].profit += Number(order.total) - Number(order.cost);
      byHour[key].orderCount += 1;
    }
    const result = [];
    for (let h = 0; h < 24; h++) {
      const key = `${String(h).padStart(2, '0')}:00`;
      result.push(byHour[key] || { date: key, revenue: 0, profit: 0, orderCount: 0 });
    }
    return result;
  }

  const byDate = {};
  for (const order of orders) {
    const d = order.completedAt || order.createdAt;
    const vn = new Date(d.getTime() + VIETNAM_TZ_OFFSET_MS);
    let key;
    if (range === '12months') {
      key = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      key = `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}-${String(vn.getUTCDate()).padStart(2, '0')}`;
    }
    if (!byDate[key]) byDate[key] = { date: key, revenue: 0, profit: 0, orderCount: 0 };
    byDate[key].revenue += Number(order.total);
    byDate[key].profit += Number(order.total) - Number(order.cost);
    byDate[key].orderCount += 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

async function getTopSellingItems(ctx, orderWhere, startDate, endDate) {
  const accountId = orderWhere.accountId;
  const orderFilter = startDate
    ? endDate
      ? { completedAt: { gte: startDate, lt: endDate } }
      : { completedAt: { gte: startDate } }
    : {};

  // MenuItem-based top selling
  const menuItemWhere = { menuItemId: { not: { equals: null } }, order: { status: 'COMPLETED', accountId, ...orderFilter } };
  const menuItemGrouped = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: { ...menuItemWhere, menuItemId: { not: { equals: null } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });

  // Direct inventory top selling (items with inventoryId and no menuItemId)
  const inventoryWhere = { inventoryId: { not: { equals: null } }, menuItemId: null, order: { status: 'COMPLETED', accountId, ...orderFilter } };
  const inventoryGrouped = await prisma.orderItem.groupBy({
    by: ['inventoryId'],
    where: inventoryWhere,
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });

  const result = [];

  if (menuItemGrouped.length > 0) {
    const ids = menuItemGrouped.map(g => g.menuItemId);
    const [menuItems, orderItems] = await Promise.all([
      prisma.menuItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
      prisma.orderItem.findMany({
        where: { menuItemId: { in: ids }, order: { status: 'COMPLETED', accountId, ...orderFilter } },
        select: { menuItemId: true, price: true, cost: true, quantity: true },
      }),
    ]);
    const menuMap = Object.fromEntries(menuItems.map(m => [m.id, m]));

    const revenueMap = {};
    const costMap = {};
    for (const item of orderItems) {
      if (!item.menuItemId) continue;
      revenueMap[item.menuItemId] = (revenueMap[item.menuItemId] || 0) + Number(item.price) * item.quantity;
      costMap[item.menuItemId] = (costMap[item.menuItemId] || 0) + Number(item.cost) * item.quantity;
    }

    for (const g of menuItemGrouped) {
      const rev = revenueMap[g.menuItemId] || 0;
      const cst = costMap[g.menuItemId] || 0;
      result.push({
        menuItemId: g.menuItemId,
        name: menuMap[g.menuItemId]?.name || 'Unknown',
        soldQuantity: g._sum.quantity,
        revenue: rev,
        cost: cst,
        profit: rev - cst,
        profitMargin: rev > 0 ? Math.round(((rev - cst) / rev) * 1000) / 10 : 0,
      });
    }
  }

  if (inventoryGrouped.length > 0) {
    const invIds = inventoryGrouped.map(g => g.inventoryId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: invIds } },
      select: { id: true, name: true },
    });
    const ingredientMap = Object.fromEntries(ingredients.map(i => [i.id, i]));

    const invOrderItems = await prisma.orderItem.findMany({
      where: { inventoryId: { in: invIds }, menuItemId: null, order: { status: 'COMPLETED', accountId, ...orderFilter } },
      select: { inventoryId: true, price: true, cost: true, quantity: true },
    });

    const revenueMap = {};
    const costMap = {};
    for (const item of invOrderItems) {
      if (!item.inventoryId) continue;
      revenueMap[item.inventoryId] = (revenueMap[item.inventoryId] || 0) + Number(item.price) * item.quantity;
      costMap[item.inventoryId] = (costMap[item.inventoryId] || 0) + Number(item.cost) * item.quantity;
    }

    for (const g of inventoryGrouped) {
      const rev = revenueMap[g.inventoryId] || 0;
      const cst = costMap[g.inventoryId] || 0;
      result.push({
        menuItemId: g.inventoryId,
        name: ingredientMap[g.inventoryId]?.name || 'Unknown',
        soldQuantity: g._sum.quantity,
        revenue: rev,
        cost: cst,
        profit: rev - cst,
        profitMargin: rev > 0 ? Math.round(((rev - cst) / rev) * 1000) / 10 : 0,
      });
    }
  }

  result.sort((a, b) => b.soldQuantity - a.soldQuantity);
  return result.slice(0, 5);
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

async function getRecentActivities(where) {
  try {
    if (!where?.accountId) return [];
    const logs = await prisma.activityLog.findMany({
      where,
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
  } catch (err) {
    console.error('[Dashboard] getRecentActivities error:', err.message);
    return [];
  }
}

async function getQuickStats(orderWhere, thirtyDaysAgo) {
  const agg = await prisma.order.aggregate({
    where: {
      status: 'COMPLETED',
      OR: [
        { completedAt: { gte: thirtyDaysAgo } },
        { completedAt: null, createdAt: { gte: thirtyDaysAgo } },
      ],
      ...orderWhere,
    },
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
