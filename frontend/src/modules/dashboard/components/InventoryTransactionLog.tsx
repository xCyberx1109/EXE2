import { useState } from 'react';
import { Package, ArrowUpFromLine, ArrowDownFromLine, ClipboardList } from 'lucide-react';
import { useInventoryTransactions } from '../../../app/api/hooks';
import { SectionHeader, EmptyState } from './shared';
import type { InventoryTransaction } from '../../../app/types';

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
};

const typeMeta: Record<string, { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }> = {
  IMPORT: { label: 'Nhập', badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: ArrowDownFromLine },
  OUT: { label: 'Xuất', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: ArrowUpFromLine },
  ADJUST: { label: 'Điều chỉnh', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: ClipboardList },
  RETURN: { label: 'Trả lại', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', icon: Package },
  WASTE: { label: 'Hủy', badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', icon: Package },
  AUDIT: { label: 'Kiểm kê', badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400', icon: ClipboardList },
  SALE: { label: 'Bán hàng', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', icon: Package },
};

const defaultMeta = { label: 'Khác', badge: 'bg-muted text-muted-foreground', icon: Package };

const filterOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'IMPORT', label: 'Nhập kho' },
  { value: 'OUT', label: 'Xuất kho' },
];

export function InventoryTransactionLog() {
  const [typeFilter, setTypeFilter] = useState('all');
  const { data: txs, isLoading } = useInventoryTransactions(10);
  const safeTxs = Array.isArray(txs) ? txs : [];
  const filteredTxs = typeFilter === 'all' ? safeTxs : safeTxs.filter((tx) => tx.type === typeFilter);

  if (isLoading) {
    return (
      <div className="bg-card rounded-md border border-border p-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-md border border-border p-3">
      <SectionHeader title="Nhật ký xuất nhập kho" actionLabel="Xem tất cả" actionHref="/app/inventory">
        <div className="flex gap-0.5 bg-muted p-0.5 rounded-md">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-2 py-1 text-[10px] font-medium rounded-sm transition-all whitespace-nowrap ${
                typeFilter === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SectionHeader>
      <p className="text-xs text-muted-foreground mb-3">Các hoạt động nhập và xuất kho gần nhất</p>

      {filteredTxs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground font-medium border-b border-border">
                <th className="text-left py-2 pr-3 whitespace-nowrap">Thời gian</th>
                <th className="text-left py-2 pr-3 whitespace-nowrap">Loại</th>
                <th className="text-left py-2 pr-3 whitespace-nowrap">Hàng hóa</th>
                <th className="text-right py-2 pr-3 whitespace-nowrap">Số lượng</th>
                <th className="text-left py-2 pr-3 whitespace-nowrap hidden sm:table-cell">Lý do</th>
                <th className="text-left py-2 whitespace-nowrap hidden md:table-cell">Nhân viên</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxs.map((tx: InventoryTransaction) => {
                const meta = typeMeta[tx.type] || defaultMeta;
                const isImport = tx.type === 'IMPORT';
                const qtyColor = isImport ? 'text-green-600' : 'text-red-600';
                const qtySign = isImport ? '+' : '-';
                return (
                  <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2 pr-3 text-foreground whitespace-nowrap">{formatTime(tx.createdAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.badge}`}>
                        <meta.icon className="size-3" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-foreground font-medium whitespace-nowrap">{tx.ingredientName}</td>
                    <td className={`py-2 pr-3 text-right font-semibold whitespace-nowrap ${qtyColor}`}>
                      {qtySign}{tx.quantity} {tx.ingredientUnit}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground max-w-[180px] truncate hidden sm:table-cell">{tx.note || '—'}</td>
                    <td className="py-2 text-muted-foreground whitespace-nowrap hidden md:table-cell">{tx.user?.fullName || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="Chưa có giao dịch xuất nhập kho" icon={Package} />
      )}
    </div>
  );
}