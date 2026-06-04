import { Clock, ChefHat, CheckCircle2, XCircle, Receipt } from 'lucide-react';
import { EmptyState } from './shared';

const formatNumber = (n: number) => n.toLocaleString('vi-VN');

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; barColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: { label: 'Chờ xác nhận', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', barColor: '#ca8a04', icon: Clock },
  CONFIRMED: { label: 'Đã xác nhận', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', barColor: '#2563eb', icon: Receipt },
  PREPARING: { label: 'Đang chế biến', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', barColor: '#ea580c', icon: ChefHat },
  READY: { label: 'Đã hoàn thành', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', barColor: '#6366f1', icon: CheckCircle2 },
  SERVED: { label: 'Đã phục vụ', color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200', barColor: '#14b8a6', icon: CheckCircle2 },
  COMPLETED: { label: 'Hoàn tất', color: 'text-green-600', bg: 'bg-green-50 border-green-200', barColor: '#16a34a', icon: CheckCircle2 },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-600', bg: 'bg-red-50 border-red-200', barColor: '#dc2626', icon: XCircle },
  REFUNDED: { label: 'Hoàn tiền', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', barColor: '#9333ea', icon: XCircle },
};

export function OrderStatusFeed({ orderStatus, avgPrepTime, overdueOrders }: {
  orderStatus: Record<string, number>;
  avgPrepTime: number;
  overdueOrders: number;
}) {
  const entries = Object.entries(orderStatus).filter(([, count]) => count > 0);
  const totalOrders = entries.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Trạng thái đơn hàng</h3>
        {(avgPrepTime > 0) && (
          <span className="text-xs text-gray-500">TB chế biến: {avgPrepTime}ph</span>
        )}
      </div>
      {totalOrders > 0 ? (
        <div className="space-y-2.5">
          {entries.map(([status, count]) => {
            const config = STATUS_CONFIG[status];
            if (!config) return null;
            const Icon = config.icon;
            const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
            return (
              <div key={status} className={`rounded-lg border p-3 ${config.bg}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${config.color}`}>{formatNumber(count)}</span>
                </div>
                <div className="w-full h-1.5 bg-white bg-opacity-60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: config.barColor }}
                  />
                </div>
              </div>
            );
          })}
          {overdueOrders > 0 && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <span className="font-medium">⚠ {overdueOrders} đơn quá thời gian chế biến</span>
            </div>
          )}
        </div>
      ) : (
        <EmptyState message="Không có đơn hàng" icon={Receipt} />
      )}
    </div>
  );
}
