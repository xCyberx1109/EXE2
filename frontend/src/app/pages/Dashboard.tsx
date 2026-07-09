import { AlertTriangle, RefreshCw, AlertCircle, Bell } from 'lucide-react';
import {
  useDashboardData,
  BusinessOverview,
  SalesPerformance,
  InventoryTransactionLog,
} from '../../modules/dashboard';
import { useAuth } from '../context/AuthContext';

function DashboardAlerts({ lowStockItems, orderStatus }: { lowStockItems: any[]; orderStatus: Record<string, number> }) {
  const alerts: { icon: any; color: string; bg: string; message: string }[] = [];

  const lowStockCount = lowStockItems?.length ?? 0;
  if (lowStockCount > 0) {
    alerts.push({
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
      message: `${lowStockCount} nguyên liệu sắp hết hàng`,
    });
  }

  const pendingOrders = (orderStatus?.PENDING ?? 0) + (orderStatus?.CONFIRMED ?? 0);
  if (pendingOrders > 0) {
    alerts.push({
      icon: Bell,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      message: `${pendingOrders} đơn hàng đang chờ xử lý`,
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-card rounded-md border border-border p-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bell className="size-3.5" />
          <p className="text-xs">Không có cảnh báo nào</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-md border border-border p-2">
      <div className="flex flex-wrap gap-2">
        {alerts.map((alert, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${alert.bg} ${alert.color}`}
          >
            <alert.icon className="size-3" />
            {alert.message}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data, loading, error, chartRange, setChartRange, retry } = useDashboardData();
  const { hasPermission, isReady } = useAuth();
  const canViewTransactions = isReady && hasPermission('INVENTORY_TRANSACTION_VIEW');

  if (!data && loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">Tổng quan</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Tổng quan hoạt động kinh doanh</p>
        </div>
        <div className="bg-card rounded-md border border-border animate-pulse">
          <div className="p-3 border-b border-border">
            <div className="h-4 bg-muted rounded w-40" />
            <div className="h-3 bg-muted rounded w-60 mt-1" />
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-muted rounded" />)}
            </div>
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
        {canViewTransactions && (
          <div className="bg-card rounded-md border border-border p-3 animate-pulse">
            <div className="h-4 bg-muted rounded w-48 mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded" />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-red-600">
        <AlertTriangle className="w-8 h-8 mb-3" />
        <p className="font-medium">{error}</p>
        <button
          onClick={retry}
          className="mt-3 px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs font-medium hover:bg-red-100 transition-colors inline-flex items-center gap-1.5"
        >
          <RefreshCw className="size-3" />
          Thử lại
        </button>
      </div>
    );
  }

  if (!data) return null;

  const rangeOptions = [
    { value: 'today', label: 'Hôm nay' },
    { value: '7days', label: '7 ngày' },
    { value: '30days', label: '30 ngày' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-foreground">Tổng quan</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Tổng quan hoạt động kinh doanh</p>
      </div>

      <div className="bg-card rounded-md border border-border">
        <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border">
          <div>
            <h2 className="text-xs font-semibold text-foreground">Báo cáo kinh doanh</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">Phân tích doanh thu và hiệu quả kinh doanh</p>
          </div>
          <div className="flex gap-0.5 bg-muted p-0.5 rounded-md">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setChartRange(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  chartRange === opt.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pt-3">
          <BusinessOverview data={data.overview} loading={loading} timeRange={chartRange} />
        </div>

        <div className="border-t border-border mt-3">
          <SalesPerformance data={data.sales} loading={loading} />
        </div>
      </div>

      <DashboardAlerts lowStockItems={data.alerts.lowStockItems} orderStatus={data.alerts.orderStatus} />

      {canViewTransactions && <InventoryTransactionLog />}
    </div>
  );
}
