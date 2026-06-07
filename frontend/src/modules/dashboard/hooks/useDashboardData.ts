import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../../../app/api/services';
import type { DashboardDataV2 } from '../../../app/types';
import type { DashboardModuleData } from '../types';

export function useDashboardData() {
  const [data, setData] = useState<DashboardModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartRange, setChartRange] = useState('7days');

  const loadData = useCallback(async (range: string) => {
    setLoading(true);
    setError('');

    try {
      const dash = await dashboardApi.getV2(range) as DashboardDataV2 | null;

      if (!dash) {
        setData({
          overview: {
            todayRevenue: 0, todayRevenueTrend: 0,
            todayProfit: 0, todayProfitTrend: 0,
            todayOrders: 0, todayOrdersTrend: 0,
          },
          sales: {
            chartRange: range,
            revenueChart: [],
            topItems: [],
          },
        });
        setLoading(false);
        return;
      }

      setData({
        overview: {
          todayRevenue: dash.kpi.todayRevenue ?? 0,
          todayRevenueTrend: dash.kpi.todayRevenueTrend ?? 0,
          todayProfit: dash.kpi.todayProfit ?? 0,
          todayProfitTrend: dash.kpi.todayProfitTrend ?? 0,
          todayOrders: dash.kpi.todayOrders ?? 0,
          todayOrdersTrend: dash.kpi.todayOrdersTrend ?? 0,
        },
        sales: {
          chartRange: range,
          revenueChart: dash.revenueChart ?? [],
          topItems: dash.topItems ?? [],
        },
      });
    } catch {
      setError('Không thể tải dữ liệu dashboard.');
      setData({
        overview: {
          todayRevenue: 0, todayRevenueTrend: 0,
          todayProfit: 0, todayProfitTrend: 0,
          todayOrders: 0, todayOrdersTrend: 0,
        },
        sales: {
          chartRange: range,
          revenueChart: [],
          topItems: [],
        },
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(chartRange);
  }, [chartRange, loadData]);

  const retry = () => loadData(chartRange);

  return { data, loading, error, chartRange, setChartRange, retry };
}
