import { useState } from 'react';
import {
  Plus, Search, Loader2, FolderTree, RotateCcw, Trash2, Edit3,
} from 'lucide-react';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import {
  useCategoryList, useCreateCategoryMutation,
  useUpdateCategoryMutation, useDeleteCategoryMutation, useRestoreCategoryMutation,
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
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '../components/ui/pagination';
import type { CategoryItem } from '../types';

type FilterTab = 'all' | 'active' | 'inactive' | 'deleted';
type SortField = 'sortOrder' | 'name' | 'createdAt';

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  active: boolean;
}

const emptyForm = (): CategoryForm => ({
  name: '',
  slug: '',
  description: '',
  sortOrder: '0',
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
  const [sort, setSort] = useState<SortField>('sortOrder');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const queryFilters = {
    page,
    limit: PER_PAGE,
    search: debouncedSearch || undefined,
    sort,
    active: filterTab === 'active' ? true : filterTab === 'inactive' ? false : undefined,
    includeDeleted: filterTab === 'all' ? true : undefined,
    deleted: filterTab === 'deleted' ? true : undefined,
  };

  const { data, isLoading, isFetching } = useCategoryList(queryFilters);
  const items = data?.items ?? [];
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
      sortOrder: String(cat.sortOrder),
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
    const sortOrder = parseInt(form.sortOrder, 10);
    if (isNaN(sortOrder) || sortOrder < 0) {
      setFormError('Thứ tự phải là số không âm');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        sortOrder,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
          <Button variant="default" size="sm" onClick={() => { setForm(emptyForm()); setIsDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            Thêm danh mục
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border space-y-4">
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
                <SelectItem value="sortOrder">Thứ tự</SelectItem>
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

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Đang tải...
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {debouncedSearch ? 'Không tìm thấy danh mục phù hợp' : 'Chưa có danh mục nào'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-16">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Slug</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Mô tả</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase w-20">Số món</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase w-24">Trạng thái</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase w-36">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((cat) => {
                  const isDeleted = !!cat.deletedAt;
                  return (
                    <tr key={cat.id} className={`hover:bg-accent/50 transition-colors ${isDeleted ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{cat.sortOrder}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isDeleted ? 'line-through' : ''}`}>{cat.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{cat.slug}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                        {cat.description || '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">{cat.itemCount}</td>
                      <td className="px-4 py-3 text-center">
                        {isDeleted ? (
                          <Badge variant="destructive">Đã xóa</Badge>
                        ) : cat.active ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Hoạt động</Badge>
                        ) : (
                          <Badge variant="secondary">Ẩn</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {pagination && totalPages > 1 && (
          <div className="p-4 border-t border-border">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => goToPage(Math.max(1, page - 1))}
                    className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <span key={p} className="contents">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <PaginationItem>
                          <span className="flex h-9 w-9 items-center justify-center text-sm">...</span>
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          isActive={p === page}
                          onClick={() => goToPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    </span>
                  ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => goToPage(Math.min(totalPages, page + 1))}
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Thứ tự</label>
                <Input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
              <div className="space-y-2 flex items-end pb-2">
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
    </div>
  );
}