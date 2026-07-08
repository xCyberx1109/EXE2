import { UtensilsCrossed } from 'lucide-react';
import { Progress } from '../../../app/components/ui/progress';
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
  const maxSold = Math.max(...safeItems.map((i) => i.soldQuantity), 1);

  return (
    <div className="bg-card rounded-md border border-border p-3">
      <SectionHeader title="Món bán chạy" actionLabel="Xem tất cả" actionHref="/app/menu" />
      {safeItems.length > 0 ? (
        <div className="space-y-3">
          {safeItems.map((item, idx) => (
            <div key={item.menuItemId} className="flex flex-col gap-1 border-b border-border last:border-0 pb-2 last:pb-0">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold shrink-0 ${
                  idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                  idx === 1 ? 'bg-muted text-muted-foreground' :
                  idx === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                  'bg-muted/50 text-muted-foreground'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{formatVND(item.revenue)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatNumber(item.soldQuantity)} đã bán</p>
                </div>
              </div>
              <Progress value={(item.soldQuantity / maxSold) * 100} className="h-1 bg-muted [&>[data-slot=progress-indicator]]:bg-primary/40" />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="Chưa có dữ liệu bán hàng" icon={UtensilsCrossed} />
      )}
    </div>
  );
}
