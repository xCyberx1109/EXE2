import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card } from '../../app/components/ui/card';
import { Input } from '../../app/components/ui/input';
import { useAuth } from '../../app/context/AuthContext';
import type { TableItem, MenuItem, CategoryItem } from '../../app/types';
import { tableApi, menuApi, categoryApi, ordersApi } from '../../app/api/services';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Search, Utensils, X } from 'lucide-react';

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export function PosOrderPage() {
  const { hasPermission } = useAuth();
  const canCreateOrder = hasPermission('ORDER_CREATE');
  const canViewOrder = hasPermission('ORDER_VIEW');

  const [tables, setTables] = useState<TableItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const fetchTables = useCallback(async () => {
    try { setTables(await tableApi.listPos()); } catch {}
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const [cats, items] = await Promise.all([
        categoryApi.list(),
        menuApi.list({ available: 'true' }),
      ]);
      setCategories(cats.items ?? []);
      setMenuItems(items);
    } catch {}
  }, []);

  useEffect(() => {
    fetchTables();
    fetchMenu();
  }, [fetchTables, fetchMenu]);

  const handleTableSelect = async (table: TableItem) => {
    setSelectedTable(table);
    setOrderItems([]);
    if (table.currentOrder) {
      try {
        const order = await ordersApi.getActiveByTable(table.id);
        if (order?.items) {
          setOrderItems(order.items.map((i: any) => ({
            menuItemId: i.menuItemId || i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })));
        }
      } catch {}
    }
  };

  const addToOrder = (item: MenuItem) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setOrderItems((prev) =>
      prev.map((i) => (i.menuItemId === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setOrderItems((prev) => prev.filter((i) => i.menuItemId !== id));
  };

  const calculateTotal = () => orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSubmitOrder = async () => {
    if (!selectedTable || orderItems.length === 0) return;
    setOrderSubmitting(true);
    try {
      await ordersApi.createPos({
        table: selectedTable.tableCode,
        tableId: selectedTable.id,
        items: orderItems.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        orderType: 'DINE_IN',
      });
      setSelectedTable(null);
      setOrderItems([]);
      toast.success('Tạo đơn thành công');
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo đơn');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch && item.available;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 border-green-300';
      case 'OCCUPIED': return 'bg-red-100 text-red-800 border-red-300';
      case 'RESERVED': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'CHECKING_OUT': return 'bg-accent text-primary border-primary/30';
      default: return 'bg-muted text-gray-800 border-input';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'Trống';
      case 'OCCUPIED': return 'Có khách';
      case 'RESERVED': return 'Đã đặt';
      case 'CHECKING_OUT': return 'Đang TT';
      default: return status;
    }
  };

  if (!canCreateOrder) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Bạn không có quyền tạo đơn hàng
      </div>
    );
  }

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Tạo đơn hàng</h2>
        {selectedTable && (
          <button onClick={() => { setSelectedTable(null); setOrderItems([]); }}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
            <X className="w-4 h-4" /> Bỏ chọn bàn
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {!selectedTable ? (
            <Card className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Chọn bàn</h3>
              <div className="grid grid-cols-4 gap-2">
                {tables.map((table) => (
                  <button key={table.id} onClick={() => handleTableSelect(table)}
                    disabled={table.status === 'DISABLED'}
                    className={`p-3 rounded-lg border-2 ${getStatusStyle(table.status)}
                      ${table.status === 'DISABLED' ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-md'}`}>
                    <div className="text-center">
                      <div className="text-lg font-bold">Bàn {table.tableCode}</div>
                      <div className="text-xs mt-1">{getStatusText(table.status)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="flex gap-2 flex-wrap mb-3">
                  <button onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'}`}>
                    Tất cả
                  </button>
                  {categories.map((cat) => (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'}`}>
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Tìm món..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredMenuItems.map((item) => (
                    <button key={item.id} onClick={() => addToOrder(item)}
                      className="p-3 bg-muted rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-all text-left">
                      <div className="font-semibold text-foreground mb-1">{item.name}</div>
                      <div className="text-sm text-muted-foreground mb-1">{item.category}</div>
                      <div className="text-primary font-bold">{item.price.toLocaleString()} ₫</div>
                    </button>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Đơn hàng</h3>
              <span className="ml-auto bg-accent text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                {orderItems.reduce((s, i) => s + i.quantity, 0)} món
              </span>
            </div>
            {!selectedTable ? (
              <p className="text-center py-8 text-muted-foreground">Chọn bàn để bắt đầu</p>
            ) : orderItems.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Chưa có món nào</p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto">
                  {orderItems.map((item) => (
                    <div key={item.menuItemId} className="flex items-start gap-2 pb-2 border-b border-border">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.price.toLocaleString()} ₫</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.menuItemId, -1)}
                          className="w-7 h-7 rounded bg-muted hover:bg-accent flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button onClick={() => updateQty(item.menuItemId, 1)}
                          className="w-7 h-7 rounded bg-muted hover:bg-accent flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeItem(item.menuItemId)}
                          className="w-7 h-7 rounded bg-red-50 hover:bg-red-100 flex items-center justify-center ml-1">
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border mb-4">
                  <span>Tổng:</span>
                  <span className="text-primary">{(calculateTotal() * 1.1).toLocaleString()} ₫</span>
                </div>
                <button onClick={handleSubmitOrder} disabled={orderSubmitting}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50">
                  {orderSubmitting ? 'Đang xử lý...' : 'Gọi món'}
                </button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
