import { FormEvent, useEffect, useState } from 'react';
import {
  Edit3,
  FolderTree,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { categoryApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { CategoryItem } from '../types';

type CategoryFormState = {
  name: string;
  description: string;
  sortOrder: string;
  active: boolean;
};

const createDefaultForm = (): CategoryFormState => ({
  name: '',
  description: '',
  sortOrder: '0',
  active: true,
});

export function CategoryManagement() {
  const { hasPermission } = useAuth();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(createDefaultForm);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(editingCategoryId);
  const isEditModalOpen = Boolean(editingCategoryId);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await categoryApi.list();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách danh mục');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const resetForm = () => {
    setIsCreateModalOpen(false);
    setEditingCategoryId(null);
    setForm(createDefaultForm());
  };

  const handleOpenCreateModal = () => {
    setError(null);
    setEditingCategoryId(null);
    setForm(createDefaultForm());
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('Tên danh mục là bắt buộc');
      return;
    }

    const sortOrder = parseInt(form.sortOrder, 10);
    if (isNaN(sortOrder) || sortOrder < 0) {
      setError('Thứ tự phải là số không âm');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingCategoryId) {
        const updated = await categoryApi.update(editingCategoryId, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sortOrder,
          active: form.active,
        });
        setCategories((current) =>
          current.map((c) => (c.id === editingCategoryId ? updated : c))
        );
      } else {
        const created = await categoryApi.create({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sortOrder,
          active: form.active,
        });
        setCategories((current) =>
          [...current, created].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        );
      }

      resetForm();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu danh mục');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: CategoryItem) => {
    setIsCreateModalOpen(false);
    setEditingCategoryId(category.id);
    setError(null);
    setForm({
      name: category.name,
      description: category.description || '',
      sortOrder: String(category.sortOrder),
      active: category.active,
    });
  };

  const handleDelete = async (category: CategoryItem) => {
    if (category.itemCount > 0) {
      setError(`Không thể xóa danh mục "${category.name}" vì đang có ${category.itemCount} món ăn.`);
      return;
    }

    const confirmed = window.confirm(`Bạn có chắc muốn xóa danh mục "${category.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(category.id);
      setError(null);
      await categoryApi.delete(category.id);
      setCategories((current) => current.filter((c) => c.id !== category.id));

      if (editingCategoryId === category.id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa danh mục');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FolderTree className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lý danh mục</h1>
              <p className="text-sm text-gray-500 mt-1">Quản lý danh mục món ăn trong chi nhánh.</p>
            </div>
          </div>

          {hasPermission('CATEGORY_CREATE') && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 font-medium text-white hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Thêm danh mục
            </button>
          )}
        </div>
      </div>

      {error && !isCreateModalOpen && !isEditModalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải danh sách danh mục...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Chưa có danh mục nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 font-medium text-gray-700">Thứ tự</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Tên danh mục</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Mô tả</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Số món</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Trạng thái</th>
                  <th className="px-6 py-4 font-medium text-gray-700 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{category.sortOrder}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{category.name}</td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{category.description || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{category.itemCount}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${category.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {category.active ? 'Hoạt động' : 'Ẩn'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {hasPermission('CATEGORY_UPDATE') && (
                          <button
                            type="button"
                            onClick={() => handleEdit(category)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                          >
                            <Edit3 className="w-4 h-4" />
                            Sửa
                          </button>
                        )}
                        {hasPermission('CATEGORY_DELETE') && (
                          <button
                            type="button"
                            onClick={() => handleDelete(category)}
                            disabled={deletingId === category.id || category.itemCount > 0}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title={category.itemCount > 0 ? 'Không thể xóa danh mục đang có món ăn' : undefined}
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === category.id ? 'Đang xóa...' : 'Xóa'}
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
                    {isEditing ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {isEditing ? 'Chỉnh sửa thông tin danh mục.' : 'Tạo danh mục mới trong chi nhánh.'}
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
                  <span className="text-sm font-medium text-gray-700">Tên danh mục *</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    placeholder="VD: Đồ uống"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Thứ tự</span>
                  <input
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={(e) => setForm((cur) => ({ ...cur, sortOrder: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-gray-700">Mô tả</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((cur) => ({ ...cur, description: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    placeholder="Mô tả danh mục (không bắt buộc)"
                  />
                </label>

                <label className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((cur) => ({ ...cur, active: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Hoạt động</span>
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
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    'Đang lưu...'
                  ) : (
                    <>
                      {isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {isEditing ? 'Lưu thay đổi' : 'Thêm danh mục'}
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
