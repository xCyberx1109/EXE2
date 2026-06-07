import type { RevenueChartPoint, DashboardTopItem } from '../../app/types';

export interface BusinessOverviewData {
  todayRevenue: number;
  todayRevenueTrend: number;
  todayProfit: number;
  todayProfitTrend: number;
  todayOrders: number;
  todayOrdersTrend: number;
}

export interface SalesPerformanceData {
  chartRange: string;
  revenueChart: RevenueChartPoint[];
  topItems: DashboardTopItem[];
}

export interface DashboardModuleData {
  overview: BusinessOverviewData;
  sales: SalesPerformanceData;
}
