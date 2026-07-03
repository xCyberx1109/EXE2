import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useOrderQueue, useUpdateOrderQueueMutation } from '../api/hooks';
import { OrderDetail } from '../types';
import { OrderProductionModal } from './OrderProductionModal';
import { CheckCircle, Clock, Coffee, FileText, Loader2, Play, RefreshCw } from 'lucide-react';

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

function normalizeStatus(status?: string) {
  return String(status || '').toUpperCase();
}

export function OrdersToMakePanel({ refreshKey, variant = 'compact' }: { refreshKey: number; variant?: 'compact' | 'full' }) {
  const { data: orders = [], isLoading, refetch } = useOrderQueue(
    { paymentStatus: 'PAID' },
    { refetchInterval: 5000 }
  );
  const updateMutation = useUpdateOrderQueueMutation();
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  const prevKey = useRef(refreshKey);
  if (prevKey.current !== refreshKey) {
    prevKey.current = refreshKey;
    queueMicrotask(() => refetch());
  }

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const handleMarkPreparing = (order: OrderDetail) => {
    updateMutation.mutate(
      { id: order.id, status: 'PREPARING' },
      {
        onSuccess: () => toast.success(`Đang làm ${getShortOrderNumber(order)}`),
        onError: (e: any) => toast.error('Không thể cập nhật', { description: e.message }),
      }
    );
  };

  const handleComplete = (order: OrderDetail) => {
    updateMutation.mutate(
      { id: order.id, status: 'COMPLETED' },
      {
        onSuccess: () => toast.success(`Hoàn thành ${getShortOrderNumber(order)}`),
        onError: (e: any) => toast.error('Không thể hoàn thành', { description: e.message }),
      }
    );
  };

  if (variant === 'full') {
    return (
      <section className="flex flex-col  min-w-0 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="shrink-0 border-b border-border p-2 lg:p-3">
          <div className="flex items-center justify-between gap-1.5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 text-lg lg:text-xl font-black text-foreground">
                <Coffee className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Đơn cần làm</span>
              </h1>
              <p className="text-[10px] lg:text-xs text-muted-foreground">
                {isLoading ? 'Đang tải...' : `${sortedOrders.length} đơn`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition shrink-0"
              title="Làm mới"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1.5 lg:space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : sortedOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-muted-foreground text-xs">
              Không có đơn cần làm
            </div>
          ) : (
            sortedOrders.map(order => (
              <article key={order.id} className="rounded-lg lg:rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-1.5 border-b border-border bg-muted/50 p-2 lg:p-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs lg:text-sm font-black text-amber-700 dark:text-amber-400">
                      {getShortOrderNumber(order)}
                    </span>
                    {order.table && (
                      <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {order.table.tableCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(order.createdAt)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      normalizeStatus(order.status) === 'PREPARING'
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {normalizeStatus(order.status) === 'PREPARING' ? 'ĐANG LÀM' : 'CHỜ'}
                    </span>
                  </div>
                </div>

                <div className="p-2 lg:p-3 space-y-1.5">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-1.5 lg:p-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-foreground">{item.name}</span>
                      </div>
                      <span className="shrink-0 ml-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-black text-blue-700 dark:text-blue-300">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {order.note && (
                  <div className="mx-2 lg:mx-3 mb-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      <FileText className="h-3.5 w-3.5" />
                      Ghi chú
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-300">{order.note}</p>
                  </div>
                )}

                <div className="flex items-center gap-1.5 border-t border-border p-2 lg:p-3">
                  <button
                    type="button"
                    onClick={() => handleMarkPreparing(order)}
                    disabled={normalizeStatus(order.status) === 'PREPARING'}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground transition hover:bg-accent disabled:opacity-40"
                  >
                    <Play className="size-3.5" />
                    Đang làm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleComplete(order)}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-black text-white shadow-lg shadow-emerald-200/20 transition hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <CheckCircle className="size-3.5" />
                    Hoàn thành
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }

  const bodyContent = isLoading ? (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  ) : sortedOrders.length === 0 ? (
    <div className="rounded-lg border border-dashed border-border p-3 text-center text-muted-foreground text-xs">
      Không có đơn cần làm
    </div>
  ) : (
    sortedOrders.map(order => (
      <article
        key={order.id}
        onClick={() => setSelectedOrder(order)}
        className="cursor-pointer rounded-lg border border-border bg-card p-2 lg:p-3 transition hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
      >
        <div className="mb-2 flex items-start justify-between gap-1.5">
          <div className="text-xs lg:text-sm font-black text-amber-700 dark:text-amber-400" title={`#${order.orderNumber}`}>
            {getShortOrderNumber(order)}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
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
    <section className="flex flex-col h-full min-w-0 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="shrink-0 border-b border-border p-2 lg:p-3">
        <div className="flex items-center justify-between gap-1.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-xs lg:text-base font-black text-foreground">
              <Coffee className="size-3.5 lg:h-4 lg:w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">Đơn cần làm</span>
            </h2>
            <p className="text-[10px] lg:text-xs text-muted-foreground">
              {isLoading ? 'Đang tải...' : `${sortedOrders.length} đơn`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition shrink-0"
            title="Làm mới"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1.5">
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
