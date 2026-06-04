import { SectionHeader, ChartRangeSelector, SkeletonCard } from './shared';
import { SalesChart } from './SalesChart';
import { TopSellingItems } from './TopSellingItems';
import { RevenueByCategory } from './RevenueByCategory';
import type { SalesPerformanceData } from '../types';

export function SalesPerformance({
  data, loading, chartRange, onChartRangeChange,
}: {
  data: SalesPerformanceData | null; loading?: boolean; chartRange: string; onChartRangeChange: (v: string) => void;
}) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-40 mb-6" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-32 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader title="Phân tích doanh thu">
            <ChartRangeSelector value={chartRange} onChange={onChartRangeChange} />
          </SectionHeader>
          <SalesChart data={data.revenueChart} chartRange={data.chartRange} />
        </div>
        <TopSellingItems items={data.topItems} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueByCategory data={data.categoryBreakdown} />
        <HourlyVolume data={data.hourlyVolume} />
      </div>
    </div>
  );
}

function HourlyVolume({ data }: { data: { hour: string; orders: number }[] }) {
  if (data.length === 0) return null;

  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Đơn hàng theo giờ (hôm nay)</h3>
      <div className="flex items-end gap-1.5 h-32">
        {data.map((d) => (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-400 font-medium">{d.orders}</span>
            <div
              className="w-full rounded-t bg-blue-500 transition-all duration-300"
              style={{ height: `${(d.orders / maxOrders) * 100}%`, minHeight: d.orders > 0 ? '4px' : '0' }}
            />
            <span className="text-[10px] text-gray-500">{d.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
