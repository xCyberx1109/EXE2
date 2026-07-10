import type { RevenueChartPoint, DashboardTopItem, DashboardLowStockItem } from '../../app/types';

export interface BusinessOverviewData {
  todayRevenue: number;
  todayRevenueTrend: number;
  todayCost: number;
  todayCostTrend: number;
  todayProfit: number;
  todayProfitTrend: number;
  todayOrders: number;
  todayOrdersTrend: number;
  todayAvgOrderValue: number;
  todayAvgOrderValueTrend: number;
}

export interface SalesPerformanceData {
  chartRange: string;
  chartType: 'hourly' | 'daily';
  revenueChart: RevenueChartPoint[];
  topItems: DashboardTopItem[];
  startDate?: string;
  endDate?: string;
}

export interface DashboardModuleData {
  overview: BusinessOverviewData;
  sales: SalesPerformanceData;
  alerts: {
    lowStockItems: DashboardLowStockItem[];
    orderStatus: Record<string, number>;
  };
}
