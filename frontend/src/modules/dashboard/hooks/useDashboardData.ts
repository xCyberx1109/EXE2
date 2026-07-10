import { useState, useMemo, useCallback } from 'react';
import { useDashboardDataV2 } from '../../../app/api/hooks';
import type { DashboardModuleData } from '../types';
import { toDateInputValue, getPresetDates, buildContinuousTimeline } from '../utils';

export interface DateRangeState {
  preset: string;
  startDate?: string;
  endDate?: string;
}

export function useDashboardData() {
  const [dateRange, setDateRange] = useState<DateRangeState>({ preset: '7days' });

  const setChartRange = useCallback((preset: string) => {
    setDateRange({ preset });
  }, []);

  const setCustomDateRange = useCallback((from: Date, to: Date) => {
    setDateRange({
      preset: 'custom',
      startDate: toDateInputValue(from),
      endDate: toDateInputValue(to),
    });
  }, []);

  const chartRange = dateRange.preset;
  const { data: dash, isLoading, error: queryError, refetch } = useDashboardDataV2(
    dateRange.preset === 'custom' ? undefined : dateRange.preset,
    dateRange.startDate,
    dateRange.endDate,
  );

  const mappedData = useMemo((): DashboardModuleData | null => {
    if (!dash) return null;

    const presetDates = dateRange.preset !== 'custom' ? getPresetDates(dateRange.preset) : null;
    const effectiveStartDate = dateRange.startDate ?? (presetDates ? toDateInputValue(presetDates.from) : undefined);
    const effectiveEndDate = dateRange.endDate ?? (presetDates ? toDateInputValue(presetDates.to) : undefined);
    const chartType = dash.chartType ?? 'daily';
    const shouldFillGaps = chartType === 'daily';
    const revenueChart = shouldFillGaps && effectiveStartDate && effectiveEndDate
      ? buildContinuousTimeline(dash.revenueChart ?? [], effectiveStartDate, effectiveEndDate)
      : dash.revenueChart ?? [];

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
        chartType,
        revenueChart,
        topItems: dash.topItems ?? [],
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      alerts: {
        lowStockItems: dash.lowStockItems ?? [],
        orderStatus: dash.orderStatus ?? {},
      },
    };
  }, [dash, chartRange, dateRange.preset, dateRange.startDate, dateRange.endDate]);

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
    dateRange,
    setCustomDateRange,
    retry: () => refetch(),
  };
}
