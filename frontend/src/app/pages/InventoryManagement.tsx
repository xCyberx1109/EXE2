import { useState } from 'react';
import { Plus, Edit, Trash2, Search, AlertTriangle, TrendingDown, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useInventoryItems, useInventoryStats,
  useCreateInventoryItemMutation, useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
} from '../api/hooks';
import { useDebounce } from '../../shared/hooks/useDebounce';
import type { InventoryItem, DeleteDependencyReport } from '../types';

type StockStatus = 'all' | 'LOW_STOCK' | 'NORMAL';

export function InventoryManagement() {
  const { isReady, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [stockStatus, setStockStatus] = useState<StockStatus>('all');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data: inventoryItems = [], isLoading } = useInventoryItems({
    search: debouncedSearch || undefined,
    status: stockStatus !== 'all' ? stockStatus : undefined,
  });
  const { data: stats } = useInventoryStats();
  const createMutation = useCreateInventoryItemMutation();
  const updateMutation = useUpdateInventoryItemMutation();
  const deleteMutation = useDeleteInventoryItemMutation();
  const [saving, setSaving] = useState(false);
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
    if (!confirm('Bạn có chắc muốn lưu trữ (archive) mặt hàng này?')) return;
    try {
      const report = await deleteMutation.mutateAsync(id) as unknown as DeleteDependencyReport;
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  };

  if (!hasPermission('INVENTORY_VIEW')) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <p>Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }

  if (isLoading && inventoryItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải tồn kho...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quản lý Tồn kho</h1>
          <p className="text-muted-foreground mt-1">Theo dõi và quản lý hàng tồn kho</p>
        </div>
        {hasPermission('INVENTORY_CREATE') && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Thêm hàng hóa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tổng mặt hàng</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats?.totalItems ?? inventoryItems.length}</p>
            </div>
            <div className="p-3 bg-accent rounded-lg">
              <TrendingDown className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cảnh báo tồn thấp</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{lowStockCount}</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div>
            <p className="text-sm text-muted-foreground">Tổng giá trị kho</p>
            <p className="text-2xl font-bold text-foreground mt-1">{(totalValue / 1000000).toFixed(1)}M ₫</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm hàng hóa, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setStockStatus(stockStatus === 'LOW_STOCK' ? 'all' : 'LOW_STOCK')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              stockStatus === 'LOW_STOCK'
                ? 'bg-orange-600 text-white'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            Sắp hết hàng
          </button>
          <button
            onClick={() => setStockStatus(stockStatus === 'NORMAL' ? 'all' : 'NORMAL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              stockStatus === 'NORMAL'
                ? 'bg-green-600 text-white'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            Bình thường
          </button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tên hàng hóa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Số lượng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ngưỡng cảnh báo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Đơn giá</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Giá trị</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nhà cung cấp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cập nhật</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {inventoryItems.map((item) => {
                const isLowStock = item.quantity <= item.warningQuantity;
                const itemTotalValue = item.quantity * item.price;
                return (
                  <tr key={item.id} className={`hover:bg-accent ${isLowStock ? 'bg-orange-50 dark:bg-orange-950/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isLowStock && <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                        <div className="font-medium text-foreground">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${isLowStock ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{item.warningQuantity} {item.unit}</td>
                    <td className="px-6 py-4 text-sm">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                          <AlertTriangle className="w-3 h-3" /> Sắp hết
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                          Bình thường
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{item.price.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{itemTotalValue.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{item.supplier}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{item.lastUpdated}</td>
                    <td className="px-6 py-4 text-right text-sm">
                      {hasPermission('INVENTORY_UPDATE') && (
                        <button onClick={() => handleEdit(item)} className="text-primary hover:text-primary/80 mr-3">
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('INVENTORY_DELETE') && (
                        <button onClick={() => handleDelete(item.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
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

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              {editingItem ? 'Chỉnh sửa hàng hóa' : 'Thêm hàng hóa mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tên hàng hóa</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Số lượng</label>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Đơn vị</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
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
                  <label className="block text-sm font-medium text-foreground mb-1">Ngưỡng cảnh báo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.warningQuantity}
                    onChange={(e) => setFormData({ ...formData, warningQuantity: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Đơn giá (₫)</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nhà cung cấp</label>
                <input
                  type="text"
                  required
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent">
                  Hủy
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
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