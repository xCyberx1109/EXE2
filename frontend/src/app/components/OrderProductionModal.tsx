import { toast } from 'sonner';
import { useUpdateOrderQueueMutation } from '../api/hooks';
import { OrderDetail } from '../types';
import { X, CheckCircle, Clock, FileText } from 'lucide-react';

interface OrderProductionModalProps {
  order: OrderDetail;
  onClose: () => void;
}

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

export function OrderProductionModal({ order, onClose }: OrderProductionModalProps) {
  const updateMutation = useUpdateOrderQueueMutation();

  const handleComplete = () => {
    updateMutation.mutate(
      { id: order.id, status: 'COMPLETED' },
      {
        onSuccess: () => toast.success(`Hoàn thành ${getShortOrderNumber(order)}`),
        onError: (e: any) => toast.error('Không thể hoàn thành', { description: e.message }),
      }
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-black text-foreground">
            Đơn {getShortOrderNumber(order)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatTime(order.createdAt)}</span>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Danh sách món</h3>
            <div className="space-y-2">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-foreground">{item.name}</span>
                  </div>
                  <span className="ml-2 shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-sm font-black text-blue-700 dark:text-blue-300">
                    x{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {order.note && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                <FileText className="h-3.5 w-3.5" />
                Ghi chú
              </div>
              <p className="text-sm text-amber-900 dark:text-amber-300">{order.note}</p>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4 space-y-2">
          <button
            type="button"
            onClick={handleComplete}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-200/20 transition hover:bg-emerald-700"
          >
            <CheckCircle className="h-5 w-5" />
            Hoàn thành
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-border bg-card text-sm font-bold text-foreground transition hover:bg-accent"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}