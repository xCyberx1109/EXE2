import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Loader2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../../shared/hooks/useCategories';
import {
  useMenuItems, useTopSellingMenuItems, useInventoryItems,
  useCreateMenuItemMutation, useUpdateMenuItemMutation,
  useToggleMenuItemAvailabilityMutation, useDeleteMenuItemMutation,
} from '../api/hooks';
import { useDebounce } from '../../shared/hooks/useDebounce';
import type { MenuItem } from '../types';

type RecipeRow = {
  ingredientId: string;
  amount: string;
};

const emptyRecipeRow: RecipeRow = { ingredientId: '', amount: '' };

export function MenuManagement() {
  const { isReady } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data: menuItems = [], isLoading } = useMenuItems({
    search: debouncedSearch || undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
  });
  const { data: topSelling = [] } = useTopSellingMenuItems();
  const { data: ingredients = [] } = useInventoryItems();
  const createMutation = useCreateMenuItemMutation();
  const updateMutation = useUpdateMenuItemMutation();
  const toggleMutation = useToggleMenuItemAvailabilityMutation();
  const deleteMutation = useDeleteMenuItemMutation();

  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([{ ...emptyRecipeRow }]);
  const [saving, setSaving] = useState(false);
  const { categories, loading: catsLoading, error: catsError } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    price: '',
    cost: '',
    description: '',
    available: true,
  });

  useEffect(() => {
    if (categories.length > 0 && formData.categoryId === '') {
      setFormData((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories]);

  const orderMap = topSelling.reduce((map, item) => {
    map[item.menuItemId] = item.soldQuantity;
    return map;
  }, {} as Record<string, number>);

  const filteredItems = [...menuItems].sort(
    (a, b) => (orderMap[b.id] || 0) - (orderMap[a.id] || 0)
  );

  const addRecipeRow = () => {
    setRecipeRows((rows) => [...rows, { ...emptyRecipeRow }]);
  };

  const removeRecipeRow = (index: number) => {
    setRecipeRows((rows) => rows.length === 1 ? [{ ...emptyRecipeRow }] : rows.filter((_, i) => i !== index));
  };

  const updateRecipeRow = (index: number, patch: Partial<RecipeRow>) => {
    setRecipeRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const validateRecipeRows = () => {
    const validRows = recipeRows.filter((row) => row.ingredientId);
    const selectedIds = validRows.map((row) => row.ingredientId);

    if (validRows.some((row) => !row.ingredientId)) {
      throw new Error('Vui lòng chọn nguyên liệu cho tất cả dòng công thức');
    }

    if (validRows.some((row) => Number(row.amount) <= 0)) {
      throw new Error('Số lượng nguyên liệu phải lớn hơn 0');
    }

    if (new Set(selectedIds).size !== selectedIds.length) {
      throw new Error('Không được chọn trùng nguyên liệu trong cùng một món');
    }

    return validRows;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!formData.name.trim()) {
        throw new Error('Tên món là bắt buộc');
      }
      if (!formData.categoryId.trim()) {
        throw new Error('Danh mục là bắt buộc');
      }
      const priceVal = Number(formData.price);
      const costVal = Number(formData.cost);
      if (formData.price === '' || isNaN(priceVal)) {
        throw new Error('Giá bán là bắt buộc và phải là số hợp lệ');
      }
      if (formData.cost === '' || isNaN(costVal)) {
        throw new Error('Giá vốn là bắt buộc và phải là số hợp lệ');
      }
      if (priceVal < 0) throw new Error('Giá bán không được âm');
      if (costVal < 0) throw new Error('Giá vốn không được âm');

      const recipeIngredients = validateRecipeRows().map((row) => ({
        ingredientId: row.ingredientId,
        amount: Number(row.amount),
      }));
      const payload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId.trim(),
        price: priceVal,
        cost: costVal,
        description: formData.description,
        available: formData.available,
        ingredients: recipeIngredients,
      };

      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      resetForm();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData({
      name: '',
      categoryId: '',
      price: '',
      cost: '',
      description: '',
      available: true,
    });
    setRecipeRows([{ ...emptyRecipeRow }]);
  };

  const openCreateForm = () => {
    resetForm();
    setFormData((prev) => ({
      ...prev,
      categoryId: categories.length > 0 ? categories[0].id : '',
    }));
    setShowForm(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      categoryId: item.categoryId || '',
      price: String(item.price),
      cost: String(item.cost),
      description: item.description,
      available: item.available,
    });
    setRecipeRows(
      item.ingredients?.length
        ? item.ingredients.map((row) => ({
          ingredientId: row.ingredient?.id ?? row.ingredientId ?? '',
          amount: String(row.amount ?? 0),
        }))
        : [{ ...emptyRecipeRow }]
    );
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa món ăn này?')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cập nhật thất bại');
    }
  };

  if (isLoading && menuItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải menu...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quản lý Menu</h1>
          <p className="text-muted-foreground mt-1">Quản lý danh sách món ăn và thức uống</p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Thêm món mới
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm món ăn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-accent'
                }`}
            >
              Tất cả
            </button>
            {catsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tải danh mục...
              </div>
            ) : catsError ? (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                Lỗi tải danh mục
              </div>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat.name
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-accent'
                    }`}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tên món</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Danh mục</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Công thức</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Giá bán</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Giá vốn</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Lợi nhuận</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => {
                const profit = item.price - item.cost;
                const profitMargin = item.price > 0 ? ((profit / item.price) * 100).toFixed(1) : '0';
                return (
                  <tr key={item.id} className="hover:bg-accent">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.category}</td>
                    <td className="px-6 py-4 text-sm">
                      {item.ingredients?.length ? (
                        <div className="space-y-1">
                          {item.ingredients.slice(0, 3).map((row) => (
                            <div key={row.id} className="text-muted-foreground">
                              {row.ingredient?.name || 'Nguyên liệu'}:{' '}
                              <span className="font-medium">
                                {Number(row.amount).toLocaleString()}{' '}
                                {row.ingredient?.unit || ''}
                              </span>
                            </div>
                          ))}
                          {item.ingredients.length > 3 && (
                            <div className="text-xs text-muted-foreground">+{item.ingredients.length - 3} nguyên liệu</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Chưa có</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{item.price.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm">{item.cost.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-green-600 font-medium">{profit.toLocaleString()} ₫</div>
                      <div className="text-xs text-muted-foreground">{profitMargin}%</div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAvailability(item.id)}
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${item.available ? 'bg-green-100 text-green-800' : 'bg-muted text-foreground'
                          }`}
                      >
                        {item.available ? 'Khả dụng' : 'Ngừng bán'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(item)} className="text-primary hover:text-primary/80 mr-3">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món ăn mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên món</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Danh mục</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg"
                  disabled={catsLoading}
                >
                  {catsLoading ? (
                    <option value="">Đang tải danh mục...</option>
                  ) : catsError ? (
                    <option value="">Lỗi tải danh mục</option>
                  ) : categories.length === 0 ? (
                    <option value="">Chưa có danh mục</option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Giá bán (₫)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Giá vốn (₫)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">Công thức nguyên liệu</label>
                    <p className="text-xs text-muted-foreground mt-1">Nhập số lượng nguyên liệu cần dùng cho 1 phần món</p>
                  </div>
                  <button
                    type="button"
                    onClick={addRecipeRow}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent text-primary rounded-lg hover:bg-accent"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm dòng
                  </button>
                </div>

                {recipeRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-7">
                      <select
                        value={row.ingredientId}
                        onChange={(e) => updateRecipeRow(index, { ingredientId: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-lg text-sm"
                      >
                        <option value="">-- Chọn nguyên liệu --</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.quantity} {i.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={row.amount}
                        onChange={(e) => updateRecipeRow(index, { amount: e.target.value })}
                        placeholder="Số lượng"
                        className="w-full px-3 py-2 border border-input rounded-lg text-sm pr-12"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeRecipeRow(index)}
                        className="p-2 text-muted-foreground hover:text-destructive"
                        title="Xóa dòng"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="available" className="text-sm">Món ăn khả dụng</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border rounded-lg">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : editingItem ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}