import { useState } from 'react';
import { toast } from 'sonner';
import { useUpdateOrderQueueMutation } from '../api/hooks';
import { OrderDetail } from '../types';
import { X, CheckCircle, Clock, FileText } from 'lucide-react';

interface OrderProductionModalProps {
  order: OrderDetail;
  onClose: () => void;
  onStatusChange: () => void;
}

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

export function OrderProductionModal({ order, onClose, onStatusChange }: OrderProductionModalProps) {
  const updateMutation = useUpdateOrderQueueMutation();

  const handleComplete = async () => {
    try {
      await updateMutation.mutateAsync({ id: order.id, status: 'COMPLETED' });
      toast.success(`Hoàn thành ${getShortOrderNumber(order)}`);
      onStatusChange();
      onClose();
    } catch (e: any) {
      toast.error('Không thể hoàn thành', { description: e.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="text-lg font-black text-slate-900">
            Order {getShortOrderNumber(order)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            <span>{formatTime(order.createdAt)}</span>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Danh sách món</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-slate-900">{item.name}</span>
                  </div>
                  <span className="ml-2 shrink-0 rounded-lg bg-blue-100 px-2 py-0.5 text-sm font-black text-blue-700">
                    x{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {order.note && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1">
                <FileText className="h-3.5 w-3.5" />
                Ghi chú
              </div>
              <p className="text-sm text-amber-900">{order.note}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4 space-y-2">
          <button
            type="button"
            onClick={handleComplete}
            disabled={updateMutation.isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <CheckCircle className="h-5 w-5" />
            {updateMutation.isPending ? 'Đang cập nhật...' : 'Hoàn thành'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}