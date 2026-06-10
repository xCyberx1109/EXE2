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
        todayProfit: dash.kpi.todayProfit ?? 0,
        todayProfitTrend: dash.kpi.todayProfitTrend ?? 0,
        todayOrders: dash.kpi.todayOrders ?? 0,
        todayOrdersTrend: dash.kpi.todayOrdersTrend ?? 0,
      },
      sales: {
        chartRange,
        revenueChart: dash.revenueChart ?? [],
        topItems: dash.topItems ?? [],
      },
    };
  }, [dash, chartRange]);

  const fallback: DashboardModuleData = {
    overview: {
      todayRevenue: 0, todayRevenueTrend: 0,
      todayProfit: 0, todayProfitTrend: 0,
      todayOrders: 0, todayOrdersTrend: 0,
    },
    sales: { chartRange, revenueChart: [], topItems: [] },
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
