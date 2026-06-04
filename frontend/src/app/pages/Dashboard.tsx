import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useDashboardData,
  BusinessOverview,
  SalesPerformance,
  OperationsPanel,
  InventorySnapshot,
  StaffPerformance,
  SystemAlerts,
} from '../../modules/dashboard';

export function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, chartRange, setChartRange, retry } = useDashboardData();

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-red-600">
        <AlertTriangle className="w-10 h-10 mb-3" />
        <p className="font-medium">{error}</p>
        <button
          onClick={retry}
          className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Thử lại
        </button>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
            <p className="text-gray-500 text-sm mt-1">Tổng quan hoạt động kinh doanh</p>
          </div>
        </div>
        <BusinessOverview data={null} loading />
        <SalesPerformance data={null} loading chartRange={chartRange} onChartRangeChange={setChartRange} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
          <p className="text-gray-500 text-sm mt-1">Tổng quan hoạt động kinh doanh</p>
        </div>
        {user?.branchId && (
          <div className="text-sm text-gray-400">
            Chi nhánh: <span className="font-medium text-gray-600">{user.fullName}</span>
          </div>
        )}
      </div>

      <BusinessOverview data={data.overview} loading={loading} />

      <SalesPerformance
        data={data.sales}
        loading={loading}
        chartRange={chartRange}
        onChartRangeChange={setChartRange}
      />

      <OperationsPanel data={data.operations} loading={loading} />

      <InventorySnapshot
        lowStockItems={data.inventory.lowStockItems}
        totalItems={data.inventory.totalItems}
        stockValue={data.inventory.stockValue}
        loading={loading}
      />

      <StaffPerformance
        currentShift={data.staff.currentShift}
        activeStaff={data.staff.activeStaff}
        checkedIn={data.staff.checkedIn}
        totalStaff={data.staff.totalStaff}
        topStaff={data.staff.topStaff}
        loading={loading}
      />

      <SystemAlerts
        alerts={data.alerts.alerts}
        criticalCount={data.alerts.criticalCount}
        warningCount={data.alerts.warningCount}
        loading={loading}
      />
    </div>
  );
}
