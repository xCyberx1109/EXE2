import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Loader2, Receipt } from 'lucide-react';
import { ordersApi } from '../api/services';
import type { DailyOrdersResponse, OrderDetail } from '../types';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Chờ xử lý', className: 'bg-yellow-100 text-yellow-800' },
  PREPARING: { label: 'Đang làm', className: 'bg-orange-100 text-orange-800' },
  COMPLETED: { label: 'Hoàn tất', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-gray-100 text-gray-800' },
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
  const [data, setData] = useState<DailyOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await ordersApi.listByDate(selectedDate, statusFilter);
        setData(result);
      } catch (err) {
        console.error(err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedDate, statusFilter]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const renderStatus = (status: string) => {
    const cfg = STATUS_LABELS[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Đơn hàng trong ngày</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Tổng đơn</span>
            <p className="font-bold text-gray-900">{data.summary.totalOrders}</p>
          </div>
          <div>
            <span className="text-gray-500">Doanh thu</span>
            <p className="font-bold text-green-600">{data.summary.totalRevenue.toLocaleString()} ₫</p>
          </div>
          <div>
            <span className="text-gray-500">Lợi nhuận</span>
            <p className="font-bold text-blue-600">{data.summary.totalProfit.toLocaleString()} ₫</p>
          </div>
          <div>
            <span className="text-gray-500">Hoàn tất</span>
            <p className="font-bold">{data.summary.completedCount}</p>
          </div>
          <div>
            <span className="text-gray-500">Đang chờ</span>
            <p className="font-bold text-orange-600">{data.summary.pendingCount}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Đang tải đơn hàng...
        </div>
      ) : !data || data.orders.length === 0 ? (
        <p className="text-center py-12 text-gray-500">Không có đơn hàng trong ngày này</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã đơn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giờ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bàn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Món</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thanh toán</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tổng tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
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
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderNumber}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{formatTime(order.createdAt)}</td>
        <td className="px-4 py-3 text-sm">{order.tableNumber ? `Bàn ${order.tableNumber}` : '—'}</td>
        <td className="px-4 py-3 text-sm">{order.itemCount} món</td>
        <td className="px-4 py-3">{renderStatus(order.status)}</td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod : '—'}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
          {order.total.toLocaleString()} ₫
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-6 py-4">
            <div className="text-sm space-y-2">
              <div className="flex flex-wrap gap-4 text-gray-600">
                <span>Tạm tính: {order.subtotal.toLocaleString()} ₫</span>
                <span>VAT: {order.tax.toLocaleString()} ₫</span>
                <span>Giá vốn: {order.cost.toLocaleString()} ₫</span>
                <span className="text-blue-600">LN: {order.profit.toLocaleString()} ₫</span>
              </div>
              <table className="w-full mt-2">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-1">Món</th>
                    <th className="pb-1">SL</th>
                    <th className="pb-1">Đơn giá</th>
                    <th className="pb-1 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="py-1.5">{item.name}</td>
                      <td className="py-1.5">{item.quantity}</td>
                      <td className="py-1.5">{item.price.toLocaleString()} ₫</td>
                      <td className="py-1.5 text-right font-medium">{item.lineTotal.toLocaleString()} ₫</td>
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
