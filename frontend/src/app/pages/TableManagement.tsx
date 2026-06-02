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
import type { TableItem } from '../types';

const STATUS_OPTIONS: Array<{ value: TableItem['status']; label: string }> = [
  { value: 'AVAILABLE', label: 'Trống' },
  { value: 'OCCUPIED', label: 'Đang dùng' },
  { value: 'DISABLED', label: 'Tạm ngưng' },
];

const STATUS_BADGE: Record<TableItem['status'], { class: string; label: string }> = {
  AVAILABLE: { class: 'bg-green-100 text-green-800', label: 'Trống' },
  OCCUPIED: { class: 'bg-orange-100 text-orange-800', label: 'Đang dùng' },
  DISABLED: { class: 'bg-gray-100 text-gray-500', label: 'Tạm ngưng' },
};

type TableFormState = {
  tableCode: string;
  tableName: string;
  capacity: string;
  status: TableItem['status'];
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

  const isEditing = Boolean(editingTableId);
  const isEditModalOpen = Boolean(editingTableId);

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tableApi.list();
      setTables(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách bàn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
  };

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

  const handleDelete = async (table: TableItem) => {
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
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Grid3X3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lý bàn</h1>
              <p className="text-sm text-gray-500 mt-1">Quản lý danh sách bàn trong chi nhánh.</p>
            </div>
          </div>

          {hasPermission('TABLE_CREATE') && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Thêm bàn
            </button>
          )}
        </div>
      </div>

      {error && !isCreateModalOpen && !isEditModalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải danh sách bàn...</div>
        ) : tables.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Chưa có bàn nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 font-medium text-gray-700">Mã bàn</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Tên bàn</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Sức chứa</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Trạng thái</th>
                  <th className="px-6 py-4 font-medium text-gray-700 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tables.map((table) => (
                  <tr key={table.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">{table.tableCode}</td>
                    <td className="px-6 py-4 text-gray-600">{table.tableName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{table.capacity}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[table.status].class}`}>
                        {STATUS_BADGE[table.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {hasPermission('TABLE_UPDATE') && (
                          <button
                            type="button"
                            onClick={() => handleEdit(table)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                          >
                            <Edit3 className="w-4 h-4" />
                            Sửa
                          </button>
                        )}
                        {hasPermission('TABLE_DELETE') && (
                          <button
                            type="button"
                            onClick={() => handleDelete(table)}
                            disabled={deletingId === table.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === table.id ? 'Đang xóa...' : 'Xóa'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {isEditing ? 'Cập nhật bàn' : 'Thêm bàn mới'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {isEditing ? 'Chỉnh sửa thông tin bàn.' : 'Tạo bàn mới trong chi nhánh.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  Đóng
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Mã bàn *</span>
                  <input
                    value={form.tableCode}
                    onChange={(e) => setForm((cur) => ({ ...cur, tableCode: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="VD: B01"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Tên bàn</span>
                  <input
                    value={form.tableName}
                    onChange={(e) => setForm((cur) => ({ ...cur, tableName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="VD: Bàn cửa sổ"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Sức chứa *</span>
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(e) => setForm((cur) => ({ ...cur, capacity: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Trạng thái</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((cur) => ({ ...cur, status: e.target.value as TableItem['status'] }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    'Đang lưu...'
                  ) : (
                    <>
                      {isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
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
