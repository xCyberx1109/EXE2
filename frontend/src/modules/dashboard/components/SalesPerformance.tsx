import { SectionHeader, ChartRangeSelector, SkeletonCard } from './shared';
import { SalesChart } from './SalesChart';
import { TopSellingItems } from './TopSellingItems';
import type { SalesPerformanceData } from '../types';

export function SalesPerformance({
  data, loading, chartRange, onChartRangeChange,
}: {
  data: SalesPerformanceData | null; loading?: boolean; chartRange: string; onChartRangeChange: (v: string) => void;
}) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-md border border-border p-3 animate-pulse">
          <div className="h-4 bg-muted rounded w-40 mb-3" />
          <div className="h-52 bg-muted rounded" />
        </div>
        <div className="bg-card rounded-md border border-border p-3 animate-pulse">
          <div className="h-4 bg-muted rounded w-32 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-card rounded-md border border-border p-3">
        <SectionHeader title="Phân tích doanh thu">
          <ChartRangeSelector value={chartRange} onChange={onChartRangeChange} />
        </SectionHeader>
        <SalesChart data={data.revenueChart} chartRange={data.chartRange} />
      </div>
      <TopSellingItems items={data.topItems} />
    </div>
  );
}
