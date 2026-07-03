import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  useDashboardData,
  BusinessOverview,
  SalesPerformance,
} from '../../modules/dashboard';

export function Dashboard() {
  const { data, loading, error, chartRange, setChartRange, retry } = useDashboardData();

  if (!data && loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Tổng quan</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Tổng quan hoạt động kinh doanh</p>
          </div>
        </div>
        <BusinessOverview data={null} loading />
        <SalesPerformance data={null} loading chartRange={chartRange} onChartRangeChange={setChartRange} />
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
    </div>
  );
}
