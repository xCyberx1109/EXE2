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
  PENDING: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  CONFIRMED: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  PREPARING: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  READY: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  SERVED: 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  COMPLETED: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  CANCELLED: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
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

  const isBilliard = !!(order.tableCode || order.playingCost);
  const isRestaurant = !isBilliard;
  const showSubtotal = isBilliard || hasDiscount || hasServiceCharge;
  const fmtVnd = (n?: number | null) => n != null ? `${n.toLocaleString()} ₫` : '';
  const fmtTime = (t?: string | null) => t ? format(new Date(t), 'hh:mm:ss a') : '';

  return (
    <div className="space-y-6">
      {/* --- Toolbar --- */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại đơn hàng
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" />
            In hóa đơn
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent"
          >
            <FileText className="h-4 w-4" />
            Xuất PDF
          </button>
        </div>
      </div>

      {/* --- Main Card --- */}
      <div
        ref={printRef}
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      >
        {/* ===== Header ===== */}
        <div className="border-b border-border px-6 py-5 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-bold text-foreground">
                {order.orderNumber}
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${
                STATUS_STYLES[order.status] || 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {order.status}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground sm:mt-0">
            <Clock className="h-4 w-4" />
            <span>{orderDate}</span>
          </div>
        </div>

        {/* ===== Billiard Session Snapshot ===== */}
        {isBilliard && (
          <div className="border-b border-border px-6 py-4 bg-muted/20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Phiên chơi bi-a
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Bàn: </span>
                <span className="font-medium">{order.tableName || order.tableCode}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Mã: </span>
                <span className="font-medium">{order.tableCode}</span>
                {order.tableType && (
                  <>
                    <span className="text-muted-foreground mx-1">·</span>
                    <span className="font-medium">{order.tableType}</span>
                  </>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Bắt đầu: </span>
                <span className="font-medium">{fmtTime(order.sessionStartTime)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Thời gian: </span>
                <span className="font-medium">{order.playingDurationMinutes} phút</span>
              </div>
              <div>
                <span className="text-muted-foreground">Giá giờ: </span>
                <span className="font-medium">{fmtVnd(order.hourlyRate)}<span className="text-xs text-muted-foreground">/giờ</span></span>
              </div>
              <div>
                <span className="text-muted-foreground">Tiền chơi: </span>
                <span className="font-medium">{fmtVnd(order.playingCost)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ===== Table ===== */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-muted/80">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tên món
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Số lượng
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Đơn giá
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Thành tiền
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-muted-foreground"
                  >
                    Không có món nào trong đơn hàng
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="transition-colors hover:bg-accent/40"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                      {item.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center text-sm text-foreground">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
                      {formatMoney(item.price)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-foreground">
                      {formatMoney(item.subtotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ===== Footer / Totals ===== */}
        <div className="border-t border-border px-6 py-5">
          <div className="ml-auto space-y-2 sm:w-72">
            {isBilliard ? (
              <>
                {order.playingCost != null && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Tiền chơi</span>
                    <span>{formatMoney(order.playingCost)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Đồ ăn & Thức uống</span>
                  <span>{formatMoney(order.foodDrinkTotal ?? order.subtotal)}</span>
                </div>
              </>
            ) : showSubtotal ? (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Tạm tính</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
            ) : null}

            {hasServiceCharge && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Phí dịch vụ</span>
                <span>{formatMoney(order.serviceCharge)}</span>
              </div>
            )}

            {isBilliard && hasTax && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Thuế</span>
                <span>{formatMoney(order.tax)}</span>
              </div>
            )}

            {hasDiscount && (
              <div className="flex items-center justify-between text-sm text-red-600 dark:text-red-400">
                <span>Giảm giá</span>
                <span>-{formatMoney(order.discount)}</span>
              </div>
            )}

            <div className="border-t border-border pt-3" />

            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">
                Tổng cộng
              </span>
              <span className="text-xl font-bold text-primary">
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
