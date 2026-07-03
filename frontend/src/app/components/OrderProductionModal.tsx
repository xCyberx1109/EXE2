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
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-base font-black text-foreground">
            Đơn {getShortOrderNumber(order)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>{formatTime(order.createdAt)}</span>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Danh sách món</h3>
            <div className="space-y-1.5">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-muted p-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-foreground">{item.name}</span>
                  </div>
                  <span className="ml-2 shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-black text-blue-700 dark:text-blue-300">
                    x{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {order.note && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                <FileText className="size-3.5" />
                Ghi chú
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-300">{order.note}</p>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 space-y-1.5">
          <button
            type="button"
            onClick={handleComplete}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-xs font-black text-white shadow-lg shadow-emerald-200/20 transition hover:bg-emerald-700"
          >
            <CheckCircle className="size-3.5" />
            Hoàn thành
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-full items-center justify-center rounded-md border border-border bg-card text-xs font-bold text-foreground transition hover:bg-accent"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}