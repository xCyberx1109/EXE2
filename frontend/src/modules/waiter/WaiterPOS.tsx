import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Button } from '../../app/components/ui/button';
import { Badge } from '../../app/components/ui/badge';
import { Input } from '../../app/components/ui/input';
import { useAuth } from '../../app/context/AuthContext';
import { menuApi } from '../../app/api/services';
import { useCategories } from '../../shared/hooks/useCategories';
import type { MenuItem } from '../../app/types';
import { ShoppingCart, Plus, Minus, CheckCircle, Table2, Utensils, Loader2, AlertCircle, Search } from 'lucide-react';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export function WaiterPOS() {
  const { branchInfo } = useAuth();
  const { categories, loading: catsLoading } = useCategories();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    let mounted = true;
    async function fetchMenu() {
      setMenuLoading(true);
      try {
        const items = await menuApi.list({ available: 'true' });
        if (mounted) setMenuItems(Array.isArray(items) ? items : []);
      } catch {
        if (mounted) setMenuItems([]);
      } finally {
        if (mounted) setMenuLoading(false);
      }
    }
    fetchMenu();
    return () => { mounted = false; };
  }, []);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.menuItemId === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory || item.categoryId === selectedCategory;
    return item.available && matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full overflow-y-auto">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Menu Browser */}
      <div className="lg:col-span-2 space-y-4">
        {/* Table Select */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Table2 className="w-4 h-4" />
              Nhập số bàn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="VD: A1, B2, ..."
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="flex-1"
              />
              {tableNumber && (
                <Badge variant="secondary" className="self-center">
                  Bàn {tableNumber}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Menu */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Thực đơn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Tìm món..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category filter pills */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Tất cả
              </button>
              {catsLoading ? (
                <div className="flex items-center gap-2 px-3 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat.name
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>

            {menuLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Đang tải thực đơn...
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Không có món nào</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-md active:scale-95 transition-all text-center"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded-lg mb-2"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-gray-300">
                        <Utensils className="w-5 h-5" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-gray-800 line-clamp-2">{item.name}</span>
                    <span className="text-xs text-blue-600 font-bold mt-1">{item.price.toLocaleString()}đ</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Cart */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Đơn hàng
              {tableNumber && <Badge>Bàn {tableNumber}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa có món nào</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.menuItemId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.price.toLocaleString()}đ</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold text-base border-t">
                  <span>Tổng</span>
                  <span>{subtotal.toLocaleString()}đ</span>
                </div>
              </div>
            )}

            <Button
              className="w-full mt-4"
              size="lg"
              disabled={!tableNumber || cart.length === 0}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Gọi món
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
