import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Button } from '../../app/components/ui/button';
import { Badge } from '../../app/components/ui/badge';
import { Input } from '../../app/components/ui/input';
import { useAuth } from '../../app/context/AuthContext';
import { ShoppingCart, Plus, Minus, QrCode, Search, CheckCircle, ArrowLeft } from 'lucide-react';

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export function KioskPOS() {
  const { branchInfo } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [step, setStep] = useState<'menu' | 'cart' | 'payment'>('menu');
  const [searchQuery, setSearchQuery] = useState('');

  const addToCart = (item: { id: string; name: string; price: number }) => {
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

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setStep('payment');
  };

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">{branchInfo?.name || 'Hệ thống tự đặt món'}</h1>
        <p className="text-gray-500">Vui lòng chọn món và tiến hành thanh toán</p>
      </div>

      {step === 'menu' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Thực đơn</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Tìm món..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <p className="text-sm text-gray-400 text-center py-8">
                  Chọn món từ thực đơn để thêm vào giỏ
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cart sidebar */}
          <div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Giỏ hàng
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Giỏ hàng trống</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.menuItemId} className="flex items-center justify-between py-1 border-b last:border-0">
                        <div className="flex-1 text-sm min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.price.toLocaleString()}đ</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQuantity(item.menuItemId, -1)} className="p-1 hover:bg-gray-100 rounded">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.menuItemId, 1)} className="p-1 hover:bg-gray-100 rounded">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 font-bold">
                      <span>Tổng</span>
                      <span>{subtotal.toLocaleString()}đ</span>
                    </div>
                    <Button className="w-full mt-3" size="lg" onClick={() => setStep('cart')}>
                      Tiếp tục
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 'cart' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Xác nhận đơn hàng</span>
              <Button variant="ghost" size="sm" onClick={() => setStep('menu')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Họ tên (không bắt buộc)</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nhập tên của bạn" />
            </div>
            <div>
              <label className="text-sm font-medium">Số điện thoại (không bắt buộc)</label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Nhập số điện thoại" />
            </div>
                <div className="border-t pt-4">
                  {cart.map((item) => (
                    <div key={item.menuItemId} className="flex justify-between text-sm py-1">
                      <span className="truncate">x{item.quantity} {item.name}</span>
                  <span>{(item.price * item.quantity).toLocaleString()}đ</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                <span>Tổng cộng</span>
                <span>{subtotal.toLocaleString()}đ</span>
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={handleSubmit}>
              Tiến hành thanh toán
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'payment' && (
        <div className="text-center py-12">
          <div className="max-w-sm mx-auto space-y-4">
            <QrCode className="w-32 h-32 mx-auto text-blue-600" />
            <h2 className="text-xl font-bold">Quét mã QR để thanh toán</h2>
            <p className="text-gray-500">
              Số tiền: <span className="font-bold text-lg">{subtotal.toLocaleString()}đ</span>
            </p>
            <Badge variant="secondary" className="text-sm py-1 px-3">
              Chờ thanh toán...
            </Badge>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
