import { UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router';
import { SectionHeader, EmptyState } from './shared';
import type { DashboardTopItem } from '../../app/types';

const formatVND = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₫`;
  return `${n} ₫`;
};

const formatNumber = (n: number) => n.toLocaleString('vi-VN');

export function TopSellingItems({ items }: { items: DashboardTopItem[] }) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <SectionHeader title="Món bán chạy" actionLabel="Xem tất cả" actionHref="/app/menu" />
      {safeItems.length > 0 ? (
        <div className="space-y-3">
          {safeItems.map((item, idx) => (
            <div key={item.menuItemId} className="flex items-center gap-4 py-2.5 border-b border-border last:border-0">
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                idx === 1 ? 'bg-muted text-muted-foreground' :
                idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                'bg-muted/50 text-muted-foreground'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground">{formatVND(item.revenue)}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(item.soldQuantity)} đã bán</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="Chưa có dữ liệu bán hàng" icon={UtensilsCrossed} />
      )}
    </div>
  );
}
