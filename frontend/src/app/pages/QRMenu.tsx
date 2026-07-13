import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTheme } from 'next-themes';
import {
  BadgeInfo,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Minus,
  Moon,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Sun,
  Trash2,
  X,
} from 'lucide-react';

import {
  qrMenuApi,
  type QrCurrentOrder,
} from '../api/services';
import type { MenuItem } from '../types';

type CartItem = MenuItem & {
  quantity: number;
};

type TableInfo = {
  id: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
};

const formatCurrency = (value: number) =>
  `${value.toLocaleString('vi-VN')} ₫`;

const ORDER_STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: {
    label: 'Đang chờ xác nhận',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  PENDING_PAYMENT: {
    label: 'Chờ thanh toán',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  PREPARING: {
    label: 'Đang chế biến',
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  },
  READY: {
    label: 'Sẵn sàng phục vụ',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  SERVED: {
    label: 'Đã phục vụ',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  COMPLETED: {
    label: 'Đã hoàn tất',
    className:
      'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  CANCELLED: {
    label: 'Đã hủy',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
  REFUNDED: {
    label: 'Đã hoàn tiền',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
};

const getOrderStatusInfo = (status: string) =>
  ORDER_STATUS_LABELS[status] ?? {
    label: status,
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

const cartStorageKey = (token: string) => `qr-menu-cart:${token}`;

const readStoredCart = (token: string): CartItem[] => {
  if (!token) return [];

  try {
    const raw = window.sessionStorage.getItem(cartStorageKey(token));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function MenuQR() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [currentOrder, setCurrentOrder] =
    useState<QrCurrentOrder | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => readStoredCart(token));
  const [searchTerm, setSearchTerm] = useState('');

  const [showCart, setShowCart] = useState(false);
  const [showOrderedItems, setShowOrderedItems] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

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

        if (cancelled) return;

        setTableInfo(response.table);
        setMenuItems(
          Array.isArray(response.menuItems)
            ? response.menuItems.filter(
                (item) => item.available !== false,
              )
            : [],
        );
        setCurrentOrder(response.currentOrder ?? null);
      } catch (error) {
        if (cancelled) return;

        console.error('Load QR menu error:', error);
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Không thể tải menu. Vui lòng quét lại mã QR.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMenu();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    try {
      if (cart.length === 0) {
        window.sessionStorage.removeItem(cartStorageKey(token));
      } else {
        window.sessionStorage.setItem(
          cartStorageKey(token),
          JSON.stringify(cart),
        );
      }
    } catch {
      // sessionStorage có thể bị chặn; giỏ hàng vẫn hoạt động trong phiên hiện tại.
    }
  }, [cart, token]);

  const filteredMenuItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return menuItems;

    return menuItems.filter((item) =>
      `${item.name} ${item.description ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [menuItems, searchTerm]);

  const totalQuantity = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const totalPrice = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
      ),
    [cart],
  );

  const orderedQuantity = useMemo(
    () =>
      currentOrder?.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      ) ?? 0,
    [currentOrder],
  );

  const orderedTotal = Number(
    currentOrder?.grandTotal ?? currentOrder?.foodTotal ?? 0,
  );

  const tableDisplayName =
    tableInfo?.tableName?.trim() || tableInfo?.tableCode || 'Bàn';

  const addOneToCart = (item: MenuItem) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) => cartItem.id === item.id,
      );

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }

      return [...currentCart, { ...item, quantity: 1 }];
    });
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
    if (!token || cart.length === 0 || submitting) {
      return;
    }

    try {
      setSubmitting(true);

      const response = await qrMenuApi.submit(token, {
        guestCount: 1,
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
      });

      setCurrentOrder(response.order);
      setCart([]);
      setShowCart(false);
      setShowSuccess(true);
      setShowOrderedItems(true);

      window.setTimeout(() => {
        setShowSuccess(false);
      }, 4000);
    } catch (error) {
      console.error('Submit QR order error:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Không thể gửi order. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="text-center">
          <img
            src="/Logo.png"
            alt="POSitive"
            className="mx-auto mb-5 h-12 w-auto object-contain dark:brightness-110"
          />

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-800 dark:border-t-blue-400" />

          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Đang tải thực đơn...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <img
            src="/Logo.png"
            alt="POSitive"
            className="mx-auto mb-5 h-10 w-auto object-contain dark:brightness-110"
          />

          <div className="mb-3 text-4xl">⚠️</div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Không thể mở thực đơn
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto overscroll-y-contain bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto max-w-lg px-4 py-3 sm:max-w-2xl lg:max-w-5xl lg:px-6 xl:max-w-6xl">
          <div className="flex items-center gap-3 lg:gap-6">
            <img
              src="/Logo.png"
              alt="POSitive"
              className="h-9 w-auto shrink-0 object-contain dark:brightness-110"
            />

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm món ăn, thức uống..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="hidden shrink-0 text-right lg:block">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {tableDisplayName}
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Chọn món và nhấn “Xong” để gửi đến nhân viên
              </p>
            </div>

            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={
                isDark
                  ? 'Chuyển sang giao diện sáng'
                  : 'Chuyển sang giao diện tối'
              }
              title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="mt-2 text-center lg:hidden">
            <h1 className="font-bold text-slate-900 dark:text-slate-100">
              {tableDisplayName}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Chọn món và nhấn “Xong” để gửi đến nhân viên
            </p>
          </div>
        </div>
      </header>

      <main
        className="
          mx-auto max-w-lg px-3 pt-3
          pb-[calc(10rem+env(safe-area-inset-bottom))]
          sm:max-w-2xl
          lg:max-w-5xl lg:px-6 lg:pt-4 lg:pb-[calc(3rem+env(safe-area-inset-bottom))]
          xl:max-w-6xl
        "
      >
        <section className="mb-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/40">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60">
            <BadgeInfo className="h-5 w-5 text-amber-700 dark:text-amber-400" />
          </div>

          <div>
            <h2 className="font-bold text-amber-950 dark:text-amber-200">
              Hướng dẫn thanh toán
            </h2>
            <p className="mt-1 text-sm leading-5 text-amber-800 dark:text-amber-300">
              Sau khi dùng món, quý khách vui lòng ra quầy thu ngân để
              thanh toán và thông báo mã bàn cho nhân viên.
            </p>
          </div>
        </section>

        {showSuccess && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                Đã gửi order thành công
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Nhân viên đã nhận được món của bạn.
              </p>
            </div>
          </div>
        )}

        {currentOrder?.items?.length ? (
          <section className="mb-4 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/40">
            <button
              type="button"
              onClick={() =>
                setShowOrderedItems((current) => !current)
              }
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/60">
                  <ReceiptText className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-emerald-950 dark:text-emerald-200">
                      Món đã gọi
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        getOrderStatusInfo(currentOrder.status).className
                      }`}
                    >
                      {getOrderStatusInfo(currentOrder.status).label}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {orderedQuantity} món · {formatCurrency(orderedTotal)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="max-w-28 truncate text-[10px] text-emerald-700 dark:text-emerald-300">
                  {currentOrder.orderNumber}
                </span>

                {showOrderedItems ? (
                  <ChevronUp className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                )}
              </div>
            </button>

            {showOrderedItems && (
              <div className="border-t border-emerald-200 px-3 pb-3 pt-3 dark:border-emerald-800/60">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm dark:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {formatCurrency(Number(item.price))} × {item.quantity}
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(Number(item.lineTotal))}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-emerald-200 px-1 pt-3 dark:border-emerald-800/60">
                  <span className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                    Tổng đã gọi
                  </span>
                  <span className="font-bold text-emerald-950 dark:text-emerald-200">
                    {formatCurrency(orderedTotal)}
                  </span>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <div className="mb-3 flex items-end justify-between px-1">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 lg:text-xl">
              Thực đơn
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chạm vào món để thêm vào giỏ hàng
            </p>
          </div>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
            {filteredMenuItems.length} món
          </span>
        </div>

        {menuItems.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="font-medium text-slate-700 dark:text-slate-300">
              Hiện chưa có món nào khả dụng
            </p>
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="font-medium text-slate-700 dark:text-slate-300">
              Không tìm thấy món phù hợp với “{searchTerm}”
            </p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400"
            >
              Xóa tìm kiếm
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMenuItems.map((item) => {
              const cartItem = cart.find(
                (entry) => entry.id === item.id,
              );
              const quantity = cartItem?.quantity ?? 0;

              return (
                <article
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-amber-50 text-4xl font-bold text-orange-500 dark:from-orange-950 dark:to-amber-950 dark:text-orange-400">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {quantity > 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                        Đã chọn {quantity}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-1 font-bold text-slate-900 dark:text-slate-100">
                      {item.name}
                    </h3>

                    {item.description && (
                      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="whitespace-nowrap text-base font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(Number(item.price))}
                      </p>

                      {quantity === 0 ? (
                        <button
                          type="button"
                          onClick={() => addOneToCart(item)}
                          aria-label={`Thêm ${item.name}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition active:scale-95 dark:bg-blue-500"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => decreaseCartItem(item.id)}
                            aria-label={`Giảm số lượng ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm active:scale-95 dark:bg-slate-700 dark:text-slate-100"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>

                          <span className="w-4 text-center text-sm font-bold text-slate-900 dark:text-slate-100">
                            {quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => increaseCartItem(item.id)}
                            aria-label={`Tăng số lượng ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm active:scale-95 dark:bg-blue-500"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {cart.length > 0 && (
        <div
          className="
            fixed inset-x-3 z-40
            bottom-[calc(0.75rem+env(safe-area-inset-bottom))]
            sm:left-1/2 sm:right-auto sm:w-[calc(100%-1.5rem)] sm:max-w-lg sm:-translate-x-1/2
            lg:left-auto lg:right-6 lg:w-96 lg:translate-x-0
          "
        >
          <button
            type="button"
            onClick={() => setShowCart(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-emerald-600 px-4 py-3.5 text-white shadow-[0_10px_35px_rgba(5,150,105,0.35)] transition active:scale-[0.99] dark:bg-emerald-500"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-emerald-700">
                  {totalQuantity}
                </span>
              </div>

              <div className="text-left">
                <p className="text-sm font-bold">Xem order</p>
                <p className="text-xs text-emerald-100">
                  {totalQuantity} món đã chọn
                </p>
              </div>
            </div>

            <p className="text-lg font-bold">
              {formatCurrency(totalPrice)}
            </p>
          </button>
        </div>
      )}

      {showCart && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm lg:items-stretch lg:justify-end"
          onClick={() => setShowCart(false)}
        >
          <div
            className="
              mx-auto flex max-h-[88dvh] w-full max-w-lg
              flex-col overflow-hidden rounded-t-3xl bg-white
              dark:bg-slate-900
              lg:mx-0 lg:h-full lg:max-h-full lg:w-[420px] lg:rounded-none lg:rounded-l-3xl
            "
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 lg:hidden" />

            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Order mới
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tableDisplayName} · {totalQuantity} món
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCart(false)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                Đóng
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(Number(item.price))} / món
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="rounded-xl bg-red-50 p-2 text-red-500 dark:bg-red-950/50 dark:text-red-400"
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
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 dark:text-slate-100"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="w-7 text-center font-bold text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => increaseCartItem(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 dark:text-slate-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(Number(item.price) * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="
                shrink-0 border-t border-slate-200 bg-white p-4
                dark:border-slate-800 dark:bg-slate-900
                pb-[calc(1rem+env(safe-area-inset-bottom))]
              "
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tổng cộng
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {totalQuantity} món
                  </p>
                </div>

                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalPrice)}
                </p>
              </div>

              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting || cart.length === 0}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-4 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500"
              >
                {submitting
                  ? 'Đang gửi order...'
                  : 'Xong – Gửi món đến nhân viên'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}