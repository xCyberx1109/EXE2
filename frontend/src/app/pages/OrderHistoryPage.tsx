import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ordersApi } from '../api/services';
import { DataTablePagination } from '../components/DataTablePagination';
import type { OrderDetail, PaginatedResponse } from '../types';
import { Calendar, Eye, Filter, Loader2, RefreshCw, Search } from 'lucide-react';
import { APP_NAME } from '../../shared/constants';

const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'PREPARING', label: 'Đang chế biến' },
  { value: 'READY', label: 'Sẵn sàng' },
  { value: 'SERVED', label: 'Đã phục vụ' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'POS', label: 'POS' },
  { value: 'ORDER_QUEUE_POS', label: 'Queue POS' },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  CONFIRMED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  PREPARING: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  READY: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  SERVED: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  REFUNDED: 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300',
};

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString()}₫`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  const loadOrders = (loadPage: number, loadLimit: number) => {
    setLoading(true);
    setError(null);
    ordersApi
      .history({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
        page: loadPage,
        limit: loadLimit,
      })
      .then(data => {
        if (data && typeof data === 'object' && 'data' in data && 'pagination' in data) {
          const paginated = data as PaginatedResponse<OrderDetail>;
          setOrders(paginated.data || []);
          setPagination(paginated.pagination);
        } else {
          setOrders((data || []) as OrderDetail[]);
          setPagination(null);
        }
      })
      .catch((e: any) => setError(e.message || 'Không thể tải lịch sử đơn hàng'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders(page, pageSize);
  }, [loadKey]);

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return orders;
    return orders.filter(order =>
      order.orderNumber.toLowerCase().includes(keyword)
    );
  }, [orders, search]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLoadKey(k => k + 1);
  };

  const handleRefresh = () => {
    setLoadKey(k => k + 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setLoadKey(k => k + 1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    setLoadKey(k => k + 1);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Lịch sử đơn hàng</h1>
          <p className="text-xs text-muted-foreground">Tra cứu đơn hàng đã hoàn tất</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      <form onSubmit={handleFilter} className="rounded-md border border-border bg-card p-3 flex-shrink-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              Từ ngày
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Calendar className="inline h-3 w-3 mr-1" />
              Đến ngày
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Filter className="inline h-3 w-3 mr-1" />
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {ORDER_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              <Filter className="inline h-3 w-3 mr-1" />
              Nguồn
            </label>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {SOURCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="h-9 w-full rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              Tra cứu
            </button>
          </div>
        </div>
      </form>

      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo mã đơn hàng..."
          className="h-9 w-full rounded-md border border-input bg-input-background pl-9 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive flex-shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mã đơn</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ngày</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tổng tiền</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trạng thái</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nguồn</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="inline size-4 animate-spin" />
                  <span className="ml-2">Đang tải...</span>
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Không có đơn hàng nào.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-accent transition">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-foreground text-right">
                    {formatMoney(order.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[order.status] || 'bg-muted text-foreground'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                    {order.source || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => navigate(`/app/orders/${order.id}`)}
                      className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-[10px] font-medium text-foreground hover:bg-accent transition"
                    >
                      <Eye className="size-3" />
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex-shrink-0">
          <DataTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.limit}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}