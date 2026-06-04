import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, AlertTriangle, TrendingDown, Loader2 } from 'lucide-react';
import { inventoryApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { InventoryItem, InventoryStats, DeleteDependencyReport } from '../types';

type StockStatus = 'all' | 'LOW_STOCK' | 'NORMAL';

export function InventoryManagement() {
  const { isReady, hasPermission } = useAuth();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockStatus, setStockStatus] = useState<StockStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: 'KG',
    quantity: '',
    warningQuantity: '',
    price: '',
    supplier: '',
    lastUpdated: new Date().toISOString().split('T')[0],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [items, s] = await Promise.all([
        inventoryApi.list({
          search: searchTerm || undefined,
          status: stockStatus !== 'all' ? stockStatus : undefined,
        }),
        inventoryApi.stats(),
      ]);
      setInventoryItems(items);
      setStats(s);
    } catch (err) {
      console.error(err);
      alert('Không tải được tồn kho. Kiểm tra backend.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, stockStatus]);

  useEffect(() => {
    if (isReady) loadData();
  }, [isReady, loadData]);

  const filteredItems = inventoryItems;
  const lowStockCount = stats?.lowStockCount ?? inventoryItems.filter(i => i.quantity <= i.warningQuantity).length;
  const totalValue = stats?.totalValue ?? inventoryItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const toNum = (v: string) => v === '' ? 0 : Number(v);
      const payload = {
        name: formData.name,
        unit: formData.unit,
        quantity: toNum(formData.quantity),
        warningQuantity: formData.warningQuantity === '' ? 0 : Number(formData.warningQuantity),
        price: toNum(formData.price),
        supplier: formData.supplier,
      };
      if (editingItem) {
        await inventoryApi.update(editingItem.id, payload);
      } else {
        await inventoryApi.create(payload);
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
      unit: 'KG',
      quantity: '',
      warningQuantity: '',
      price: '',
      supplier: '',
      lastUpdated: new Date().toISOString().split('T')[0],
    });
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      warningQuantity: String(item.warningQuantity),
      price: String(item.price),
      supplier: item.supplier,
      lastUpdated: item.lastUpdated,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn lưu trữ (archive) mặt hàng này? Hàng hóa đã lưu trữ sẽ không hiển thị trong danh sách.')) return;
    try {
      const report = await inventoryApi.delete(id) as DeleteDependencyReport;
      const deps = report.dependencies;
      const parts: string[] = [];
      if (deps.menuRecipes.length > 0) {
        const names = deps.menuRecipes.map(r => r.menuItemName).join(', ');
        parts.push(`${deps.menuRecipes.length} công thức món (${names})`);
      }
      if (deps.inventoryTransactions > 0) {
        parts.push(`${deps.inventoryTransactions} giao dịch tồn kho`);
      }
      if (deps.stockAlerts > 0) {
        parts.push(`${deps.stockAlerts} cảnh báo tồn kho`);
      }
      if (deps.stockAudits > 0) {
        parts.push(`${deps.stockAudits} kiểm kê`);
      }
      let msg = `Đã lưu trữ "${report.ingredientName}" thành công.`;
      if (parts.length > 0) {
        msg += `\n\nNguyên liệu này vẫn đang được tham chiếu bởi:\n${parts.join('\n')}\n\nDữ liệu lịch sử được giữ nguyên.`;
      }
      alert(msg);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  if (!hasPermission('INVENTORY_VIEW')) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <p>Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }

  if (loading && inventoryItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải tồn kho...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Tồn kho</h1>
          <p className="text-gray-500 mt-1">Theo dõi và quản lý hàng tồn kho</p>
        </div>
        {hasPermission('INVENTORY_MANAGE') && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Thêm hàng hóa
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tổng mặt hàng</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalItems ?? inventoryItems.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <TrendingDown className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Cảnh báo tồn thấp</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{lowStockCount}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div>
            <p className="text-sm text-gray-500">Tổng giá trị kho</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{(totalValue / 1000000).toFixed(1)}M ₫</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm hàng hóa, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setStockStatus(stockStatus === 'LOW_STOCK' ? 'all' : 'LOW_STOCK')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              stockStatus === 'LOW_STOCK'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sắp hết hàng
          </button>
          <button
            onClick={() => setStockStatus(stockStatus === 'NORMAL' ? 'all' : 'NORMAL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              stockStatus === 'NORMAL'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Bình thường
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên hàng hóa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số lượng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngưỡng cảnh báo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đơn giá</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giá trị</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nhà cung cấp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cập nhật</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const isLowStock = item.quantity <= item.warningQuantity;
                const totalValue = item.quantity * item.price;
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${isLowStock ? 'bg-orange-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isLowStock && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                        <div className="font-medium text-gray-900">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${isLowStock ? 'text-orange-600' : 'text-gray-900'}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.warningQuantity} {item.unit}</td>
                    <td className="px-6 py-4 text-sm">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3" /> Sắp hết
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Bình thường
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.price.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{totalValue.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.supplier}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.lastUpdated}</td>
                    <td className="px-6 py-4 text-right text-sm">
                      {hasPermission('INVENTORY_MANAGE') && (
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('INVENTORY_MANAGE') && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingItem ? 'Chỉnh sửa hàng hóa' : 'Thêm hàng hóa mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên hàng hóa</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng</label>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="KG">Kg</option>
                    <option value="LITER">Lít</option>
                    <option value="PIECE">Chiếc</option>
                    <option value="UNIT">Gói</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngưỡng cảnh báo ({formData.unit})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.warningQuantity}
                    onChange={(e) => setFormData({ ...formData, warningQuantity: e.target.value })}
                    placeholder="Nhập ngưỡng cảnh báo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá (₫)</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp</label>
                <input
                  type="text"
                  required
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
