import { KpiCard, SkeletonCard } from './shared';
import type { BusinessOverviewData } from '../types';

const formatVND = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₫`;
  return `${n} ₫`;
};

const formatNumber = (n: number) => n.toLocaleString('vi-VN');

export function BusinessOverview({ data, loading }: { data: BusinessOverviewData | null; loading?: boolean }) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { title: 'Doanh thu hôm nay', value: formatVND(data.todayRevenue), trend: data.todayRevenueTrend },
    { title: 'Lợi nhuận hôm nay', value: formatVND(data.todayProfit), trend: data.todayProfitTrend },
    { title: 'Đơn hàng hôm nay', value: formatNumber(data.todayOrders), trend: data.todayOrdersTrend },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card) => (
        <KpiCard key={card.title} {...card} />
      ))}
    </div>
  );
}
