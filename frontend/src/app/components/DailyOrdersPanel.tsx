import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Loader2, Receipt } from 'lucide-react';
import { useDailyOrders } from '../api/hooks';
import type { OrderDetail } from '../types';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Chờ xử lý', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' },
  PREPARING: { label: 'Đang làm', className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' },
  COMPLETED: { label: 'Hoàn tất', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-300' },
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  QR: 'QR',
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

interface DailyOrdersPanelProps {
  initialDate?: string;
}

export function DailyOrdersPanel({ initialDate }: DailyOrdersPanelProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate || todayStr());
  const [statusFilter, setStatusFilter] = useState('all');
  const { data, isLoading } = useDailyOrders(selectedDate, statusFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const renderStatus = (status: string) => {
    const cfg = STATUS_LABELS[status] || { label: status, className: 'bg-muted text-foreground' };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Đơn hàng trong ngày</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-input bg-input-background rounded-lg text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-input bg-input-background rounded-lg text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="PREPARING">Đang làm</option>
            <option value="COMPLETED">Hoàn tất</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      {data && (
        <div className="px-6 py-3 bg-muted border-b border-border grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Tổng đơn</span>
            <p className="font-bold text-foreground">{data.summary.totalOrders}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Doanh thu</span>
            <p className="font-bold text-green-600 dark:text-green-400">{data.summary.totalRevenue.toLocaleString()} ₫</p>
          </div>
          <div>
            <span className="text-muted-foreground">Lợi nhuận</span>
            <p className="font-bold text-blue-600 dark:text-blue-400">{data.summary.totalProfit.toLocaleString()} ₫</p>
          </div>
          <div>
            <span className="text-muted-foreground">Hoàn tất</span>
            <p className="font-bold text-foreground">{data.summary.completedCount}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Đang chờ</span>
            <p className="font-bold text-orange-600 dark:text-orange-400">{data.summary.pendingCount}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Đang tải đơn hàng...
        </div>
      ) : !data || data.orders.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">Không có đơn hàng trong ngày này</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Mã đơn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Giờ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Bàn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Món</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Thanh toán</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Tổng tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  expanded={expandedId === order.id}
                  onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  formatTime={formatTime}
                  renderStatus={renderStatus}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  expanded,
  onToggle,
  formatTime,
  renderStatus,
}: {
  order: OrderDetail;
  expanded: boolean;
  onToggle: () => void;
  formatTime: (iso: string) => string;
  renderStatus: (status: string) => ReactNode;
}) {
  return (
    <>
      <tr className="hover:bg-accent cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-foreground">{order.orderNumber}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{formatTime(order.createdAt)}</td>
        <td className="px-4 py-3 text-sm text-foreground">{order.tableNumber ? `Bàn ${order.tableNumber}` : '—'}</td>
        <td className="px-4 py-3 text-sm text-foreground">{order.itemCount} món</td>
        <td className="px-4 py-3">{renderStatus(order.status)}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod : '—'}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-right text-foreground">
          {order.total.toLocaleString()} ₫
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/50">
          <td colSpan={8} className="px-6 py-4">
            <div className="text-sm space-y-2">
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <span>Tạm tính: {order.subtotal.toLocaleString()} ₫</span>

                <span>Giá vốn: {order.cost.toLocaleString()} ₫</span>
                <span className="text-blue-600 dark:text-blue-400">LN: {order.profit.toLocaleString()} ₫</span>
              </div>
              <table className="w-full mt-2">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-1">Món</th>
                    <th className="pb-1">SL</th>
                    <th className="pb-1">Đơn giá</th>
                    <th className="pb-1 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="py-1.5 text-foreground">{item.name}</td>
                      <td className="py-1.5 text-foreground">{item.quantity}</td>
                      <td className="py-1.5 text-muted-foreground">{item.price.toLocaleString()} ₫</td>
                      <td className="py-1.5 text-right font-medium text-foreground">{item.lineTotal.toLocaleString()} ₫</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
