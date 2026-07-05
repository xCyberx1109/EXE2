import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  useDashboardData,
  BusinessOverview,
  SalesPerformance,
  InventoryTransactionLog,
} from '../../modules/dashboard';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router';

export function Dashboard() {
  const { data, loading, error, chartRange, setChartRange, retry } = useDashboardData();
  const { hasPermission, isReady } = useAuth();
  const canViewTransactions = isReady && hasPermission('INVENTORY_TRANSACTION_VIEW');

  if (!data && loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Tổng quan</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Tổng quan hoạt động kinh doanh</p>
          </div>
        <Link
          to="/qr-table-print"
          className="px-3 py-2 rounded-md bg-black text-white text-sm font-medium">
          In QR bàn
        </Link>          
        </div>
        <BusinessOverview data={null} loading />
        <SalesPerformance data={null} loading chartRange={chartRange} onChartRangeChange={setChartRange} />
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Tổng quan</h1>
        </div>
      </div>

      <BusinessOverview data={data.overview} loading={loading} />

      <SalesPerformance
        data={data.sales}
        loading={loading}
        chartRange={chartRange}
        onChartRangeChange={setChartRange}
      />

      {canViewTransactions && <InventoryTransactionLog />}
    </div>
  );
}
