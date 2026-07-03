import { FormEvent, useEffect, useState } from 'react';
import {
  Edit3,
  Grid3X3,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { tableApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useAsyncActionGuard } from '@/shared/hooks/useAsyncActionGuard';
import { DataTable, type Column } from '../components/DataTable';
import type { TableItem, TableStatus } from '../types';

const STATUS_OPTIONS: Array<{ value: TableStatus; label: string }> = [
  { value: 'AVAILABLE', label: 'Trống' },
  { value: 'OCCUPIED', label: 'Đang dùng' },
  { value: 'RESERVED', label: 'Đặt trước' },
  { value: 'CLEANING', label: 'Đang dọn' },
  { value: 'CHECKING_OUT', label: 'Đang thanh toán' },
  { value: 'DISABLED', label: 'Tạm ngưng' },
];

const STATUS_BADGE: Record<TableStatus, { class: string; label: string }> = {
  AVAILABLE: { class: 'bg-green-100 text-green-800', label: 'Trống' },
  OCCUPIED: { class: 'bg-orange-100 text-orange-800', label: 'Đang dùng' },
  RESERVED: { class: 'bg-yellow-100 text-yellow-800', label: 'Đặt trước' },
  CLEANING: { class: 'bg-gray-100 text-gray-500', label: 'Đang dọn' },
  CHECKING_OUT: { class: 'bg-blue-100 text-blue-800', label: 'Đang thanh toán' },
  DISABLED: { class: 'bg-gray-100 text-gray-500', label: 'Tạm ngưng' },
};

type TableFormState = {
  tableCode: string;
  tableName: string;
  capacity: string;
  status: TableStatus;
};

const createDefaultForm = (): TableFormState => ({
  tableCode: '',
  tableName: '',
  capacity: '4',
  status: 'AVAILABLE',
});

export function TableManagement() {
  const { hasPermission } = useAuth();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [form, setForm] = useState<TableFormState>(createDefaultForm);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

  const isEditing = Boolean(editingTableId);
  const isEditModalOpen = Boolean(editingTableId);

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tableApi.list({ page, limit: pageSize });
      if (Array.isArray(data)) {
        setTables(data);
        setPagination(null);
      } else {
        setTables(data.data);
        setPagination(data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách bàn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [page, pageSize]);

  const resetForm = () => {
    setIsCreateModalOpen(false);
    setEditingTableId(null);
    setForm(createDefaultForm());
  };

  const handleOpenCreateModal = () => {
    setError(null);
    setEditingTableId(null);
    setForm(createDefaultForm());
    setIsCreateModalOpen(true);
  };

  const handleSubmit = useAsyncActionGuard(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.tableCode.trim()) {
      setError('Mã bàn là bắt buộc');
      return;
    }

    const capacity = parseInt(form.capacity, 10);
    if (isNaN(capacity) || capacity < 1) {
      setError('Sức chứa phải lớn hơn 0');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingTableId) {
        const updated = await tableApi.update(editingTableId, {
          tableCode: form.tableCode.trim(),
          tableName: form.tableName.trim() || undefined,
          capacity,
          status: form.status,
        });
        setTables((current) =>
          current.map((t) => (t.id === editingTableId ? updated : t))
        );
      } else {
        const created = await tableApi.create({
          tableCode: form.tableCode.trim(),
          tableName: form.tableName.trim() || undefined,
          capacity,
          status: form.status,
        });
        setTables((current) =>
          [...current, created].sort((a, b) => a.tableCode.localeCompare(b.tableCode))
        );
      }

      resetForm();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu bàn');
    } finally {
      setSaving(false);
    }
  }, { delay: 500 });

  const handleEdit = (table: TableItem) => {
    setIsCreateModalOpen(false);
    setEditingTableId(table.id);
    setError(null);
    setForm({
      tableCode: table.tableCode,
      tableName: table.tableName || '',
      capacity: String(table.capacity),
      status: table.status,
    });
  };

  const handleDelete = useAsyncActionGuard(async (table: TableItem) => {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa bàn "${table.tableCode}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(table.id);
      setError(null);
      await tableApi.delete(table.id);
      setTables((current) => current.filter((t) => t.id !== table.id));

      if (editingTableId === table.id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa bàn');
    } finally {
      setDeletingId(null);
    }
  }, { delay: 500 });

  const columns: Column<TableItem>[] = [
    { key: 'tableCode', header: 'Mã bàn', render: (item) => <span className="font-semibold text-foreground">{item.tableCode}</span> },
    { key: 'tableName', header: 'Tên bàn', render: (item) => <span className="text-muted-foreground">{item.tableName || '—'}</span> },
    { key: 'capacity', header: 'Sức chứa', render: (item) => <span className="text-muted-foreground">{item.capacity}</span> },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (item) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.status].class}`}>
          {STATUS_BADGE[item.status].label}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <div className="flex justify-end gap-1.5">
          {hasPermission('TABLE_UPDATE') && (
            <button
              type="button"
              onClick={() => handleEdit(item)}
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              <Edit3 className="size-3.5" />
              Sửa
            </button>
          )}
          {hasPermission('TABLE_DELETE') && (
            <button
              type="button"
              onClick={() => handleDelete.run(item)}
              disabled={handleDelete.isBusy || deletingId === item.id}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
              {deletingId === item.id ? 'Đang xóa...' : 'Xóa'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-1">
      <div className="flex-shrink-0 bg-card rounded-md border border-border p-3">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 bg-blue-100 rounded-md flex items-center justify-center">
              <Grid3X3 className="size-[18px] text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Quản lý bàn</h1>
              <p className="text-xs text-muted-foreground mt-1">Quản lý danh sách bàn trong chi nhánh.</p>
            </div>
          </div>

          {hasPermission('TABLE_CREATE') && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              <Plus className="size-3.5" />
              Thêm bàn
            </button>
          )}
        </div>
      </div>

      {error && !isCreateModalOpen && !isEditModalOpen && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">{error}</div>
      )}

      <DataTable columns={columns} data={tables} keyExtractor={(item) => item.id} loading={loading} emptyMessage="Chưa có bàn nào." pagination={pagination} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />

      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-lg rounded-md bg-card shadow-2xl">
            <form onSubmit={(e) => handleSubmit.run(e)} className="space-y-1 p-3">
              <div className="flex items-center justify-between gap-1.5 border-b border-border pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {isEditing ? 'Cập nhật bàn' : 'Thêm bàn mới'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isEditing ? 'Chỉnh sửa thông tin bàn.' : 'Tạo bàn mới trong chi nhánh.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-gray-600 hover:bg-muted"
                >
                  <X className="size-3.5" />
                  Đóng
                </button>
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-600">{error}</div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-700">Mã bàn *</span>
                  <input
                    value={form.tableCode}
                    onChange={(e) => setForm((cur) => ({ ...cur, tableCode: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="VD: B01"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-700">Tên bàn</span>
                  <input
                    value={form.tableName}
                    onChange={(e) => setForm((cur) => ({ ...cur, tableName: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="VD: Bàn cửa sổ"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-700">Sức chứa *</span>
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(e) => setForm((cur) => ({ ...cur, capacity: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-gray-700">Trạng thái</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((cur) => ({ ...cur, status: e.target.value as TableStatus }))}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={handleSubmit.isBusy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2 py-1.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {(handleSubmit.isBusy || saving) ? (
                    'Đang lưu...'
                  ) : (
                    <>
                      {isEditing ? <Save className="size-3.5" /> : <Plus className="size-3.5" />}
                      {isEditing ? 'Lưu thay đổi' : 'Thêm bàn'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
