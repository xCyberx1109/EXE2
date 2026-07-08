import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInventoryItems, useBulkImportMutation } from '../api/hooks';
import { Loader2, Plus, X, Package } from 'lucide-react';
import type { InventoryItem } from '../types';
import { getUnitLabel } from '../../shared/constants';

const IMPORT_REASONS = [
  'Nhập hàng từ nhà cung cấp',
  'Bổ sung hàng hóa',
  'Nhập hàng khuyến mãi',
  'Hàng trả lại từ khách',
  'Điều chuyển từ kho khác',
  'Khác',
];

interface ImportRow {
  ingredientId: string;
  quantity: string;
}

export function ImportModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { employee, user } = useAuth();
  const { data: inventoryResponse } = useInventoryItems({});
  const allIngredients: InventoryItem[] = inventoryResponse?.data ?? [];
  const bulkImportMutation = useBulkImportMutation();

  const [rows, setRows] = useState<ImportRow[]>([{ ingredientId: '', quantity: '' }]);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setRows([{ ingredientId: '', quantity: '' }]);
      setReason('');
      setCustomReason('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const selectedIds = rows.map(r => r.ingredientId).filter(Boolean);
  const availableIngredients = allIngredients.filter(i => !selectedIds.includes(i.id));

  const updateRow = (index: number, field: keyof ImportRow, value: string) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows(prev => [...prev, { ingredientId: '', quantity: '' }]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError('');

    const validRows = rows.filter(r => r.ingredientId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      setError('Vui lòng chọn ít nhất 1 nguyên liệu và nhập số lượng hợp lệ');
      return;
    }

    const fullReason = customReason.trim()
      ? `${reason} - ${customReason.trim()}`
      : reason;
    if (!fullReason) {
      setError('Vui lòng chọn lý do nhập kho');
      return;
    }

    setLoading(true);
    try {
      await bulkImportMutation.mutateAsync({
        items: validRows.map(r => ({
          ingredientId: r.ingredientId,
          quantity: Number(r.quantity),
        })),
        reason: fullReason,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nhập kho thất bại');
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const formattedTime = now.toLocaleString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const displayName = user?.fullName || employee?.fullName || 'Nhân viên';

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Package className="size-5 text-emerald-500" /> Nhập kho
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Auto-filled info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-900 rounded-lg border border-zinc-700 text-sm">
            <div>
              <span className="text-zinc-400 block text-xs mb-0.5">Thời gian</span>
              <span className="text-zinc-100 font-medium">{formattedTime}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-xs mb-0.5">Nhân viên thực hiện</span>
              <span className="text-zinc-100 font-medium">{displayName}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Danh sách nguyên liệu */}
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-3">Danh sách nguyên liệu</label>
            <div className="space-y-3">
              {rows.map((row, index) => {
                const ingredient = allIngredients.find(i => i.id === row.ingredientId);
                return (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-1">
                      <select
                        value={row.ingredientId}
                        onChange={(e) => updateRow(index, 'ingredientId', e.target.value)}
                        className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                      >
                        <option value="" className="bg-zinc-900">-- Chọn nguyên liệu --</option>
                        {(row.ingredientId
                          ? allIngredients
                          : availableIngredients
                        ).map((i) => (
                          <option key={i.id} value={i.id} className="bg-zinc-900">
                            {i.name} ({getUnitLabel(i.unit)})
                          </option>
                        ))}
                      </select>
                      {ingredient && (
                        <p className="text-xs text-zinc-400 mt-1">
                          Đơn vị: {getUnitLabel(ingredient.unit)} | Tồn kho: {ingredient.quantity}
                        </p>
                      )}
                    </div>
                    <div className="w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="SL"
                        value={row.quantity}
                        onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                        className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={rows.length <= 1}
                      className="mt-1.5 p-2 rounded-lg text-red-400 hover:bg-red-900/30 hover:text-red-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              <Plus className="size-4" /> Thêm nguyên liệu
            </button>
          </div>

          {/* Lý do */}
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-3">Lý do nhập</label>
            <div className="flex gap-3">
              <div className="flex-1">
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                >
                  <option value="" className="bg-zinc-900">-- Chọn lý do --</option>
                  {IMPORT_REASONS.map((r) => (
                    <option key={r} value={r} className="bg-zinc-900">{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Nhập lý do chi tiết (nếu có)..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-700 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 px-4 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 h-10 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <><Loader2 className="size-4 animate-spin" /> Đang xử lý...</> : 'Xác nhận nhập'}
          </button>
        </div>
      </div>
    </div>
  );
}
