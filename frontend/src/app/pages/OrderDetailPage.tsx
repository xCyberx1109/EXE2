import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ordersApi } from '../api/services';
import type { OrderDetailSimple } from '../types';
import {
  ArrowLeft,
  Printer,
  FileText,
  Loader2,
  Clock,
  Hash,
} from 'lucide-react';
import { format } from 'date-fns';

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString()}₫`;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PREPARING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SERVED: 'bg-teal-50 text-teal-700 border-teal-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<OrderDetailSimple | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    ordersApi
      .getDetail(orderId)
      .then((data) => setOrder(data))
      .catch((e: any) => setError(e.message || 'Không thể tải chi tiết đơn hàng'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!order) return null;

  const hasDiscount = order.discount > 0;
  const hasTax = order.tax > 0;
  const hasServiceCharge = order.serviceCharge > 0;
  const items = order.items;
  const orderDate = order.createdAt
    ? format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss')
    : '';

  return (
    <div className="space-y-6">
      {/* --- Toolbar --- */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            Print Bill
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* --- Main Card --- */}
      <div
        ref={printRef}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        {/* ===== Header ===== */}
        <div className="border-b border-gray-100 px-6 py-5 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-gray-400" />
              <span className="text-lg font-bold text-gray-900">
                {order.orderNumber}
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${
                STATUS_STYLES[order.status] || 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {order.status}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 sm:mt-0">
            <Clock className="h-4 w-4" />
            <span>{orderDate}</span>
          </div>
        </div>

        {/* ===== Table ===== */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tên món
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Số lượng
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Đơn giá
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Thành tiền
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-gray-400"
                  >
                    Không có món nào trong đơn hàng
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="transition-colors hover:bg-blue-50/40"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-gray-700">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-600">
                      {formatMoney(item.price)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      {formatMoney(item.subtotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ===== Footer / Totals ===== */}
        <div className="border-t border-gray-100 px-6 py-5">
          <div className="ml-auto space-y-2 sm:w-72">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Tạm tính</span>
              <span>{formatMoney(order.subtotal)}</span>
            </div>

            {hasServiceCharge && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Phí dịch vụ</span>
                <span>{formatMoney(order.serviceCharge)}</span>
              </div>
            )}

            {hasTax && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Thuế</span>
                <span>{formatMoney(order.tax)}</span>
              </div>
            )}

            {hasDiscount && (
              <div className="flex items-center justify-between text-sm text-red-600">
                <span>Giảm giá</span>
                <span>-{formatMoney(order.discount)}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3" />

            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-gray-900">
                Tổng cộng
              </span>
              <span className="text-xl font-bold text-blue-600">
                {formatMoney(order.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles (hidden on screen) */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
