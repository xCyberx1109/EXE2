import { useState } from 'react';
import {
  Plus, Search, FolderTree, RotateCcw, Trash2, Edit3, Eye, X, UtensilsCrossed, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import {
  useCategoryList, useCreateCategoryMutation,
  useUpdateCategoryMutation, useDeleteCategoryMutation, useRestoreCategoryMutation,
  useCategoryStats, useCategory,
} from '../api/hooks';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { DataTable, type Column } from '../components/DataTable';
import type { CategoryItem } from '../types';

type FilterTab = 'all' | 'active' | 'inactive' | 'deleted';
type SortField = 'name' | 'createdAt';

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

const emptyForm = (): CategoryForm => ({
  name: '',
  slug: '',
  description: '',
  active: true,
});

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'active', label: 'Hoạt động' },
  { key: 'inactive', label: 'Ẩn' },
  { key: 'deleted', label: 'Đã xóa' },
];

const PER_PAGE = 20;

export function CategoryManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('CATEGORY_CREATE');
  const canUpdate = hasPermission('CATEGORY_UPDATE');
  const canDelete = hasPermission('CATEGORY_DELETE');

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [sort, setSort] = useState<SortField>('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PER_PAGE);
  const debouncedSearch = useDebounce(search, 300);

  const queryFilters = {
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    sort,
    active: filterTab === 'active' ? true : filterTab === 'inactive' ? false : undefined,
    includeDeleted: filterTab === 'all' ? true : undefined,
    deleted: filterTab === 'deleted' ? true : undefined,
  };

  const { data, isLoading, isFetching } = useCategoryList(queryFilters);
  const items = data?.data ?? [];
  const pagination = data?.pagination;

  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();
  const restoreMutation = useRestoreCategoryMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: stats } = useCategoryStats();
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const { data: viewingCategory, isLoading: viewingLoading } = useCategory(viewingId);

  const isEditing = !!editing;

  const resetForm = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (cat: CategoryItem) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      active: cat.active,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Tên danh mục là bắt buộc');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        active: form.active,
      };

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || 'Lỗi khi lưu danh mục');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi xóa danh mục');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreMutation.mutateAsync(id);
    } catch (err: any) {
      alert(err?.message || 'Lỗi khi khôi phục danh mục');
    }
  };

  const handleTabChange = (tab: FilterTab) => {
    setFilterTab(tab);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSort(value as SortField);
    setPage(1);
  };

  const goToPage = (p: number) => {
    setPage(p);
  };

  const totalPages = pagination?.totalPages ?? 1;

  const columns: Column<CategoryItem>[] = [
    {
      key: 'name',
      header: 'Tên danh mục',
      render: (cat) => (
        <span className={`font-medium ${cat.deletedAt ? 'line-through opacity-60' : ''}`}>
          {cat.name}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      className: 'text-muted-foreground max-w-[200px] truncate',
      render: (cat) => cat.description || '\u2014',
    },
    {
      key: 'status',
      header: 'Trạng thái',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (cat) => {
        if (cat.deletedAt) {
          return <Badge variant="destructive">Đã xóa</Badge>;
        }
        return cat.active
          ? <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Hoạt động</Badge>
          : <Badge variant="secondary">Ẩn</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (cat) => {
        const isDeleted = !!cat.deletedAt;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewingId(cat.id)}
              title="Xem chi tiết"
            >
              <Eye className="w-4 h-4" />
            </Button>
            {isDeleted ? (
              canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestore(cat.id)}
                  title="Khôi phục"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )
            ) : (
              <>
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(cat)}
                    title="Sửa"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(cat)}
                    disabled={cat.itemCount > 0}
                    title={cat.itemCount > 0 ? 'Không thể xóa danh mục đang có món ăn' : 'Xóa'}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <FolderTree className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quản lý danh mục</h1>
            <p className="text-sm text-muted-foreground mt-1">Quản lý danh mục món ăn toàn hệ thống</p>
          </div>
        </div>
        {canCreate && (
          <Button variant="default" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Thêm danh mục
          </Button>
        )}
      </div>

      {stats && (
        <div className="bg-card rounded-xl border border-border p-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Tổng danh mục</p>
                <p className="text-lg font-bold text-foreground">
                  {stats.totalCategories}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({stats.totalActiveCategories} đang hoạt động)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tổng số món trong menu</p>
                <p className="text-lg font-bold text-foreground">{stats.totalItems}</p>
              </div>
            </div>
            {stats.byCategory.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStatsExpanded((v) => !v)}
              >
                Phân bổ theo danh mục
                {statsExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </Button>
            )}
          </div>

          {statsExpanded && stats.byCategory.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 mt-3 pt-3 border-t border-border">
              {stats.byCategory.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm text-foreground" title={c.name}>
                    {c.name}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm text-muted-foreground">
                    {c.itemCount} món ({c.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-4 space-y-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên hoặc slug..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Tên A-Z</SelectItem>
              <SelectItem value="createdAt">Ngày tạo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={items} keyExtractor={(item) => item.id} loading={isLoading} emptyMessage="Chưa có danh mục nào." pagination={pagination} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Cập nhật danh mục' : 'Thêm danh mục'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Chỉnh sửa thông tin danh mục' : 'Tạo danh mục mới trong hệ thống'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tên danh mục *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Đồ uống"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="Để trống để tự động sinh từ tên"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Mô tả (không bắt buộc)"
              />
            </div>
            <div className="flex items-center pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium">Hoạt động</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={resetForm}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Thêm danh mục'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa danh mục</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa danh mục <strong>{deleteTarget?.name}</strong>?
              Danh mục sẽ được xóa tạm thời và có thể khôi phục sau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Detail */}
      <Dialog open={!!viewingId} onOpenChange={(open) => { if (!open) setViewingId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết danh mục</DialogTitle>
            <DialogDescription>Thông tin đầy đủ và danh sách món ăn thuộc danh mục này</DialogDescription>
          </DialogHeader>

          {viewingLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Đang tải...</p>
          ) : !viewingCategory ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Không tìm thấy danh mục.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{viewingCategory.name}</h3>
                  {viewingCategory.deletedAt ? (
                    <Badge variant="destructive">Đã xóa</Badge>
                  ) : viewingCategory.active ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Hoạt động</Badge>
                  ) : (
                    <Badge variant="secondary">Ẩn</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Slug: {viewingCategory.slug}</p>
              </div>

              {viewingCategory.description && (
                <p className="text-sm text-foreground">{viewingCategory.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Ngày tạo</p>
                  <p className="text-foreground">{new Date(viewingCategory.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cập nhật gần nhất</p>
                  <p className="text-foreground">{new Date(viewingCategory.updatedAt).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Món ăn thuộc danh mục này ({viewingCategory.menuItems.length})
                  </p>
                </div>
                {viewingCategory.menuItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có món ăn nào thuộc danh mục này.</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {viewingCategory.menuItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border text-sm">
                        <span className="text-foreground">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{item.price.toLocaleString()} ₫</span>
                          {!item.available && <Badge variant="secondary" className="text-xs">Ngừng bán</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setViewingId(null)}>
                  <X className="w-4 h-4 mr-1" />
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}