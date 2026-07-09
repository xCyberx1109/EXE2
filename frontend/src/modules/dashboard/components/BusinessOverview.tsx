import { KpiCard, SkeletonCard } from './shared';
import type { BusinessOverviewData } from '../types';

const formatVND = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₫`;
  return `${n} ₫`;
};

const formatNumber = (n: number) => n.toLocaleString('vi-VN');

const LABELS: Record<string, { revenue: string; cost: string; profit: string; orders: string; avgOrder: string }> = {
  today: { revenue: 'Doanh thu hôm nay', cost: 'Giá vốn hôm nay', profit: 'Lợi nhuận hôm nay', orders: 'Đơn hàng hôm nay', avgOrder: 'Giá trị đơn TB hôm nay' },
  '7days': { revenue: 'Doanh thu 7 ngày', cost: 'Giá vốn 7 ngày', profit: 'Lợi nhuận 7 ngày', orders: 'Đơn hàng 7 ngày', avgOrder: 'Giá trị đơn TB 7 ngày' },
  '30days': { revenue: 'Doanh thu 30 ngày', cost: 'Giá vốn 30 ngày', profit: 'Lợi nhuận 30 ngày', orders: 'Đơn hàng 30 ngày', avgOrder: 'Giá trị đơn TB 30 ngày' },
};

export function BusinessOverview({ data, loading, timeRange = 'today' }: { data: BusinessOverviewData | null; loading?: boolean; timeRange?: string }) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const l = LABELS[timeRange] || LABELS.today;
  const cards = [
    { title: l.revenue, value: formatVND(data.todayRevenue), trend: data.todayRevenueTrend },
    { title: l.cost, value: formatVND(data.todayCost), trend: data.todayCostTrend },
    { title: l.profit, value: formatVND(data.todayProfit), trend: data.todayProfitTrend },
    { title: l.orders, value: formatNumber(data.todayOrders), trend: data.todayOrdersTrend },
    { title: l.avgOrder, value: formatVND(data.todayAvgOrderValue), trend: data.todayAvgOrderValueTrend },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {cards.map((card) => (
        <KpiCard key={card.title} {...card} />
      ))}
    </div>
  );
}
