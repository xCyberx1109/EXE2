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
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <SectionHeader title="Món bán chạy" actionLabel="Xem tất cả" actionHref="/app/menu" />
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.menuItemId} className="flex items-center gap-4 py-2.5 border-b border-gray-100 last:border-0">
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                idx === 1 ? 'bg-gray-100 text-gray-600' :
                idx === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-gray-50 text-gray-500'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.category}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatVND(item.revenue)}</p>
                <p className="text-xs text-gray-500">{formatNumber(item.soldQuantity)} đã bán</p>
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
