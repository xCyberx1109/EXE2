import prisma from '../../prisma/client.js';
import { mapRevenueRecord } from '../../utils/mappers.js';
import { revenueRepository } from '../../repositories/revenue.repository.js';
import { menuItemRepository } from '../../repositories/menuItem.repository.js';
import { orderRepository } from '../../repositories/order.repository.js';

function getBranchWhere(user) {
  return user && user.role !== 'ADMIN' && user.branchId ? { branchId: user.branchId } : {};
}

export const revenueService = {
  /** Báo cáo theo ngày - khớp revenueRecords frontend */
  async getDailyReports({ range = '14days', from, to }, user) {
    const branchWhere = getBranchWhere(user);
    const where = buildDateWhere({ range, from, to });
    const reports = await revenueRepository.findReports(where);

    if (reports.length > 0) {
      return reports.map(mapRevenueRecord);
    }

    // Fallback: tính từ đơn COMPLETED nếu chưa có revenue_reports
    return this.aggregateDailyFromOrders({ range, from, to }, branchWhere);
  },

  /** Tổng hợp thống kê theo khoảng thời gian */
  async getSummary({ range = '14days', from, to }, user) {
    const records = await this.getDailyReports({ range, from, to }, user);

    const totalRevenue = records.reduce((s, r) => s + r.revenue, 0);
    const totalProfit = records.reduce((s, r) => s + r.profit, 0);
    const totalOrders = records.reduce((s, r) => s + r.orderCount, 0);
    const totalCost = records.reduce((s, r) => s + r.cost, 0);

    return {
      totalRevenue,
      totalProfit,
      totalCost,
      totalOrders,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      avgRevenuePerDay: records.length > 0 ? totalRevenue / records.length : 0,
      days: records.length,
    };
  },

  /** Thống kê theo period: day | month | year */
  async getStatsByPeriod(period = 'day', user) {
    const branchWhere = getBranchWhere(user);
    const where = { status: 'COMPLETED', ...branchWhere };
    const completedOrders = await prisma.order.findMany({
      where,
      select: {
        total: true,
        cost: true,
        profit: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const grouped = {};

    for (const order of completedOrders) {
      const date = order.completedAt || order.createdAt;
      const key = formatPeriodKey(date, period);
      if (!grouped[key]) {
        grouped[key] = { period: key, orderCount: 0, revenue: 0, cost: 0, profit: 0 };
      }
      grouped[key].orderCount += 1;
      grouped[key].revenue += Number(order.total);
      grouped[key].cost += Number(order.cost);
      grouped[key].profit += Number(order.profit);
    }

    return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
  },

  /** Top món bán chạy */
  async getTopSellingItems(limit = 8, user) {
    const branchId = user && user.role !== 'ADMIN' ? user.branchId : undefined;
    const grouped = await orderRepository.aggregateTopItems(limit, branchId);
    const result = [];

    for (const g of grouped) {
      if (!g.menuItemId) continue;
      const item = await menuItemRepository.findById(g.menuItemId);
      result.push({
        menuItemId: g.menuItemId,
        quantity: g._sum.quantity,
        name: item?.name,
        category: item?.category?.name,
        price: item ? Number(item.price) : 0,
      });
    }

    return result;
  },

  /** Dashboard overview */
  async getOverview(user) {
    const [summary, topItems] = await Promise.all([
      this.getSummary({ range: '30days' }, user),
      this.getTopSellingItems(5, user),
    ]);

    const branchWhere = getBranchWhere(user);
    const lowStockItems = await prisma.ingredient.findMany({ where: branchWhere });
    const lowStockCount = lowStockItems.filter((i) => Number(i.quantity) < Number(i.minQuantity)).length;
    const menuAvailable = await prisma.menuItem.count({ where: { available: true, ...branchWhere } });
    const menuTotal = await prisma.menuItem.count({ where: branchWhere });

    return {
      ...summary,
      topItems,
      lowStockCount,
      menuAvailable,
      menuTotal,
    };
  },

  /** Tổng hợp doanh thu theo ngày từ orders */
  async aggregateDailyFromOrders({ range = '14days', from, to }, branchWhere = {}) {
    const start = getRangeStartDate({ range, from, to });

    const orders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        ...branchWhere,
        OR: [
          { completedAt: { gte: start } },
          { completedAt: null, createdAt: { gte: start } },
        ],
      },
      select: {
        total: true,
        cost: true,
        profit: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const byDate = {};

    for (const order of orders) {
      const d = order.completedAt || order.createdAt;
      const key = formatDateKey(d);
      if (!byDate[key]) {
        byDate[key] = { orderCount: 0, revenue: 0, cost: 0, profit: 0 };
      }
      byDate[key].orderCount += 1;
      byDate[key].revenue += Number(order.total);
      byDate[key].cost += Number(order.cost);
      byDate[key].profit += Number(order.profit);
    }

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats], index) => ({
        id: `computed-${index}`,
        date,
        orderCount: stats.orderCount,
        revenue: stats.revenue,
        cost: stats.cost,
        profit: stats.profit,
      }));
  },

  /** Đồng bộ revenue_reports từ orders đã hoàn thành */
  async syncRevenueReports(branchId) {
    const where = { status: 'COMPLETED' };
    if (branchId) where.branchId = branchId;
    const orders = await prisma.order.findMany({
      where,
      select: {
        total: true,
        cost: true,
        profit: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const byDate = {};

    for (const order of orders) {
      const d = order.completedAt || order.createdAt;
      const key = d.toISOString().split('T')[0];
      if (!byDate[key]) {
        byDate[key] = { orderCount: 0, revenue: 0, cost: 0, profit: 0 };
      }
      byDate[key].orderCount += 1;
      byDate[key].revenue += Number(order.total);
      byDate[key].cost += Number(order.cost);
      byDate[key].profit += Number(order.profit);
    }

    for (const [dateStr, stats] of Object.entries(byDate)) {
      const reportDate = new Date(dateStr);
      await revenueRepository.upsert(reportDate, stats);
    }

    return Object.keys(byDate).length;
  },
};

function getRangeStartDate({ range, from }) {
  if (from) return new Date(from);
  const days = range === '7days' ? 7 : range === '30days' ? 30 : 14;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDateWhere({ range, from, to }) {
  const where = {};

  if (from || to) {
    where.reportDate = {};
    if (from) where.reportDate.gte = new Date(from);
    if (to) where.reportDate.lte = new Date(to);
    return where;
  }

  const days = range === '7days' ? 7 : range === '30days' ? 30 : 14;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  where.reportDate = { gte: start };
  return where;
}

function formatPeriodKey(date, period) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (period === 'year') return `${y}`;
  if (period === 'month') return `${y}-${m}`;
  return `${y}-${m}-${day}`;
}
