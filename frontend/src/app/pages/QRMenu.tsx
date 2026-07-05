import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';

import { qrMenuApi } from '../api/services';
import type { MenuItem } from '../types';

type CartItem = MenuItem & {
  quantity: number;
};

type TableInfo = {
  id?: string;
  tableCode: string;
  tableName: string | null;
  capacity?: number;
};

export function MenuQR() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';

  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [showCart, setShowCart] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const loadMenu = async () => {
      if (!token) {
        setLoadError('Mã QR không hợp lệ hoặc bị thiếu.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError('');

        const response = await qrMenuApi.resolve(token);

        setTableInfo(response.table);
        setMenuItems(
          Array.isArray(response.menuItems)
            ? response.menuItems.filter((item) => item.available !== false)
            : [],
        );
      } catch (error) {
        console.error('Load QR menu error:', error);

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Không thể tải menu. Vui lòng quét lại mã QR.',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadMenu();
  }, [token]);

  const totalQuantity = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const totalPrice = useMemo(
    () => cart.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    ),
    [cart],
  );

  const tableDisplayName =
    tableInfo?.tableName?.trim() ||
    tableInfo?.tableCode ||
    'Bàn';

  const openItem = (itemId: string) => {
    setOpenItemId((currentId) => {
      if (currentId === itemId) {
        return null;
      }

      return itemId;
    });

    setSelectedQuantity(1);
  };

  const addToCart = (item: MenuItem) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) => cartItem.id === item.id,
      );

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + selectedQuantity,
              }
            : cartItem,
        );
      }

      return [
        ...currentCart,
        {
          ...item,
          quantity: selectedQuantity,
        },
      ];
    });

    setOpenItemId(null);
    setSelectedQuantity(1);
  };

  const increaseCartItem = (itemId: string) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === itemId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    );
  };

  const decreaseCartItem = (itemId: string) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeCartItem = (itemId: string) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== itemId),
    );
  };

  const submitOrder = async () => {
    if (!token) {
      alert('Mã QR không hợp lệ.');
      return;
    }

    if (cart.length === 0) {
      alert('Vui lòng chọn ít nhất một món.');
      return;
    }

    try {
      setIsSubmitting(true);

      await qrMenuApi.submit(token, {
        guestCount: 1,
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
      });

      setCart([]);
      setShowCart(false);
      setOpenItemId(null);
      setSubmitted(true);
    } catch (error) {
      console.error('Submit QR order error:', error);

      alert(
        error instanceof Error
          ? error.message
          : 'Không thể gửi order. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto border-4 border-gray-200 border-t-black rounded-full animate-spin" />

          <p className="mt-4 text-sm text-gray-600">
            Đang tải menu...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border rounded-2xl p-6 text-center shadow-sm">
          <div className="text-4xl mb-3">⚠️</div>

          <h1 className="text-xl font-bold text-gray-900">
            Không thể mở menu
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full mt-5 rounded-xl bg-black px-4 py-3 font-semibold text-white"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border rounded-2xl p-6 text-center shadow-sm">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />

          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Đã gửi order
          </h1>

          <p className="mt-2 text-gray-500">
            Order của {tableDisplayName} đã được gửi đến quán.
          </p>

          <p className="mt-1 text-sm text-gray-400">
            Nhân viên sẽ chuẩn bị món cho bạn.
          </p>

          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="w-full mt-6 rounded-xl bg-black px-4 py-3 font-semibold text-white"
          >
            Gọi thêm món
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-center text-gray-900">
            Menu – {tableDisplayName}
          </h1>

          <p className="mt-1 text-xs text-center text-gray-500">
            Chọn món, kiểm tra order và nhấn “Xong”
          </p>
        </div>
      </header>

      <main className="max-w-md mx-auto p-3">
        {menuItems.length === 0 ? (
          <div className="mt-10 rounded-xl border bg-white p-6 text-center">
            <p className="font-medium text-gray-700">
              Hiện chưa có món nào khả dụng
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Vui lòng liên hệ nhân viên để được hỗ trợ.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {menuItems.map((item) => {
              const isOpen = openItemId === item.id;
              const cartItem = cart.find(
                (cartEntry) => cartEntry.id === item.id,
              );

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-xl border bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => openItem(item.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-gray-900">
                            {item.name}
                          </h2>

                          {cartItem && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                              {cartItem.quantity}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          {item.category || 'Chưa phân loại'}
                        </p>

                        {item.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="whitespace-nowrap font-bold text-blue-600">
                        {Number(item.price).toLocaleString('vi-VN')} ₫
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="mb-4 flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedQuantity((current) =>
                              Math.max(1, current - 1),
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-full border bg-white"
                          aria-label="Giảm số lượng"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <span className="w-12 text-center text-xl font-bold">
                          {selectedQuantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedQuantity((current) => current + 1)
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-full border bg-white"
                          aria-label="Tăng số lượng"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white active:bg-blue-700"
                      >
                        Thêm {selectedQuantity} món
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Thanh giỏ hàng dưới màn hình */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="fixed bottom-0 left-0 right-0 z-30 bg-green-600 text-white shadow-lg"
        >
          <div className="max-w-md mx-auto flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />

              <span className="font-semibold">
                {totalQuantity} món
              </span>
            </div>

            <div className="text-right">
              <div className="font-bold">
                {totalPrice.toLocaleString('vi-VN')} ₫
              </div>

              <div className="text-xs text-green-100">
                Xem order
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Popup giỏ hàng */}
      {showCart && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/50"
          onClick={() => setShowCart(false)}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Order của bạn
                </h2>

                <p className="text-xs text-gray-500">
                  {tableDisplayName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCart(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3 p-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {item.name}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {Number(item.price).toLocaleString('vi-VN')} ₫ / món
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="rounded-lg p-2 text-red-500"
                      aria-label={`Xóa ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => decreaseCartItem(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border"
                        aria-label="Giảm số lượng"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="w-8 text-center font-bold">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => increaseCartItem(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border"
                        aria-label="Tăng số lượng"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="font-bold text-gray-900">
                      {(
                        Number(item.price) * item.quantity
                      ).toLocaleString('vi-VN')}{' '}
                      ₫
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 border-t bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Tổng cộng
                  </p>

                  <p className="text-xs text-gray-400">
                    {totalQuantity} món
                  </p>
                </div>

                <div className="text-xl font-bold text-gray-900">
                  {totalPrice.toLocaleString('vi-VN')} ₫
                </div>
              </div>

              <button
                type="button"
                onClick={submitOrder}
                disabled={isSubmitting || cart.length === 0}
                className="w-full rounded-xl bg-green-600 px-4 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Đang gửi order...' : 'Xong'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}