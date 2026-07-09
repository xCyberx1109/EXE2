import { useState, useMemo } from 'react';
import { useDashboardDataV2 } from '../../../app/api/hooks';
import type { DashboardModuleData } from '../types';

export function useDashboardData() {
  const [chartRange, setChartRange] = useState('7days');
  const { data: dash, isLoading, error: queryError, refetch } = useDashboardDataV2(chartRange);

  const mappedData = useMemo((): DashboardModuleData | null => {
    if (!dash) return null;
    return {
      overview: {
        todayRevenue: dash.kpi.todayRevenue ?? 0,
        todayRevenueTrend: dash.kpi.todayRevenueTrend ?? 0,
        todayCost: dash.kpi.todayCost ?? 0,
        todayCostTrend: dash.kpi.todayCostTrend ?? 0,
        todayProfit: dash.kpi.todayProfit ?? 0,
        todayProfitTrend: dash.kpi.todayProfitTrend ?? 0,
        todayOrders: dash.kpi.todayOrders ?? 0,
        todayOrdersTrend: dash.kpi.todayOrdersTrend ?? 0,
        todayAvgOrderValue: dash.kpi.todayAvgOrderValue ?? 0,
        todayAvgOrderValueTrend: dash.kpi.todayAvgOrderValueTrend ?? 0,
      },
      sales: {
        chartRange,
        chartType: dash.chartType ?? 'daily',
        revenueChart: dash.revenueChart ?? [],
        topItems: dash.topItems ?? [],
      },
      alerts: {
        lowStockItems: dash.lowStockItems ?? [],
        orderStatus: dash.orderStatus ?? {},
      },
    };
  }, [dash, chartRange]);

  const fallback: DashboardModuleData = {
    overview: {
      todayRevenue: 0, todayRevenueTrend: 0,
      todayCost: 0, todayCostTrend: 0,
      todayProfit: 0, todayProfitTrend: 0,
      todayOrders: 0, todayOrdersTrend: 0,
      todayAvgOrderValue: 0, todayAvgOrderValueTrend: 0,
    },
    sales: { chartRange, chartType: 'daily', revenueChart: [], topItems: [] },
    alerts: { lowStockItems: [], orderStatus: {} },
  };

  return {
    data: mappedData || fallback,
    loading: isLoading,
    error: queryError ? 'Không thể tải dữ liệu dashboard.' : '',
    chartRange,
    setChartRange,
    retry: () => refetch(),
  };
}
