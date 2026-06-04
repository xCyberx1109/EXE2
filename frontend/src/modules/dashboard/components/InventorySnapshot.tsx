import { Link } from 'react-router';
import { Package, AlertTriangle, CircleDollarSign } from 'lucide-react';
import { SectionHeader, EmptyState, QuickStatCard } from './shared';
import type { DashboardLowStockItem } from '../../app/types';

export function InventorySnapshot({ lowStockItems, totalItems, stockValue, loading }: {
  lowStockItems: DashboardLowStockItem[];
  totalItems: number;
  stockValue: number;
  loading?: boolean;
}) {
  const critical = lowStockItems.filter((i) => i.status === 'out_of_stock');
  const warning = lowStockItems.filter((i) => i.status === 'low_stock');

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-40 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-32 mb-6" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasAlerts = critical.length > 0 || warning.length > 0;

  const formatVND = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`;
    return `${n.toLocaleString('vi-VN')} ₫`;
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Tồn kho" actionLabel="Quản lý kho" actionHref="/app/inventory" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader
            title={`Cảnh báo (${critical.length + warning.length})`}
            actionLabel="Xem tất cả"
            actionHref="/app/inventory"
          />
          {hasAlerts ? (
            <div className="space-y-2">
              {critical.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        Tồn: {item.quantity} / Tối thiểu: {item.warningQuantity} {item.unit}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">Hết hàng</span>
                </div>
              ))}
              {warning.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        Tồn: {item.quantity} / Tối thiểu: {item.warningQuantity} {item.unit}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-700">Sắp hết</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Tất cả hàng hóa đều đủ số lượng" icon={Package} />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-5">Tổng quan kho</h3>
          <div className="grid grid-cols-2 gap-4">
            <QuickStatCard
              icon={Package}
              label="Tổng mặt hàng"
              value={String(totalItems)}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <QuickStatCard
              icon={AlertTriangle}
              label="Cảnh báo"
              value={String(critical.length + warning.length)}
              color={hasAlerts ? 'text-red-600' : 'text-gray-600'}
              bg={hasAlerts ? 'bg-red-50' : 'bg-gray-50'}
            />
            <QuickStatCard
              icon={CircleDollarSign}
              label="Giá trị tồn kho"
              value={formatVND(stockValue)}
              color="text-green-600"
              bg="bg-green-50"
            />
            <QuickStatCard
              icon={AlertTriangle}
              label="Hết hàng"
              value={String(critical.length)}
              color={critical.length > 0 ? 'text-red-600' : 'text-gray-600'}
              bg={critical.length > 0 ? 'bg-red-50' : 'bg-gray-50'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
