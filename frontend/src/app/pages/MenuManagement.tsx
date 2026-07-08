import { useEffect, useRef, useState } from 'react';
import { Plus, Edit, Trash2, Search, Loader2, X, Sparkles, ImagePlus, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  useMenuItems,
  useTopSellingMenuItems,
  useInventoryItems,
  useCreateMenuItemMutation,
  useUpdateMenuItemMutation,
  useToggleMenuItemAvailabilityMutation,
  useDeleteMenuItemMutation,
} from '../api/hooks';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { DataTable, type Column } from '../components/DataTable';
import type { MenuItem } from '../types';

type RecipeRow = {
  ingredientId: string;
  amount: string;
};

const emptyRecipeRow: RecipeRow = { ingredientId: '', amount: '' };
const AI_IMAGE_URL = import.meta.env.VITE_AI_IMAGE_URL || 'http://localhost:8000';

export function MenuManagement() {
  const { isReady, hasPermission } = useAuth();
  const canViewRecipe = hasPermission('INVENTORY_VIEW');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const { data: menuResponse, isLoading } = useMenuItems({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
  });
  const { data: topSelling = [] } = useTopSellingMenuItems();
  const { data: ingredientsResponse } = useInventoryItems();

  const menuItems = menuResponse?.data ?? [];
  const pagination = menuResponse?.pagination;
  const ingredients = ingredientsResponse?.data ?? [];

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const createMutation = useCreateMenuItemMutation();
  const updateMutation = useUpdateMenuItemMutation();
  const toggleMutation = useToggleMenuItemAvailabilityMutation();
  const deleteMutation = useDeleteMenuItemMutation();

  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([{ ...emptyRecipeRow }]);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost: '',
    description: '',
    imageUrl: '',
    available: true,
  });

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
      throw new Error('Vui long chon nguyen lieu cho tat ca dong cong thuc');
    }

    if (validRows.some((row) => Number(row.amount) <= 0)) {
      throw new Error('So luong nguyen lieu phai lon hon 0');
    }

    if (new Set(selectedIds).size !== selectedIds.length) {
      throw new Error('Khong duoc chon trung nguyen lieu trong cung mot mon');
    }

    return validRows;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!formData.name.trim()) {
        throw new Error('Ten mon la bat buoc');
      }
      const priceVal = Number(formData.price);
      const costVal = Number(formData.cost);
      if (formData.price === '' || Number.isNaN(priceVal)) {
        throw new Error('Gia ban la bat buoc va phai la so hop le');
      }
      if (formData.cost === '' || Number.isNaN(costVal)) {
        throw new Error('Gia von la bat buoc va phai la so hop le');
      }
      if (priceVal < 0) throw new Error('Gia ban khong duoc am');
      if (costVal < 0) throw new Error('Gia von khong duoc am');

      const recipeIngredients = canViewRecipe
        ? validateRecipeRows().map((row) => ({
            ingredientId: row.ingredientId,
            amount: Number(row.amount),
          }))
        : [];

      const payload = {
        name: formData.name.trim(),
        price: priceVal,
        cost: costVal,
        description: formData.description,
        imageUrl: formData.imageUrl || null,
        available: formData.available,
        ...(canViewRecipe ? { ingredients: recipeIngredients } : {}),
      };

      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      resetForm();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Luu that bai');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData({
      name: '',
      price: '',
      cost: '',
      description: '',
      imageUrl: '',
      available: true,
    });
    setRecipeRows([{ ...emptyRecipeRow }]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: String(item.price),
      cost: String(item.cost),
      description: item.description,
      imageUrl: item.imageUrl || '',
      available: item.available,
    });
    setRecipeRows(
      canViewRecipe && item.ingredients?.length
        ? item.ingredients.map((row) => ({
            ingredientId: row.ingredient?.id ?? row.ingredientId ?? '',
            amount: String(row.amount ?? 0),
          }))
        : [{ ...emptyRecipeRow }]
    );
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ban co chac muon xoa mon an nay?')) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Xoa that bai');
    }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cap nhat that bai');
    }
  };

  const handleGenerateImage = async () => {
    if (!formData.name.trim()) {
      alert('Vui long nhap ten mon truoc khi tao anh');
      return;
    }

    setGeneratingImage(true);
    try {
      const response = await fetch(`${AI_IMAGE_URL}/generate-menu-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || formData.name.trim(),
          category: 'Mon chinh',
          style: 'realistic',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.imageUrl) {
        const detail = typeof result?.detail === 'string' ? result.detail : result?.message;
        throw new Error(detail || 'Khong the tao anh AI');
      }

      setFormData((prev) => ({ ...prev, imageUrl: result.imageUrl }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Khong the tao anh AI');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const uploadBody = new FormData();
      uploadBody.append('file', file);

      const response = await fetch(`${AI_IMAGE_URL}/upload-menu-image`, {
        method: 'POST',
        body: uploadBody,
      });

      const result = await response.json();
      if (!response.ok || !result?.imageUrl) {
        const detail = typeof result?.detail === 'string' ? result.detail : result?.message;
        throw new Error(detail || 'Khong the tai anh len');
      }

      setFormData((prev) => ({ ...prev, imageUrl: result.imageUrl }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Khong the tai anh len');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const columns: Column<MenuItem>[] = [
    {
      key: 'name',
      header: 'Ten mon',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-md bg-muted flex-shrink-0">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No img</div>
            )}
          </div>
          <div>
            <div className="font-medium text-foreground">{item.name}</div>
            <div className="text-xs text-muted-foreground">{item.description}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'recipe',
      header: 'Cong thuc',
      className: 'text-muted-foreground',
      render: (item) =>
        item.ingredients?.length ? (
          <div className="space-y-1">
            {item.ingredients.slice(0, 3).map((row) => (
              <div key={row.id} className="text-muted-foreground">
                {row.ingredient?.name || 'Nguyen lieu'}:{' '}
                <span className="font-medium">
                  {Number(row.amount).toLocaleString()} {row.ingredient?.unit || ''}
                </span>
              </div>
            ))}
            {item.ingredients.length > 3 && (
              <div className="text-xs text-muted-foreground">+{item.ingredients.length - 3} nguyen lieu</div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">Chua co</span>
        ),
    },
    {
      key: 'price',
      header: 'Gia ban',
      className: 'font-medium',
      render: (item) => <>{item.price.toLocaleString()} d</>,
    },
    {
      key: 'cost',
      header: 'Gia von',
      render: (item) => <>{item.cost.toLocaleString()} d</>,
    },
    {
      key: 'profit',
      header: 'Loi nhuan',
      render: (item) => {
        const profit = item.price - item.cost;
        const profitMargin = item.price > 0 ? ((profit / item.price) * 100).toFixed(1) : '0';
        return (
          <>
            <div className="text-green-600 font-medium">{profit.toLocaleString()} d</div>
            <div className="text-xs text-muted-foreground">{profitMargin}%</div>
          </>
        );
      },
    },
    {
      key: 'status',
      header: 'Trang thai',
      render: (item) => (
        <button
          onClick={() => handleToggleAvailability(item.id)}
          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${item.available ? 'bg-green-100 text-green-800' : 'bg-muted text-foreground'}`}
        >
          {item.available ? 'Kha dung' : 'Ngung ban'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tac',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <>
          <button onClick={() => handleEdit(item)} className="text-primary hover:text-primary/80 mr-3">
            <Edit className="size-3" />
          </button>
          <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">
            <Trash2 className="size-3" />
          </button>
        </>
      ),
    },
  ];

  useEffect(() => {
    if (menuResponse?.pagination && page > menuResponse.pagination.totalPages && menuResponse.pagination.totalPages > 0) {
      setPage(menuResponse.pagination.totalPages);
    }
  }, [menuResponse?.pagination, page]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Quan ly Menu</h1>
          <p className="text-muted-foreground mt-1">Quan ly danh sach mon an va thuc uong</p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-1.5 px-2 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-xs font-medium"
        >
          <Plus className="size-3.5" />
          Them mon moi
        </button>
      </div>

      <div className="bg-card rounded-md border border-border p-3 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tim kiem mon an..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap"></div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        loading={isLoading || !isReady}
        emptyMessage="Khong co mon an nao."
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full p-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-3">{editingItem ? 'Chinh sua mon an' : 'Them mon an moi'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-0.5">Ten mon</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2 py-1.5 border border-input rounded-md bg-input-background text-xs text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-0.5">Gia ban (d)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-2 py-1.5 border border-input rounded-md bg-input-background text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-0.5">Gia von (d)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-2 py-1.5 border border-input rounded-md bg-input-background text-xs text-foreground"
                  />
                </div>
              </div>

              {canViewRecipe && (
                <div className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between flex-shrink-0">
                    <div>
                      <label className="block text-xs font-medium">Cong thuc nguyen lieu</label>
                      <p className="text-xs text-muted-foreground mt-0.5">Nhap so luong nguyen lieu can dung cho 1 phan mon</p>
                    </div>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs bg-accent text-primary rounded-md hover:bg-accent"
                    >
                      <Plus className="size-3.5" />
                      Them dong
                    </button>
                  </div>

                  {recipeRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-12 gap-1.5 items-start">
                      <div className="col-span-7">
                        <select
                          value={row.ingredientId}
                          onChange={(e) => updateRecipeRow(index, { ingredientId: e.target.value })}
                          className="w-full px-2 py-1.5 border border-input rounded-md text-xs bg-input-background text-foreground"
                        >
                          <option value="">-- Chon nguyen lieu --</option>
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
                          placeholder="So luong"
                          className="w-full px-2 py-1.5 border border-input rounded-md text-xs pr-12 bg-input-background text-foreground"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeRecipeRow(index)}
                          className="p-2 text-muted-foreground hover:text-destructive"
                          title="Xoa dong"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-0.5">Mo ta</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-2 py-1.5 border border-input rounded-md bg-input-background text-xs text-foreground"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium mb-0.5">Anh mon an</label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadImage(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-input-background px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {uploadingImage ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      Tai anh len
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateImage}
                      disabled={generatingImage}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {generatingImage ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Tao anh AI
                    </button>
                  </div>
                </div>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="URL anh se duoc dien sau khi tao hoac tai len"
                  className="w-full px-2 py-1.5 border border-input rounded-md bg-input-background text-xs text-foreground"
                />
                {formData.imageUrl ? (
                  <div className="overflow-hidden rounded-md border border-border">
                    <img
                      src={formData.imageUrl}
                      alt={formData.name || 'preview'}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ImagePlus className="size-3.5" />
                    Chua co anh. Bam Tai anh len hoac Tao anh AI.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="available"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="size-3.5"
                />
                <label htmlFor="available" className="text-xs">Mon an kha dung</label>
              </div>

              <div className="flex gap-2 pt-3">
                <button type="button" onClick={resetForm} className="flex-1 px-3 py-1.5 border border-input rounded-md bg-input-background text-xs">
                  Huy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-2 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50"
                >
                  {saving ? 'Dang luu...' : editingItem ? 'Cap nhat' : 'Them moi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
