import { SectionHeader } from './shared';
import { SalesChart } from './SalesChart';
import { TopSellingItems } from './TopSellingItems';
import type { SalesPerformanceData } from '../types';

export function SalesPerformance({
  data, loading,
}: {
  data: SalesPerformanceData | null; loading?: boolean;
}) {
  if (loading && !data) {
    return <div className="h-64 bg-muted rounded animate-pulse" />;
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5">
      <div className="md:col-span-3 lg:col-span-4 p-3">
        <SectionHeader title="Phân tích doanh thu" />
        <SalesChart data={data.revenueChart} chartRange={data.chartRange} chartType={data.chartType} />
      </div>
      <div className="border-t border-border md:border-t-0 md:border-l p-3">
        <TopSellingItems items={data.topItems} />
      </div>
    </div>
  );
}
