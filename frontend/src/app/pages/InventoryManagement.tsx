import { useState } from 'react';
import { Plus, Edit, Trash2, Search, AlertTriangle, TrendingDown, Loader2, Package, ArrowUpFromLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useInventoryItems, useInventoryStats,
  useCreateInventoryItemMutation, useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
} from '../api/hooks';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { DataTable, type Column } from '../components/DataTable';
import { ImportModal } from '../components/ImportModal';
import { ExportModal } from '../components/ExportModal';
import type { InventoryItem, DeleteDependencyReport } from '../types';
import { INGREDIENT_UNITS, getUnitLabel } from '../../shared/constants';

type StockStatus = 'all' | 'LOW_STOCK' | 'NORMAL';

export function InventoryManagement() {
  const { isReady, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [stockStatus, setStockStatus] = useState<StockStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data: inventoryResponse, isLoading } = useInventoryItems({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    lowStock: stockStatus === 'LOW_STOCK' || undefined,
  });

  const inventoryItems = inventoryResponse?.data ?? [];
  const pagination = inventoryResponse?.pagination;

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleStockStatus = (status: StockStatus) => {
    setStockStatus(status);
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };
  const { data: stats } = useInventoryStats();
  const createMutation = useCreateInventoryItemMutation();
  const updateMutation = useUpdateInventoryItemMutation();
  const deleteMutation = useDeleteInventoryItemMutation();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    unit: 'KG',
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
      const payload: Record<string, unknown> = {
        name: formData.name,
        unit: formData.unit,
        warningQuantity: formData.warningQuantity === '' ? 0 : Number(formData.warningQuantity),
        price: toNum(formData.price),
        supplier: formData.supplier,
      };
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      } else {
        payload.quantity = 0;
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

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Tên hàng hóa',
      render: (item) => {
        const isLowStock = item.quantity <= item.warningQuantity;
        return (
          <div className="flex items-center gap-2">
            {isLowStock && <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />}
            <div className="font-medium text-foreground">{item.name}</div>
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Số lượng',
      render: (item) => {
        const isLowStock = item.quantity <= item.warningQuantity;
        return (
          <span className={`font-medium ${isLowStock ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
            {item.quantity} {getUnitLabel(item.unit)}
          </span>
        );
      },
    },
    {
      key: 'warning',
      header: 'Ngưỡng cảnh báo',
      className: 'text-muted-foreground',
      render: (item) => <>{item.warningQuantity} {getUnitLabel(item.unit)}</>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (item) => {
        const isLowStock = item.quantity <= item.warningQuantity;
        return isLowStock ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" /> Sắp hết
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
            Bình thường
          </span>
        );
      },
    },
    {
      key: 'price',
      header: 'Đơn giá',
      render: (item) => <>{item.price.toLocaleString()} ₫</>,
    },
    {
      key: 'totalValue',
      header: 'Giá trị',
      className: 'font-medium',
      render: (item) => <>{(item.quantity * item.price).toLocaleString()} ₫</>,
    },
    {
      key: 'supplier',
      header: 'Nhà cung cấp',
      className: 'text-muted-foreground',
      render: (item) => <>{item.supplier}</>,
    },
    {
      key: 'updated',
      header: 'Cập nhật',
      className: 'text-muted-foreground',
      render: (item) => <>{item.lastUpdated}</>,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <>
          {hasPermission('INVENTORY_UPDATE') && (
            <button onClick={() => handleEdit(item)} className="text-primary hover:text-primary/80 mr-3">
              <Edit className="size-3" />
            </button>
          )}
          {hasPermission('INVENTORY_DELETE') && (
            <button onClick={() => handleDelete(item.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
              <Trash2 className="size-3" />
            </button>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Quản lý Tồn kho</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Theo dõi và quản lý hàng tồn kho</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('INVENTORY_IMPORT') && (
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
            >
              <Package className="size-3.5" />
              Nhập kho
            </button>
          )}
          {hasPermission('INVENTORY_EXPORT') && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            >
              <ArrowUpFromLine className="size-3.5" />
              Xuất kho
            </button>
          )}
          {hasPermission('INVENTORY_CREATE') && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-3.5" />
              Thêm hàng hóa
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Tổng mặt hàng</p>
              <p className="text-lg font-bold text-foreground mt-1">{stats?.totalItems ?? inventoryItems.length}</p>
            </div>
            <div className="p-3 bg-accent rounded-lg">
              <TrendingDown className="size-4 text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Cảnh báo tồn thấp</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1">{lowStockCount}</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/50 rounded-lg">
              <AlertTriangle className="size-4 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div>
            <p className="text-xs text-muted-foreground">Tổng giá trị kho</p>
            <p className="text-lg font-bold text-foreground mt-1">{(totalValue / 1000000).toFixed(1)}M ₫</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm hàng hóa, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-input-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => handleStockStatus(stockStatus === 'LOW_STOCK' ? 'all' : 'LOW_STOCK')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              stockStatus === 'LOW_STOCK'
                ? 'bg-orange-600 text-white'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            Sắp hết hàng
          </button>
          <button
            onClick={() => handleStockStatus(stockStatus === 'NORMAL' ? 'all' : 'NORMAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              stockStatus === 'NORMAL'
                ? 'bg-green-600 text-white'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            Bình thường
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={inventoryItems}
        keyExtractor={(item) => item.id}
        loading={isLoading}
        emptyMessage="Không có hàng hóa nào."
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-700">
              <h2 className="text-lg font-bold text-zinc-100">
                {editingItem ? 'Chỉnh sửa hàng hóa' : 'Thêm hàng hóa mới'}
              </h2>
            </div>
            {/* Body */}
            <div className="p-6 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-200 mb-1.5">Tên hàng hóa</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-200 mb-1.5">Đơn vị</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                  >
                    {INGREDIENT_UNITS.map((u) => (
                      <option key={u.value} value={u.value} className="bg-zinc-900">{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-200 mb-1.5">Ngưỡng cảnh báo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.warningQuantity}
                      onChange={(e) => setFormData({ ...formData, warningQuantity: e.target.value })}
                      className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-200 mb-1.5">Đơn giá (₫)</label>
                    <input
                      type="number"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-200 mb-1.5">Nhà cung cấp</label>
                    <input
                      type="text"
                      required
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full h-10 px-3 border border-zinc-700 rounded-lg bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 hover:border-zinc-600 transition-colors"
                    />
                </div>
                {/* Footer */}
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={resetForm} className="flex-1 h-10 px-4 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 text-sm font-medium transition-colors">
                    Hủy
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 h-10 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors">
                    {saving ? 'Đang lưu...' : editingItem ? 'Cập nhật' : 'Thêm mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ImportModal open={showImport} onClose={() => setShowImport(false)} onSuccess={() => {}} />
      <ExportModal open={showExport} onClose={() => setShowExport(false)} onSuccess={() => {}} />
    </div>
  );
}