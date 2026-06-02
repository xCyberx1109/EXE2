import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Button } from '../../app/components/ui/button';
import { Badge } from '../../app/components/ui/badge';
import { Input } from '../../app/components/ui/input';
import { useAuth } from '../../app/context/AuthContext';
import { apiFetch } from '../../app/api/client';
import { ShoppingCart, Plus, Minus, CheckCircle, Table2 } from 'lucide-react';

interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export function WaiterPOS() {
  const { branchInfo } = useAuth();
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const addToCart = (item: MenuItemOption) => {
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

  const handleSubmitOrder = async () => {
    if (!tableNumber || cart.length === 0) return;
    try {
      await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          table: tableNumber,
          items: cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
          orderType: 'DINE_IN',
        }),
        auth: false,
      } as any);
      setCart([]);
      setTableNumber('');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  return (
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

        {/* Menu Search */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Thực đơn</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Tìm món..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-3"
            />
            <p className="text-sm text-gray-400 text-center py-4">
              Tìm và chọn món từ thực đơn
            </p>
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
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
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
              onClick={handleSubmitOrder}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Gọi món
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
