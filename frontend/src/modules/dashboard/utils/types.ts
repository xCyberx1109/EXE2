import type { RevenueChartPoint, DashboardTopItem } from '../../../app/types';

export interface ExportReportData {
  storeName: string;
  reportPeriod: string;
  generatedTime: string;
  kpi: {
    revenue: number;
    cost: number;
    profit: number;
    orders: number;
    avgOrderValue: number;
  };
  revenueChart: RevenueChartPoint[];
  topItems: DashboardTopItem[];
}
