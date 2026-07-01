import { useState } from 'react';
import {
  Plus, Edit, Trash2, Search, AlertTriangle, TrendingDown, Loader2, ArrowUpCircle, ArrowDownCircle,
  ClipboardCheck, Check, X, CalendarClock, BarChart3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useInventoryItems, useInventoryStats,
  useCreateInventoryItemMutation, useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation, useStockInMutation, useStockOutMutation,
  useAdjustmentRequests, useApproveAdjustmentRequestMutation, useRejectAdjustmentRequestMutation,
  useApprovalThreshold, useUpdateApprovalThresholdMutation, useExpiringBatches,
  useWasteReport, useFoodCostReport,
} from '../api/hooks';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { DataTable, type Column } from '../components/DataTable';
import type { InventoryItem, DeleteDependencyReport } from '../types';
import { INGREDIENT_UNITS, STOCK_IN_TYPES, STOCK_OUT_TYPES, REASON_REQUIRED_STOCK_TYPES } from '../../shared/constants';

type StockDirection = 'IN' | 'OUT';

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
  const stockInMutation = useStockInMutation();
  const stockOutMutation = useStockOutMutation();
  const canApprove = hasPermission('INVENTORY_APPROVE');
  const { data: pendingRequests = [] } = useAdjustmentRequests('PENDING', canApprove);
  const approveMutation = useApproveAdjustmentRequestMutation();
  const rejectMutation = useRejectAdjustmentRequestMutation();
  const { data: thresholdData } = useApprovalThreshold();
  const updateThresholdMutation = useUpdateApprovalThresholdMutation();
  const [showApprovals, setShowApprovals] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: 'KG',
    quantity: '',
    warningQuantity: '',
    price: '',
    supplier: '',
    note: '',
    lastUpdated: new Date().toISOString().split('T')[0],
  });

  const [stockModal, setStockModal] = useState<{ item: InventoryItem; direction: StockDirection } | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: '', type: '', note: '', expiryDate: '', batchCode: '' });
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState('');

  const { data: expiringBatches = [] } = useExpiringBatches(7);
  const [showExpiring, setShowExpiring] = useState(false);

  const canViewReports = hasPermission('REPORT_VIEW');
  const [showReports, setShowReports] = useState(false);
  const { data: wasteReport } = useWasteReport(undefined, undefined, showReports && canViewReports);
  const { data: foodCostReport } = useFoodCostReport(undefined, undefined, showReports && canViewReports);

  const lowStockCount = stats?.lowStockCount ?? inventoryItems.filter(i => i.quantity <= i.warningQuantity).length;
  const totalValue = stats?.totalValue ?? inventoryItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const toNum = (v: string) => v === '' ? 0 : Number(v);
    const newQuantity = toNum(formData.quantity);
    const quantityChanged = !!editingItem && newQuantity !== editingItem.quantity;

    if (quantityChanged && !formData.note.trim()) {
      setFormError('Vui lòng nhập lý do khi thay đổi số lượng tồn kho');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        unit: formData.unit,
        quantity: newQuantity,
        warningQuantity: formData.warningQuantity === '' ? 0 : Number(formData.warningQuantity),
        price: toNum(formData.price),
        supplier: formData.supplier,
      };
      if (editingItem) {
        // Chỉ gửi lý do khi số lượng thực sự thay đổi — backend ghi lại lịch sử
        // điều chỉnh tồn kho (InventoryTransaction type=ADJUST) trong trường hợp này.
        if (quantityChanged) {
          payload.note = formData.note.trim();
        }
        const result = await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
        if (result && typeof result === 'object' && 'pending' in result && result.pending) {
          alert('Đã lưu thông tin. Riêng thay đổi số lượng vượt ngưỡng giá trị nên đang chờ quản lý phê duyệt.');
        }
      } else {
        await createMutation.mutateAsync(payload);
      }
      resetForm();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormError('');
    setFormData({
      name: '',
      unit: 'KG',
      quantity: '',
      warningQuantity: '',
      price: '',
      supplier: '',
      note: '',
      lastUpdated: new Date().toISOString().split('T')[0],
    });
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormError('');
    setFormData({
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      warningQuantity: String(item.warningQuantity),
      price: String(item.price),
      supplier: item.supplier,
      note: '',
      lastUpdated: item.lastUpdated,
    });
    setShowForm(true);
  };

  const openStockModal = (item: InventoryItem, direction: StockDirection) => {
    setStockModal({ item, direction });
    const defaultType = direction === 'IN' ? STOCK_IN_TYPES[0].value : STOCK_OUT_TYPES[0].value;
    setStockForm({ quantity: '', type: defaultType, note: '', expiryDate: '', batchCode: '' });
    setStockError('');
  };

  const closeStockModal = () => {
    setStockModal(null);
    setStockForm({ quantity: '', type: '', note: '', expiryDate: '', batchCode: '' });
    setStockError('');
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal) return;
    setStockError('');

    const quantity = Number(stockForm.quantity);
    if (!quantity || quantity <= 0) {
      setStockError('Số lượng phải lớn hơn 0');
      return;
    }
    if (REASON_REQUIRED_STOCK_TYPES.includes(stockForm.type) && !stockForm.note.trim()) {
      setStockError('Vui lòng nhập lý do cho loại giao dịch này (hao hụt/điều chỉnh)');
      return;
    }

    setStockSaving(true);
    try {
      const result = stockModal.direction === 'IN'
        ? await stockInMutation.mutateAsync({
            id: stockModal.item.id,
            quantity,
            note: stockForm.note.trim() || undefined,
            type: stockForm.type || undefined,
            expiryDate: stockForm.expiryDate || undefined,
            batchCode: stockForm.batchCode.trim() || undefined,
          })
        : await stockOutMutation.mutateAsync({
            id: stockModal.item.id,
            quantity,
            note: stockForm.note.trim() || undefined,
            type: stockForm.type || undefined,
          });
      const isPending = result && typeof result === 'object' && 'pending' in result && result.pending;
      closeStockModal();
      if (isPending) {
        alert('Giá trị giao dịch vượt ngưỡng phê duyệt — đã gửi yêu cầu và đang chờ quản lý duyệt, chưa trừ/cộng kho.');
      }
    } catch (err: unknown) {
      setStockError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setStockSaving(false);
    }
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

  const handleApprove = async (id: string) => {
    if (!confirm('Duyệt yêu cầu này? Kho sẽ được cập nhật ngay sau khi duyệt.')) return;
    try {
      await approveMutation.mutateAsync(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Duyệt yêu cầu thất bại');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    try {
      await rejectMutation.mutateAsync({ id, reason: rejectReason.trim() });
      setRejectingId(null);
      setRejectReason('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Từ chối yêu cầu thất bại');
    }
  };

  const handleSaveThreshold = async () => {
    const value = Number(thresholdInput);
    if (!Number.isFinite(value) || value < 0) {
      alert('Ngưỡng phê duyệt phải là số >= 0');
      return;
    }
    try {
      await updateThresholdMutation.mutateAsync(value);
      setEditingThreshold(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cập nhật ngưỡng thất bại');
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
            {isLowStock && <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />}
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
            {item.quantity} {item.unit}
          </span>
        );
      },
    },
    {
      key: 'warning',
      header: 'Ngưỡng cảnh báo',
      className: 'text-muted-foreground',
      render: (item) => <>{item.warningQuantity} {item.unit}</>,
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
          {hasPermission('INVENTORY_IMPORT') && (
            <button onClick={() => openStockModal(item, 'IN')} title="Nhập kho" className="text-green-600 hover:text-green-700 dark:text-green-400 mr-3">
              <ArrowUpCircle className="w-4 h-4" />
            </button>
          )}
          {hasPermission('INVENTORY_EXPORT') && (
            <button onClick={() => openStockModal(item, 'OUT')} title="Xuất kho" className="text-orange-600 hover:text-orange-700 dark:text-orange-400 mr-3">
              <ArrowDownCircle className="w-4 h-4" />
            </button>
          )}
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
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quản lý Tồn kho</h1>
          <p className="text-muted-foreground mt-1">Theo dõi và quản lý hàng tồn kho</p>
        </div>
        <div className="flex items-center gap-3">
          {canViewReports && (
            <button
              onClick={() => setShowReports(true)}
              className="flex items-center gap-2 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              <BarChart3 className="w-5 h-5" />
              Báo cáo hao hụt
            </button>
          )}
          {hasPermission('INVENTORY_VIEW') && (
            <button
              onClick={() => setShowExpiring(true)}
              className="relative flex items-center gap-2 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              <CalendarClock className="w-5 h-5" />
              Sắp hết hạn
              {expiringBatches.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {expiringBatches.length}
                </span>
              )}
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => {
                setShowApprovals(true);
                setThresholdInput(String(thresholdData?.threshold ?? ''));
              }}
              className="relative flex items-center gap-2 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              <ClipboardCheck className="w-5 h-5" />
              Yêu cầu chờ duyệt
              {pendingRequests.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
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

      <div className="bg-card rounded-lg border border-border p-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm hàng hóa, nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => handleStockStatus(stockStatus === 'LOW_STOCK' ? 'all' : 'LOW_STOCK')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              stockStatus === 'LOW_STOCK'
                ? 'bg-orange-600 text-white'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            Sắp hết hàng
          </button>
          <button
            onClick={() => handleStockStatus(stockStatus === 'NORMAL' ? 'all' : 'NORMAL')}
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
                    {INGREDIENT_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
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
              {editingItem && Number(formData.quantity) !== editingItem.quantity && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Lý do đổi số lượng ({editingItem.quantity} → {formData.quantity || 0} {editingItem.unit}) <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Ví dụ: kiểm kho phát hiện chênh lệch..."
                    className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Bắt buộc nhập lý do để ghi lại lịch sử điều chỉnh tồn kho — dùng cho việc đối soát sau này.
                  </p>
                </div>
              )}
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
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

      {stockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-foreground mb-1">
              {stockModal.direction === 'IN' ? 'Nhập kho' : 'Xuất kho'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {stockModal.item.name} — tồn hiện tại: {stockModal.item.quantity} {stockModal.item.unit}
            </p>
            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Số lượng</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={stockForm.quantity}
                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Loại giao dịch</label>
                  <select
                    value={stockForm.type}
                    onChange={(e) => setStockForm({ ...stockForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                  >
                    {(stockModal.direction === 'IN' ? STOCK_IN_TYPES : STOCK_OUT_TYPES).map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {stockModal.direction === 'IN' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Hạn sử dụng (tùy chọn)</label>
                    <input
                      type="date"
                      value={stockForm.expiryDate}
                      onChange={(e) => setStockForm({ ...stockForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Mã lô (tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="Tự sinh nếu để trống"
                      value={stockForm.batchCode}
                      onChange={(e) => setStockForm({ ...stockForm, batchCode: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Lý do {REASON_REQUIRED_STOCK_TYPES.includes(stockForm.type) && <span className="text-red-600">*</span>}
                </label>
                <textarea
                  rows={2}
                  value={stockForm.note}
                  onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })}
                  placeholder="Ví dụ: hàng hỏng do bảo quản sai cách..."
                  className="w-full px-3 py-2 border border-input rounded-lg bg-input-background"
                />
              </div>
              {stockError && <p className="text-sm text-red-600 dark:text-red-400">{stockError}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeStockModal} className="flex-1 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent">
                  Hủy
                </button>
                <button type="submit" disabled={stockSaving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
                  {stockSaving ? 'Đang lưu...' : stockModal.direction === 'IN' ? 'Nhập kho' : 'Xuất kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showApprovals && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Yêu cầu điều chỉnh/hao hụt chờ duyệt</h2>
              <button onClick={() => setShowApprovals(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-accent/50 rounded-lg p-3 mb-4 flex items-center justify-between text-sm">
              <span className="text-foreground">
                Ngưỡng giá trị cần phê duyệt: {' '}
                {editingThreshold ? (
                  <input
                    type="number"
                    min="0"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    className="inline-block w-32 px-2 py-1 border border-input rounded bg-input-background"
                  />
                ) : (
                  <strong>{(thresholdData?.threshold ?? 0).toLocaleString()} ₫</strong>
                )}
              </span>
              {editingThreshold ? (
                <div className="flex gap-2">
                  <button onClick={handleSaveThreshold} className="text-primary hover:text-primary/80 text-xs font-medium">Lưu</button>
                  <button onClick={() => setEditingThreshold(false)} className="text-muted-foreground hover:text-foreground text-xs">Hủy</button>
                </div>
              ) : (
                <button onClick={() => setEditingThreshold(true)} className="text-primary hover:text-primary/80 text-xs font-medium">
                  Sửa ngưỡng
                </button>
              )}
            </div>

            {pendingRequests.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Không có yêu cầu nào đang chờ duyệt.</p>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {req.ingredientName} — {req.type === 'WASTE' ? 'Hao hụt/hủy hàng' : 'Điều chỉnh'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {req.quantity} {req.ingredientUnit} ({req.beforeQuantity} → {req.afterQuantity}) — giá trị ước tính{' '}
                          <strong className="text-foreground">{req.estimatedValue.toLocaleString()} ₫</strong>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Lý do: {req.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Người yêu cầu: {req.requestedBy?.fullName ?? 'Không rõ'} — {new Date(req.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(req.id)}
                          title="Duyệt"
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                          title="Từ chối"
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {rejectingId === req.id && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Lý do từ chối..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="flex-1 px-3 py-2 border border-input rounded-lg bg-input-background text-sm"
                        />
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={!rejectReason.trim()}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                        >
                          Xác nhận từ chối
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showExpiring && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Lô hàng sắp hết hạn</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Trong vòng 7 ngày tới, sắp xếp theo hạn gần nhất trước.</p>
              </div>
              <button onClick={() => setShowExpiring(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {expiringBatches.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Không có lô hàng nào sắp hết hạn.</p>
            ) : (
              <div className="space-y-3">
                {expiringBatches.map((batch) => {
                  const daysLeft = batch.expiryDate
                    ? Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isUrgent = daysLeft !== null && daysLeft <= 2;
                  return (
                    <div key={batch.id} className="border border-border rounded-lg p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {batch.ingredientName} <span className="text-muted-foreground font-normal">({batch.batchCode})</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Còn lại: {batch.quantity} {batch.ingredientUnit}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isUrgent
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {daysLeft !== null ? `Còn ${daysLeft} ngày` : 'Không rõ hạn'}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('vi-VN') : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showReports && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Báo cáo hao hụt & Food cost</h2>
                <p className="text-sm text-muted-foreground mt-0.5">30 ngày gần nhất</p>
              </div>
              <button onClick={() => setShowReports(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {foodCostReport && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-2">Food cost %</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-accent/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Doanh thu</p>
                    <p className="text-lg font-bold text-foreground">{(foodCostReport.revenue / 1000000).toFixed(1)}M ₫</p>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Định mức (công thức)</p>
                    <p className="text-lg font-bold text-foreground">{foodCostReport.standardCostPercent.toFixed(1)}%</p>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Thực tế</p>
                    <p className={`text-lg font-bold ${
                      foodCostReport.variancePercent > 2 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                    }`}>
                      {foodCostReport.actualCostPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {foodCostReport.variancePercent > 2 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Đang tiêu thụ nguyên liệu nhiều hơn định mức {foodCostReport.variancePercent.toFixed(1)} điểm % — kiểm tra hao hụt/định lượng bếp.
                  </p>
                )}
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Hao hụt theo nguyên liệu {wasteReport && `— tổng ${wasteReport.totalValue.toLocaleString()} ₫`}
              </h3>
              {!wasteReport || wasteReport.byIngredient.length === 0 ? (
                <p className="text-muted-foreground text-sm py-6 text-center">Không có hao hụt nào trong khoảng thời gian này.</p>
              ) : (
                <div className="space-y-2">
                  {wasteReport.byIngredient.map((row) => (
                    <div key={row.ingredientId} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                      <div>
                        <p className="font-medium text-foreground text-sm">{row.ingredientName}</p>
                        <p className="text-xs text-muted-foreground">{row.totalQuantity} {row.ingredientUnit} — {row.transactionCount} lần</p>
                      </div>
                      <p className="font-medium text-red-600 dark:text-red-400 text-sm">{row.totalValue.toLocaleString()} ₫</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}