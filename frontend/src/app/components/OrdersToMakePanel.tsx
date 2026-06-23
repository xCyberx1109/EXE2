import { useState, useRef } from 'react';
import { useOrderQueue } from '../api/hooks';
import { OrderDetail } from '../types';
import { OrderProductionModal } from './OrderProductionModal';
import { Clock, Coffee, Loader2, RefreshCw } from 'lucide-react';

function formatTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function getShortOrderNumber(order: OrderDetail): string {
  const num = order.orderNumber || '';
  const digits = num.replace(/\D/g, '');
  if (digits) return `#${digits.slice(-4)}`;
  return `#${num.slice(-4)}`;
}

export function OrdersToMakePanel({ refreshKey }: { refreshKey: number }) {
  const { data: orders = [], isLoading, refetch } = useOrderQueue(
    { paymentStatus: 'PAID' },
    { refetchInterval: 5000 }
  );
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  // Re-fetch when parent signals a data change (e.g. new order created)
  const prevKey = useRef(refreshKey);
  if (prevKey.current !== refreshKey) {
    prevKey.current = refreshKey;
    queueMicrotask(() => refetch());
  }

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const bodyContent = isLoading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  ) : sortedOrders.length === 0 ? (
    <div className="rounded-3xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
      Không có đơn cần làm
    </div>
  ) : (
    sortedOrders.map(order => (
      <article
        key={order.id}
        onClick={() => setSelectedOrder(order)}
        className="cursor-pointer rounded-2xl lg:rounded-3xl border border-border bg-card p-3 lg:p-4 transition hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="text-sm lg:text-lg font-black text-amber-700 dark:text-amber-400" title={`#${order.orderNumber}`}>
            {getShortOrderNumber(order)}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0" />
            {formatTime(order.createdAt)}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {order.items.slice(0, 3).map(item => (
            <span
              key={item.id}
              className="rounded-lg bg-muted px-2 py-0.5 text-[10px] lg:text-xs font-semibold text-muted-foreground truncate max-w-[120px]"
            >
              {item.name} x{item.quantity}
            </span>
          ))}
          {order.items.length > 3 && (
            <span className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              +{order.items.length - 3}
            </span>
          )}
        </div>
      </article>
    ))
  );

  return (
    <section className="flex flex-col h-full min-w-0 rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="shrink-0 border-b border-border p-3 lg:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base lg:text-lg font-black text-foreground">
              <Coffee className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">Đơn cần làm</span>
            </h2>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {isLoading ? 'Đang tải...' : `${sortedOrders.length} đơn`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent transition shrink-0"
            title="Làm mới"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2 lg:space-y-3">
        {bodyContent}
      </div>

      {selectedOrder && (
        <OrderProductionModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </section>
  );
}