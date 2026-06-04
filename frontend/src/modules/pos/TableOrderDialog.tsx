import { useState, useEffect, useCallback, useRef } from 'react';
import { menuApi, ordersApi } from '../../app/api/services';
import type { MenuItem, TableItem, OrderDetail } from '../../app/types';
import { useCategories } from '../../shared/hooks/useCategories';
import { X, Plus, Minus, ShoppingCart, CheckCircle, Utensils, Loader2, AlertCircle } from 'lucide-react';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  table: TableItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function TableOrderDialog({ table, onClose, onSuccess }: Props) {
  const { categories, loading: catsLoading } = useCategories();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingOrder, setExistingOrder] = useState<OrderDetail | null>(null);
  const isCreatingOrder = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const [items] = await Promise.all([
          menuApi.list({ available: 'true' }),
        ]);
        setMenuItems(items);

        // Check if table already has an active order → reuse
        if (table.id) {
          try {
            const active = await ordersApi.getActiveByTable(table.id);
            if (active) {
              setExistingOrder(active);
              // Pre-fill cart with existing order items (only valid menuItemId)
              const existingCartItems: CartItem[] = (active.items || [])
                .filter((item: any) => item.menuItemId)
                .map((item: any) => ({
                  menuItemId: item.menuItemId,
                  name: item.name,
                  price: Number(item.price),
                  quantity: item.quantity,
                }));
              if (existingCartItems.length > 0) {
                setCart(existingCartItems);
              }
            }
          } catch {
            // table has no active order — proceed as new
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [table.id]);

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.menuItemId === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSubmit = useCallback(async () => {
    if (cart.length === 0) return;
    if (isCreatingOrder.current) {
      console.warn('[TableOrderDialog] BLOCKED duplicate create order call');
      return;
    }
    console.log('[TableOrderDialog] CREATE ORDER CALL TRIGGERED');
    isCreatingOrder.current = true;
    setSubmitting(true);

    const payload = {
      table: table.tableCode,
      tableId: table.id,
      items: cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      orderType: 'DINE_IN',
    };

    console.log('CREATE ORDER PAYLOAD', payload);

    try {
      await ordersApi.createPos(payload);
      setCart([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[TableOrderDialog] Create order error:', err);
      alert('Lỗi: ' + (err.message || 'Không thể tạo đơn'));
    } finally {
      isCreatingOrder.current = false;
      setSubmitting(false);
    }
  }, [cart, table, onSuccess, onClose]);

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter((i) => i.categoryId === selectedCategory || i.category === selectedCategory);

  const availableItems = filteredItems.filter((i) => i.available);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <div className="flex flex-col w-full h-full bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Bàn {table.tableCode}</h2>
            {table.tableName && (
              <span className="text-sm text-gray-500">({table.tableName})</span>
            )}
            <span className="text-sm text-gray-400">Sức chứa: {table.capacity} người</span>
            {existingOrder && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Đơn #{existingOrder.orderNumber}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Menu */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category pills */}
            <div className="flex gap-2 px-6 py-3 border-b overflow-x-auto shrink-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Tất cả
              </button>
              {catsLoading ? (
                <div className="flex items-center gap-2 px-4 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải...
                </div>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>

            {/* Menu items grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Đang tải thực đơn...
                </div>
              ) : availableItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Không có món nào
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {availableItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-md active:scale-95 transition-all text-center"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg mb-2"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-gray-300">
                          <Utensils className="w-6 h-6" />
                        </div>
                      )}
                      <span className="text-sm font-semibold text-gray-800 line-clamp-2">
                        {item.name}
                      </span>
                      <span className="text-sm font-bold text-blue-600 mt-1">
                        {item.price.toLocaleString()}₫
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart */}
          <div className="w-80 border-l bg-gray-50 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b bg-white shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Giỏ hàng
                {cart.length > 0 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              {cart.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Chưa chọn món</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.menuItemId}
                      className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.price.toLocaleString()}₫</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => updateQuantity(item.menuItemId, -1)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId, 1)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t bg-white shrink-0 space-y-3">
              <div className="flex justify-between text-base font-bold">
                <span>Tổng cộng</span>
                <span className="text-blue-600">{subtotal.toLocaleString()}₫</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={cart.length === 0 || submitting}
                className="w-full py-3 rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 active:bg-green-800"
              >
                {submitting ? (
                  'Đang xử lý...'
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Gọi món
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
