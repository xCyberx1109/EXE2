import { useEffect, useState } from 'react';
import { useOrderQueue } from '../api/hooks';
import { OrderDetail } from '../types';
import { OrderProductionModal } from './OrderProductionModal';
import { Clock, Coffee, Loader2, RefreshCw } from 'lucide-react';

function formatTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    { refetchInterval: 5000, staleTime: 0 }
  );
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    refetch();
  }, [refreshKey, refetch]);

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const bodyContent = isLoading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
    </div>
  ) : sortedOrders.length === 0 ? (
    <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-slate-500 text-sm">
      Không có đơn cần làm
    </div>
  ) : (
    sortedOrders.map(order => (
      <article
        key={order.id}
        onClick={() => setSelectedOrder(order)}
        className="cursor-pointer rounded-2xl lg:rounded-3xl border border-slate-200 bg-white p-3 lg:p-4 transition hover:border-amber-300 hover:bg-amber-50/50"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="text-sm lg:text-lg font-black text-amber-700" title={`#${order.orderNumber}`}>
            {getShortOrderNumber(order)}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0" />
            {formatTime(order.createdAt)}
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {order.items.slice(0, 3).map(item => (
            <span
              key={item.id}
              className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] lg:text-xs font-semibold text-slate-600 truncate max-w-[120px]"
            >
              {item.name} x{item.quantity}
            </span>
          ))}
          {order.items.length > 3 && (
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              +{order.items.length - 3}
            </span>
          )}
        </div>
      </article>
    ))
  );

  return (
    <section className="flex flex-col h-full min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="shrink-0 border-b border-slate-100 p-3 lg:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base lg:text-lg font-black text-slate-900">
              <Coffee className="h-4 w-4 lg:h-5 lg:w-5 text-amber-600 shrink-0" />
              <span className="truncate">Orders To Make</span>
            </h2>
            <p className="text-xs lg:text-sm text-slate-500">
              {isLoading ? 'Đang tải...' : `${sortedOrders.length} orders`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
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
          onStatusChange={() => refetch()}
        />
      )}
    </section>
  );
}