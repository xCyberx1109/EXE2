import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import { menuApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { MenuItem, TopSellingItem } from '../types';

export function MenuManagement() {
  const { isReady } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [topSelling, setTopSelling] = useState<TopSellingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    category: 'Món chính',
    price: 0,
    cost: 0,
    description: '',
    available: true,
  });

  const categories = ['all', 'Món chính', 'Món phụ', 'Đồ uống'];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [items, top] = await Promise.all([
        menuApi.list({
          search: searchTerm || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        }),
        menuApi.topSelling(),
      ]);
      setMenuItems(items);
      setTopSelling(top);
    } catch (err) {
      console.error(err);
      alert('Không tải được menu. Kiểm tra backend đang chạy.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    if (isReady) loadData();
  }, [isReady, loadData]);

  const orderMap = topSelling.reduce((map, item) => {
    map[item.menuItemId] = item.quantity;
    return map;
  }, {} as Record<string, number>);

  const filteredItems = [...menuItems].sort(
    (a, b) => (orderMap[b.id] || 0) - (orderMap[a.id] || 0)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await menuApi.update(editingItem.id, formData);
      } else {
        await menuApi.create(formData);
      }
      await loadData();
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
      category: 'Món chính',
      price: 0,
      cost: 0,
      description: '',
      available: true,
    });
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa món ăn này?')) return;
    try {
      await menuApi.delete(id);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      await menuApi.toggleAvailability(id);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cập nhật thất bại');
    }
  };

  if (loading && menuItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải menu...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Menu</h1>
          <p className="text-gray-500 mt-1">Quản lý danh sách món ăn và thức uống</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Thêm món mới
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm món ăn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category === 'all' ? 'Tất cả' : category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên món</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Danh mục</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giá bán</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giá vốn</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lợi nhuận</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const profit = item.price - item.cost;
                const profitMargin = item.price > 0 ? ((profit / item.price) * 100).toFixed(1) : '0';
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.description}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{item.category}</td>
                    <td className="px-6 py-4 text-sm font-medium">{item.price.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm">{item.cost.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-green-600 font-medium">{profit.toLocaleString()} ₫</div>
                      <div className="text-xs text-gray-500">{profitMargin}%</div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAvailability(item.id)}
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.available ? 'Khả dụng' : 'Ngừng bán'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-900 mr-3">
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
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{editingItem ? 'Chỉnh sửa món ăn' : 'Thêm món ăn mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên món</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Danh mục</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option>Món chính</option>
                  <option>Món phụ</option>
                  <option>Đồ uống</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Giá bán (₫)</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Giá vốn (₫)</label>
                  <input
                    type="number"
                    required
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
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
