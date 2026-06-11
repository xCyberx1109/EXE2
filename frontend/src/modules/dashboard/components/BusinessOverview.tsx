import { DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { title: 'Doanh thu hôm nay', value: formatVND(data.todayRevenue), trend: data.todayRevenueTrend, icon: DollarSign, color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' },
    { title: 'Lợi nhuận hôm nay', value: formatVND(data.todayProfit), trend: data.todayProfitTrend, icon: TrendingUp, color: 'bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400' },
    { title: 'Đơn hàng hôm nay', value: formatNumber(data.todayOrders), trend: data.todayOrdersTrend, icon: ShoppingCart, color: 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <KpiCard key={card.title} {...card} />
      ))}
    </div>
  );
}
