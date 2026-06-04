import type { DashboardKpi, RevenueChartPoint, DashboardTopItem, DashboardLowStockItem, DashboardActivity, DashboardQuickStats, CurrentShift, ActiveStaff, TableItem } from '../../app/types';

export interface BusinessOverviewData {
  todayRevenue: number;
  todayRevenueTrend: number;
  todayProfit: number;
  todayProfitTrend: number;
  todayOrders: number;
  todayOrdersTrend: number;
  occupancyRate: number;
  occupancyTrend: number;
  avgOrderValue: number;
}

export interface SalesPerformanceData {
  chartRange: string;
  revenueChart: RevenueChartPoint[];
  topItems: DashboardTopItem[];
  categoryBreakdown: { name: string; revenue: number; percentage: number }[];
  hourlyVolume: { hour: string; orders: number }[];
}

export interface OperationsData {
  orderStatus: Record<string, number>;
  tablesList: TableItem[];
  tables: {
    total: number;
    occupied: number;
    available: number;
    reserved: number;
    cleaning: number;
  };
  avgPrepTime: number;
  overdueOrders: number;
}

export interface InventorySnapshotData {
  lowStockItems: DashboardLowStockItem[];
  criticalCount: number;
  warningCount: number;
  totalItems: number;
  stockValue: number;
}

export interface StaffPerformanceData {
  currentShift: CurrentShift | null;
  activeStaff: ActiveStaff[];
  checkedIn: number;
  totalStaff: number;
  topStaff: { id: string; name: string; ordersHandled: number }[];
}

export interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'resolved';
  module: string;
  message: string;
  timestamp: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface SystemAlertsData {
  alerts: SystemAlert[];
  criticalCount: number;
  warningCount: number;
}

export interface DashboardModuleData {
  overview: BusinessOverviewData;
  sales: SalesPerformanceData;
  operations: OperationsData;
  inventory: InventorySnapshotData;
  staff: StaffPerformanceData;
  alerts: SystemAlertsData;
}
