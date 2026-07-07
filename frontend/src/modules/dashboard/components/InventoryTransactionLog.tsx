import { useState, useMemo } from 'react';
import { Package, ArrowDownFromLine, ArrowUpFromLine, ClipboardList, Search } from 'lucide-react';
import { useInventoryTransactions } from '../../../app/api/hooks';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { DataTable, type Column } from '../../../app/components/DataTable';
import { SectionHeader } from './shared';
import type { InventoryTransaction } from '../../../app/types';
import { getUnitLabel } from '../../../shared/constants';

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
  { value: '', label: 'Tất cả' },
  { value: 'IMPORT', label: 'Nhập kho' },
  { value: 'OUT', label: 'Xuất kho' },
];

export function InventoryTransactionLog() {
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(search, 300);

  const { data: response, isLoading, isFetching } = useInventoryTransactions({
    page,
    limit: pageSize,
    type: typeFilter || undefined,
    search: debouncedSearch || undefined,
  });
  const txs = response?.data ?? [];
  const pagination = response?.pagination;

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const columns: Column<InventoryTransaction>[] = useMemo(() => [
    {
      key: 'createdAt',
      header: 'Thời gian',
      render: (tx) => <span className="whitespace-nowrap">{formatTime(tx.createdAt)}</span>,
    },
    {
      key: 'type',
      header: 'Loại',
      render: (tx) => {
        const meta = typeMeta[tx.type] || defaultMeta;
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.badge}`}>
            <meta.icon className="size-3" />
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'ingredientName',
      header: 'Hàng hóa',
      render: (tx) => <span className="font-medium">{tx.ingredientName}</span>,
    },
    {
      key: 'quantity',
      header: 'Số lượng',
      className: 'text-right',
      render: (tx) => {
        const isImport = tx.type === 'IMPORT';
        return (
          <span className={`font-semibold ${isImport ? 'text-green-600' : 'text-red-600'}`}>
            {isImport ? '+' : '-'}{tx.quantity} {getUnitLabel(tx.ingredientUnit)}
          </span>
        );
      },
    },
    {
      key: 'note',
      header: 'Lý do',
      className: 'text-muted-foreground max-w-[180px] truncate hidden sm:table-cell',
      render: (tx) => <>{tx.note || '—'}</>,
    },
    {
      key: 'user',
      header: 'Nhân viên',
      className: 'text-muted-foreground hidden md:table-cell',
      render: (tx) => <>{tx.user?.fullName || '—'}</>,
    },
  ], []);

  return (
    <div className="bg-card rounded-md border border-border p-3">
      <SectionHeader title="Nhật ký xuất nhập kho" actionLabel="Xem tất cả" actionHref="/app/inventory">
        <div className="flex gap-0.5 bg-muted p-0.5 rounded-md">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setTypeFilter(opt.value); setPage(1); }}
              className={`px-2 py-1 text-[10px] font-medium rounded-sm transition-all whitespace-nowrap ${
                typeFilter === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SectionHeader>

      <div className="relative mb-3 mt-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm kiếm hàng hóa..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-input-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <DataTable
        columns={columns}
        data={txs}
        keyExtractor={(tx) => tx.id}
        loading={isLoading || isFetching}
        emptyMessage="Chưa có giao dịch xuất nhập kho"
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}