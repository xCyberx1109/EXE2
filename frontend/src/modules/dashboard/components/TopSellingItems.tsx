import { UtensilsCrossed } from 'lucide-react';
import { Progress } from '../../../app/components/ui/progress';
import { SectionHeader, EmptyState } from './shared';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../app/components/ui/tooltip';
import type { DashboardTopItem } from '../../app/types';

const formatVND = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₫`;
  return `${n} ₫`;
};

const formatNumber = (n: number) => n.toLocaleString('vi-VN');

export function TopSellingItems({ items }: { items: DashboardTopItem[] }) {
  const safeItems = Array.isArray(items) ? items : [];
  const maxRevenue = Math.max(...safeItems.map((i) => i.revenue), 1);

  return (
    <div>
      <SectionHeader title="Món bán chạy" actionLabel="Xem tất cả" actionHref="/app/menu" />
      {safeItems.length > 0 ? (
        <div className="space-y-3">
          {safeItems.map((item, idx) => (
            <Tooltip key={item.menuItemId}>
              <TooltipTrigger asChild>
                <div className="flex flex-col gap-1 border-b border-border last:border-0 pb-2 last:pb-0 cursor-pointer">
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
                  <Progress value={(item.revenue / maxRevenue) * 100} className="h-1 bg-muted [&>[data-slot=progress-indicator]]:bg-blue-500/40" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8} className="bg-gray-900 dark:bg-gray-800 text-white border border-gray-700 rounded-lg shadow-xl p-3 min-w-[200px] z-[100]">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">{item.name}</p>
                  <div className="h-px bg-gray-700" />
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] gap-4">
                      <span className="text-gray-400">Đã bán:</span>
                      <span className="text-white font-medium">{formatNumber(item.soldQuantity)} ly</span>
                    </div>
                    <div className="flex justify-between text-[11px] gap-4">
                      <span className="text-gray-400">Doanh thu:</span>
                      <span className="text-blue-400 font-medium">{formatVND(item.revenue)}</span>
                    </div>
                    {item.cost !== undefined && item.cost > 0 && (
                      <div className="flex justify-between text-[11px] gap-4">
                        <span className="text-gray-400">Vốn:</span>
                        <span className="text-amber-400 font-medium">{formatVND(item.cost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[11px] gap-4">
                      <span className="text-gray-400">Lợi nhuận:</span>
                      <span className="text-green-400 font-medium">{formatVND(item.profit ?? 0)}</span>
                    </div>
                    {item.cost !== undefined && item.cost > 0 && (
                      <div className="flex justify-between text-[11px] gap-4">
                        <span className="text-gray-400">Tỷ suất lợi nhuận:</span>
                        <span className="text-green-400 font-medium">{item.profitMargin}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : (
        <EmptyState message="Chưa có dữ liệu bán hàng" icon={UtensilsCrossed} />
      )}
    </div>
  );
}
