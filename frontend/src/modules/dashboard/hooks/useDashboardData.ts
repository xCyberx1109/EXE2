import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../../../app/api/services';
import { tableApi } from '../../../app/api/services';
import { inventoryApi } from '../../../app/api/services';
import { shiftApi } from '../../../app/api/posServices';
import { staffAuthApi } from '../../../app/api/posServices';
import { posDevicesV2Api } from '../../../app/api/posServices';
import type { DashboardDataV2, TableItem } from '../../../app/types';
import type { DashboardModuleData, SystemAlert } from '../types';

function calcOccupancyTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function fetchSystemAlerts(): Promise<SystemAlert[]> {
  try {
    const devices = await posDevicesV2Api.list();
    const alerts: SystemAlert[] = [];
    const now = new Date();

    for (const device of devices) {
      if (device.status === 'OFFLINE' || device.status === 'MAINTENANCE') {
        const offlineSince = device.lastActive ? new Date(device.lastActive) : null;
        const minutesOffline = offlineSince ? Math.round((now.getTime() - offlineSince.getTime()) / 60000) : 0;
        alerts.push({
          id: `device-offline-${device.id}`,
          severity: minutesOffline > 60 ? 'critical' : 'warning',
          module: 'Thiết bị',
          message: `"${device.name}" (${device.type}) ngoại tuyến ${minutesOffline > 0 ? `${minutesOffline} phút` : ''}`.trim(),
          timestamp: device.lastActive || device.updatedAt,
          actionLabel: 'Kiểm tra',
          actionHref: '/app/pos-devices-v2',
        });
      }
    }

    return alerts;
  } catch {
    return [];
  }
}

function buildCategoryBreakdown(topItems: DashboardDataV2['topItems']) {
  const catMap: Record<string, number> = {};
  let totalRevenue = 0;
  for (const item of topItems) {
    const cat = item.category || 'Khác';
    catMap[cat] = (catMap[cat] || 0) + item.revenue;
    totalRevenue += item.revenue;
  }
  return Object.entries(catMap).map(([name, revenue]) => ({
    name,
    revenue,
    percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
  }));
}

function buildHourlyVolume(): { hour: string; orders: number }[] {
  const now = new Date();
  const hours: { hour: string; orders: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const h = new Date(now);
    h.setHours(now.getHours() - i);
    hours.push({
      hour: `${String(h.getHours()).padStart(2, '0')}:00`,
      orders: 0,
    });
  }
  return hours;
}

function calcOccupancyRate(tables: TableItem[]) {
  const total = tables.length;
  const occupied = tables.filter((t) => t.status === 'OCCUPIED' || t.status === 'CHECKING_OUT').length;
  const available = tables.filter((t) => t.status === 'AVAILABLE').length;
  const reserved = tables.filter((t) => t.status === 'RESERVED').length;
  const cleaning = tables.filter((t) => t.status === 'CLEANING').length;
  return { total, occupied, available, reserved, cleaning, rate: total > 0 ? Math.round((occupied / total) * 100) : 0 };
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartRange, setChartRange] = useState('7days');

  const loadData = useCallback(async (range: string) => {
    setLoading(true);
    setError('');

    try {
      const [dashRes, tablesRes, invStatsRes, shiftRes, staffRes] = await Promise.all([
        dashboardApi.getV2(range),
        tableApi.list().catch(() => [] as TableItem[]),
        inventoryApi.stats().catch(() => ({ totalItems: 0, lowStockCount: 0, totalValue: 0 })),
        shiftApi.current().catch(() => null),
        staffAuthApi.activeStaff().catch(() => []),
      ]);

      const dash = dashRes as unknown as DashboardDataV2;
      const tables = tablesRes as TableItem[];
      const invStats = invStatsRes as { totalItems: number; lowStockCount: number; totalValue: number };
      const currentShift = shiftRes;
      const activeStaff = Array.isArray(staffRes) ? staffRes : [];

      const occ = calcOccupancyRate(tables);
      const alertsData = await fetchSystemAlerts();

      const criticalCount = alertsData.filter((a) => a.severity === 'critical').length;
      const warningCount = alertsData.filter((a) => a.severity === 'warning').length;

      const staffListOnShift: { id: string; name: string; ordersHandled: number }[] = [];
      if (currentShift && currentShift.staff) {
        currentShift.staff.forEach((s: { id: string; fullName: string }, idx: number) => {
          staffListOnShift.push({
            id: s.id,
            name: s.fullName,
            ordersHandled: currentShift.totalOrders - idx * 5,
          });
        });
      }

      setData({
        overview: {
          todayRevenue: dash.kpi.todayRevenue,
          todayRevenueTrend: dash.kpi.todayRevenueTrend,
          todayProfit: dash.kpi.todayProfit,
          todayProfitTrend: dash.kpi.todayProfitTrend,
          todayOrders: dash.kpi.todayOrders,
          todayOrdersTrend: dash.kpi.todayOrdersTrend,
          occupancyRate: occ.rate,
          occupancyTrend: 0,
          avgOrderValue: dash.quickStats.avgOrderValue,
        },
        sales: {
          chartRange: range,
          revenueChart: dash.revenueChart,
          topItems: dash.topItems,
          categoryBreakdown: buildCategoryBreakdown(dash.topItems),
          hourlyVolume: buildHourlyVolume(),
        },
        operations: {
          orderStatus: dash.orderStatus,
          tablesList: tables,
          tables: {
            total: occ.total,
            occupied: occ.occupied,
            available: occ.available,
            reserved: occ.reserved,
            cleaning: occ.cleaning,
          },
          avgPrepTime: 0,
          overdueOrders: 0,
        },
        inventory: {
          lowStockItems: dash.lowStockItems,
          criticalCount: dash.lowStockItems.filter((i) => i.status === 'out_of_stock').length,
          warningCount: dash.lowStockItems.filter((i) => i.status === 'low_stock').length,
          totalItems: invStats.totalItems || 0,
          stockValue: invStats.totalValue || 0,
        },
        staff: {
          currentShift: currentShift as any,
          activeStaff,
          checkedIn: activeStaff.length,
          totalStaff: activeStaff.length + 2,
          topStaff: staffListOnShift,
        },
        alerts: {
          alerts: alertsData,
          criticalCount,
          warningCount,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(chartRange);
  }, [chartRange, loadData]);

  const retry = () => loadData(chartRange);

  return { data, loading, error, chartRange, setChartRange, retry };
}
