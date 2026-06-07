import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { menuApi, ordersQueueApi, inventoryApi } from '../api/services';
import { MenuItem, OrderDetail, InventoryItem, InventoryIssue } from '../types';
import { APP_NAME } from '../../shared/constants';
import {
  Clock,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { buildInventoryMap, isItemOutOfStock } from '../../shared/utils/inventoryAvailability';
import { OrdersToMakePanel } from '../components/OrdersToMakePanel';

type QueueLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

type OrderLabelMap = Record<string, string>;

const OPEN_STATUSES = ['PENDING', 'PREPARING', 'OPEN'];
const LABEL_STORAGE_KEY = 'order_queue_customer_labels';

function toQueueLines(order?: OrderDetail | null): QueueLine[] {
  if (!order) return [];
  return order.items
    .map(item => ({
      menuItemId: item.menuItemId || '',
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }))
    .filter(item => item.menuItemId);
}

function normalizeStatus(status?: string) {
  return String(status || '').toUpperCase();
}

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString()}₫`;
}

function formatTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getShortOrderNumber(order: OrderDetail): string {
  const num = order.orderNumber || '';
  const digits = num.replace(/\D/g, '');
  if (digits) return `#${digits.slice(-4)}`;
  return `#${num.slice(-4)}`;
}

const ORDER_STATUS_BADGE: Record<string, { label: string; cell: string; dot: string }> = {
  PENDING: { label: 'Pending', cell: 'bg-amber-100 text-amber-700', dot: '🟡' },
  PREPARING: { label: 'Preparing', cell: 'bg-blue-100 text-blue-700', dot: '🔵' },
  READY: { label: 'Ready', cell: 'bg-emerald-100 text-emerald-700', dot: '🟢' },
  OPEN: { label: 'Open', cell: 'bg-emerald-100 text-emerald-700', dot: '🟢' },
};

function loadStoredLabels(): OrderLabelMap {
  try {
    const raw = localStorage.getItem(LABEL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.reduce<OrderLabelMap>((acc, item) => {
        if (item?.orderId && typeof item.customerLabel === 'string') {
          acc[item.orderId] = item.customerLabel;
        }
        return acc;
      }, {});
    }

    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).reduce<OrderLabelMap>((acc, [orderId, customerLabel]) => {
        if (typeof customerLabel === 'string') acc[orderId] = customerLabel;
        return acc;
      }, {});
    }
  } catch {
    localStorage.removeItem(LABEL_STORAGE_KEY);
  }

  return {};
}

function persistLabels(labels: OrderLabelMap) {
  const rows = Object.entries(labels).map(([orderId, customerLabel]) => ({ orderId, customerLabel }));
  localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(rows));
}

/** Order Queue POS: single-screen cashier workflow for ticket-based open orders */
export function OrderQueuePOS() {
  const { hasPermission } = useAuth();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const persistLoadingRef = useRef(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderLines, setOrderLines] = useState<QueueLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [orderNote, setOrderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [labels, setLabels] = useState<OrderLabelMap>(() => loadStoredLabels());
  const [error, setError] = useState<string | null>(null);
  const [ordersToMakeRefresh, setOrdersToMakeRefresh] = useState(0);
  const [inventoryIssues, setInventoryIssues] = useState<InventoryIssue[]>([]);
  const [inventoryStatus, setInventoryStatus] = useState<'VALID' | 'INVALID' | 'NEEDS_REVALIDATION'>('VALID');

  const affectedMenuItemIds = useMemo(
    () => new Set(inventoryIssues.map(issue => issue.menuItemId)),
    [inventoryIssues]
  );

  const hasInventoryIssues = inventoryIssues.length > 0;
  const isInventoryInvalid = inventoryStatus === 'INVALID';
  const needsRevalidation = inventoryStatus === 'NEEDS_REVALIDATION';

  const inventoryMap = useMemo(() => buildInventoryMap(inventoryItems), [inventoryItems]);

  const canCreate = hasPermission('POS_ORDER_QUEUE_CREATE');
  const canUpdate = hasPermission('POS_ORDER_QUEUE_UPDATE');
  const canDelete = hasPermission('POS_ORDER_QUEUE_DELETE');
  const canPayment = hasPermission('POS_ORDER_QUEUE_PAYMENT');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLinesRef = useRef(orderLines);
  const latestDiscountRef = useRef(discount);
  const latestNoteRef = useRef(orderNote);
  const latestOrderIdRef = useRef(activeOrderId);

  latestLinesRef.current = orderLines;
  latestDiscountRef.current = discount;
  latestNoteRef.current = orderNote;
  latestOrderIdRef.current = activeOrderId;

  const schedulePersist = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const scheduledOrderId = latestOrderIdRef.current;

    debounceTimerRef.current = setTimeout(() => {
      if (!scheduledOrderId || scheduledOrderId !== latestOrderIdRef.current) return;

      const lines = latestLinesRef.current;
      const nextDiscount = latestDiscountRef.current;
      const nextNote = latestNoteRef.current;

      if (!canUpdate) return;

      if (persistLoadingRef.current) return;
      persistLoadingRef.current = true;
      setError(null);
      const payload = {
        items: lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
        discount: nextDiscount,
        note: nextNote,
      };
      ordersQueueApi
        .update(scheduledOrderId, payload as any)
        .then(updated => {
          setOrders(current => current.map(order => (order.id === scheduledOrderId ? updated : order)));
        })
        .catch((e: any) => {
          setError(e.message || 'Không thể lưu order.');
          loadOrders();
        })
        .finally(() => {
          persistLoadingRef.current = false;
        });
    }, 800);
  };

  const activeOrder = useMemo(
    () => orders.find(order => order.id === activeOrderId) || null,
    [orders, activeOrderId]
  );

  const categories = useMemo(() => {
    const unique = Array.from(new Set(menuItems.map(item => item.category).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    return menuItems.filter(item => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword);
      return matchCategory && matchKeyword;
    });
  }, [menuItems, productSearch, selectedCategory]);

  const sortedOpenOrders = useMemo(() => {
    return [...orders]
      .filter(order => OPEN_STATUSES.includes(normalizeStatus(order.status)) && normalizeStatus(order.paymentStatus) !== 'PAID')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const keyword = orderSearch.trim().toLowerCase();
    if (!keyword) return sortedOpenOrders;

    return sortedOpenOrders.filter(order => {
      const label = getCustomerLabel(order).toLowerCase();
      return (
        String(order.orderNumber || '').toLowerCase().includes(keyword) ||
        label.includes(keyword)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedOpenOrders, orderSearch, labels]);

  const lineSubtotal = useMemo(
    () => orderLines.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [orderLines]
  );

  const payableTotal = lineSubtotal;

  function getCustomerLabel(order: OrderDetail) {
    const label = labels[order.id]?.trim();
    return label || `Guest #${order.orderNumber}`;
  }

  const loadOrders = () => {
    setLoading(true);
    setError(null);
    ordersQueueApi
      .list({ paymentStatus: 'UNPAID' })
      .then(data => {
        const openOrders = data.filter(order => OPEN_STATUSES.includes(normalizeStatus(order.status)));
        const sorted = [...openOrders].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        setOrders(sorted);
        setActiveOrderId(current => {
          if (current && sorted.some(order => order.id === current)) return current;
          return sorted[0]?.id || null;
        });
      })
      .catch((e: any) => setError(e.message || 'Không thể tải danh sách order queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
    menuApi
      .list({ available: 'true' })
      .then(setMenuItems)
      .catch(() => setMenuItems([]));
    inventoryApi
      .list()
      .then((inv) => setInventoryItems(Array.isArray(inv) ? inv : []))
      .catch(() => setInventoryItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistLabels(labels);
  }, [labels]);

  useEffect(() => {
    setOrderLines(toQueueLines(activeOrder));
    setDiscount(Number(activeOrder?.discount || 0));
    setOrderNote((activeOrder as any)?.note || '');
    setInventoryIssues([]);
    setInventoryStatus('VALID');
  }, [activeOrder]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        const id = latestOrderIdRef.current;
        const lines = latestLinesRef.current;
        if (id && canUpdate) {
          ordersQueueApi
            .update(id, {
              items: lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
              discount: latestDiscountRef.current,
              note: latestNoteRef.current,
            } as any)
            .catch(() => {});
        }
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const updateLocalOrderFromCart = (orderId: string, lines: QueueLine[], nextDiscount = discount) => {
    const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const nextTax = Math.max(0, Math.round((subtotal - nextDiscount) * 0.1));
    const total = Math.max(0, subtotal - nextDiscount + nextTax);

    setOrders(current =>
      current.map(order =>
        order.id === orderId
          ? {
              ...order,
              items: lines.map((line, index) => ({
                id: `${orderId}-${line.menuItemId}-${index}`,
                menuItemId: line.menuItemId,
                name: line.name,
                price: line.price,
                cost: 0,
                quantity: line.quantity,
                lineTotal: line.price * line.quantity,
              })),
              itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
              subtotal,
              tax: nextTax,
              total,
              discount: nextDiscount,
            }
          : order
      )
    );
  };

  const createNewOrder = async () => {
    if (!canCreate) return;

    console.log("=== CREATE NEW ORDER ===");
    console.log("Cart state (orderLines):", JSON.stringify(orderLines));
    console.log("Active order ID:", activeOrderId);

    setCreateLoading(true);
    setError(null);
    try {
      const payload = { items: [] };
      console.log("QUEUE ORDER PAYLOAD:", JSON.stringify(payload));
      console.log("API endpoint: POST /api/orders/queue");
      const created = await ordersQueueApi.create(payload);
      console.log("ORDER CREATED SUCCESSFULLY:", JSON.stringify(created, null, 2));
      setOrders(current => [created, ...current]);
      setLabels(current => ({ ...current, [created.id]: '' }));
      setActiveOrderId(created.id);
      setOrderSearch('');
      setProductSearch('');
    } catch (e: any) {
      console.error("CREATE ORDER FAILED:", e);
      console.error("Error message:", e.message);
      console.error("Error response:", e.response ? JSON.stringify(e.response) : 'No response');
      setError(e.message || 'Không thể tạo order mới.');
    } finally {
      setCreateLoading(false);
    }
  };

  const addProduct = (product: MenuItem) => {
    if (!activeOrderId) {
      setError('Vui lòng tạo hoặc chọn một order OPEN trước khi thêm món.');
      return;
    }
    if (!canUpdate) return;

    const nextLines = (() => {
      const existing = orderLines.find(line => line.menuItemId === product.id);
      if (existing) {
        return orderLines.map(line =>
          line.menuItemId === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      return [
        ...orderLines,
        {
          menuItemId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    })();

    console.log("=== ADD PRODUCT ===");
    console.log("Product added:", product.name, "ID:", product.id);
    console.log("Updated cart (orderLines):", JSON.stringify(nextLines));
    console.log("Cart item count:", nextLines.length);

    setOrderLines(nextLines);
    updateLocalOrderFromCart(activeOrderId, nextLines);
    setInventoryStatus('NEEDS_REVALIDATION');
    schedulePersist();
  };

  const changeQuantity = (menuItemId: string, delta: number) => {
    if (!activeOrderId || !canUpdate) return;

    const nextLines = orderLines
      .map(line =>
        line.menuItemId === menuItemId
          ? { ...line, quantity: Math.max(0, line.quantity + delta) }
          : line
      )
      .filter(line => line.quantity > 0);

    setOrderLines(nextLines);
    updateLocalOrderFromCart(activeOrderId, nextLines);
    setInventoryStatus('NEEDS_REVALIDATION');
    schedulePersist();
  };

  const updateDiscount = (value: number) => {
    const nextDiscount = Math.max(0, value || 0);
    setDiscount(nextDiscount);
    if (activeOrderId) updateLocalOrderFromCart(activeOrderId, orderLines, nextDiscount);
    schedulePersist();
  };

  const updateCustomerLabel = (orderId: string, value: string) => {
    setLabels(current => ({ ...current, [orderId]: value }));
  };

  const cancelOrder = async (order: OrderDetail) => {
    if (!canDelete) return;
    if (!window.confirm(`Hủy order #${order.orderNumber}? Order sẽ được giữ lịch sử với trạng thái CANCELLED.`)) {
      return;
    }

    setDeleteLoading(true);
    setError(null);
    try {
      await ordersQueueApi.cancel(order.id);
      setOrders(current => current.filter(item => item.id !== order.id));
      setActiveOrderId(current => (current === order.id ? null : current));
    } catch (e: any) {
      setError(e.message || 'Không thể hủy order.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const flushPersist = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      const id = latestOrderIdRef.current;
      const lines = latestLinesRef.current;
      const nextDiscount = latestDiscountRef.current;
      const nextNote = latestNoteRef.current;
      if (id && canUpdate) {
        console.log("[FLUSH PERSIST] Saving via debounce flush, order:", id);
        return ordersQueueApi
          .update(id, {
            items: lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
            discount: nextDiscount,
            note: nextNote,
          } as any)
          .then(updated => {
            console.log("[FLUSH PERSIST] Save successful");
            setOrders(current => current.map(order => (order.id === id ? updated : order)));
          })
          .catch((e: any) => {
            console.log("[FLUSH PERSIST] Save failed:", e.message);
            setError(e.message || 'Không thể lưu order.');
          });
      } else {
        console.log("[FLUSH PERSIST] Skipped — no id or no update permission");
      }
    } else {
      console.log("[FLUSH PERSIST] No pending debounce timer, skipping");
    }
    return Promise.resolve();
  };

  const processPayment = async () => {
    if (!activeOrder || !canPayment) return;
    if (orderLines.length === 0) {
      console.warn("PAYMENT BLOCKED: Cart is empty");
      setError('Order cần có ít nhất 1 món trước khi thanh toán.');
      return;
    }

    // Cancel any pending debounced save to avoid race conditions
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Capture local variables immediately — do NOT rely on React state after async ops
    const orderId = activeOrder.id;
    const method = paymentMethod;
    const lines = orderLines.map(l => ({ ...l }));
    const discountValue = discount;
    const noteValue = orderNote;

    console.log("=== PROCESS PAYMENT (1st click) ===");
    console.log("Order ID:", orderId);
    console.log("Order lines:", JSON.stringify(lines));
    console.log("Payment method:", method);
    console.log("Payable total:", payableTotal);

    setCheckoutLoading(true);
    setError(null);
    try {
      // ALWAYS save cart to backend before payment — do NOT rely on flushPersist debounce timer
      console.log("[STEP 1] Flush persist: saving cart to backend...");
      try {
        const savedOrder = await ordersQueueApi.update(orderId, {
          items: lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
          discount: discountValue,
          note: noteValue,
        } as any);
        console.log("[STEP 1] Flush persist: save completed");
        setOrders(current => current.map(order => (order.id === orderId ? savedOrder : order)));
      } catch (saveErr: any) {
        console.log("[STEP 1] Flush persist: save FAILED — aborting payment", saveErr.message);
        setError(saveErr.message || 'Không thể lưu order trước khi thanh toán.');
        setCheckoutLoading(false);
        return;
      }

      console.log("[STEP 2] Calling pay API...");
      const result = await ordersQueueApi.pay(orderId, method);
      console.log("[STEP 2] Pay API response:", JSON.stringify(result));

      if (result && 'inventoryIssues' in result) {
        console.log("[INVENTORY ISSUES] Blocking payment, issues:", result.inventoryIssues?.length);
        setInventoryStatus('INVALID');
        setInventoryIssues(result.inventoryIssues || []);
        toast.error('Kiểm tra tồn kho thất bại', {
          description: 'Vui lòng điều chỉnh số lượng hoặc xóa món không đủ nguyên liệu.',
        });
        setCheckoutLoading(false);
        return;
      }

      const paidOrder = result as OrderDetail;
      console.log("[PAYMENT SUCCESS] Order completed:", paidOrder.orderNumber);
      setInventoryStatus('VALID');
      setInventoryIssues([]);
      toast.success(`Thanh toán thành công • ${paidOrder.orderNumber}`, {
        description: `${method === 'CASH' ? 'Tiền mặt' : method === 'CARD' ? 'Thẻ' : 'QR'} • ${Number(paidOrder.total).toLocaleString()}₫`,
      });
      setOrders(current => current.filter(order => order.id !== orderId));
      setActiveOrderId(current => (current === orderId ? null : current));
      setOrdersToMakeRefresh(k => k + 1);

      const receipt = [
        `${APP_NAME} Order Queue Receipt`,
        `Order: #${paidOrder.orderNumber}`,
        `Customer: ${getCustomerLabel(activeOrder)}`,
        `Time: ${new Date().toLocaleString()}`,
        `Payment: ${method}`,
        `Items:`,
        ...paidOrder.items.map(item => `- ${item.name} x${item.quantity}: ${item.lineTotal.toLocaleString()}₫`),
        `Total: ${paidOrder.total.toLocaleString()}₫`,
      ].join('\n');

      const receiptWindow = window.open('', '_blank', 'width=420,height=640');
      if (receiptWindow) {
        receiptWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${receipt}</pre>`);
        receiptWindow.document.close();
        receiptWindow.print();
      }
    } catch (e: any) {
      console.log("[PAYMENT ERROR]", e);
      toast.error('Thanh toán thất bại', { description: e.message || 'Không thể thanh toán order.' });
      setError(e.message || 'Không thể thanh toán order.');
    } finally {
      setCheckoutLoading(false);
      console.log("=== PROCESS PAYMENT COMPLETE ===");
    }
  };

  return (
    <div className="h-[94vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 lg:px-4 pt-3 lg:pt-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900">{APP_NAME} Order Queue</h1>
            <p className="text-xs lg:text-sm text-slate-500">Menu • Open Orders • Production Queue</p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
            {canCreate && (
              <button
                onClick={createNewOrder}
                disabled={createLoading}
                className="flex min-h-10 items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-60 text-sm"
              >
                {createLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                New Order
              </button>
            )}
          </div>
        </div>
        {error && <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-sm font-medium text-red-700">{error}</div>}
      </div>

      {/* Main content: 3-column layout */}
      <div className="flex-1 flex gap-3 lg:gap-4 overflow-hidden px-3 lg:px-4 pb-3 lg:pb-4">
        {/* Left: Product Menu (30%) */}
        <section className="flex flex-col lg:flex-[3] min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="shrink-0 p-3 lg:p-4 border-b border-slate-100">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base lg:text-lg font-black text-slate-900">
                  <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600 shrink-0" />
                  <span className="truncate">Product Menu</span>
                </h2>
                <p className="text-xs lg:text-sm text-slate-500 truncate">
                  {activeOrder ? `Adding to ${getCustomerLabel(activeOrder)}` : 'Create or select an order to add products'}
                </p>
              </div>
              <div className="relative w-full lg:max-w-xs shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="shrink-0 flex gap-2 overflow-x-auto px-3 lg:px-4 py-2 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs lg:text-sm font-bold transition whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                type="button"
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs lg:text-sm font-bold transition whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Product grid - scrollable */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4">
            <div className="grid grid-cols-2 gap-2 lg:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
              {filteredMenuItems.map(item => {
                const outOfStock = isItemOutOfStock(item, inventoryMap);
                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={outOfStock ? undefined : () => addProduct(item)}
                      disabled={!activeOrderId || !canUpdate || outOfStock}
                      className={`group flex flex-col rounded-2xl lg:rounded-3xl border bg-gradient-to-br from-white to-slate-50 p-2 lg:p-4 text-left shadow-sm transition min-h-28 lg:min-h-36 w-full ${
                        outOfStock
                          ? 'opacity-50 grayscale border-slate-200 cursor-not-allowed'
                          : 'border-slate-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50'
                      }`}
                    >
                      <div className="mb-2 flex h-8 w-8 lg:h-12 lg:w-12 items-center justify-center rounded-xl lg:rounded-2xl bg-blue-50 font-black text-blue-700 text-xs lg:text-base group-hover:bg-blue-600 group-hover:text-white">
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-xs lg:text-sm font-black text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</div>
                      <div className="mt-1 text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-slate-400 truncate">{item.category}</div>
                      <div className="mt-auto pt-1 lg:pt-2 text-sm lg:text-lg font-black text-blue-700">{formatMoney(item.price)}</div>
                    </button>
                    {outOfStock && (
                      <div className="absolute inset-0 flex items-start justify-center pt-2 lg:pt-3 pointer-events-none">
                        <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow">
                          Hết nguyên liệu
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredMenuItems.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 text-sm">
                  Không có sản phẩm phù hợp.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Center: Open Orders (50%) */}
        <aside className="flex flex-col lg:flex-[5] min-w-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Fixed header + search */}
          <div className="shrink-0 border-b border-slate-100 p-3 lg:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm lg:text-lg font-black text-slate-900">Open Orders</h2>
                <p className="text-xs lg:text-sm text-slate-500">Oldest first • {filteredOrders.length} unpaid</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 lg:px-3 lg:py-1 text-xs lg:text-sm font-black text-emerald-700">UNPAID</span>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                placeholder="Search..."
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
            {/* Order tabs - touch-friendly cards */}
            {filteredOrders.length > 0 && (
              <div className="flex flex-row gap-3 overflow-x-auto overflow-y-hidden scrollbar-none">
                {filteredOrders.map(order => {
                  const selected = order.id === activeOrderId;
                  const badge = ORDER_STATUS_BADGE[normalizeStatus(order.status)] || ORDER_STATUS_BADGE.PENDING;
                  const label = getCustomerLabel(order);
                  const displayLabel = label.startsWith('Guest') ? 'Guest' : label;
                  const orderHasIssues = activeOrderId === order.id && hasInventoryIssues;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setActiveOrderId(order.id)}
                      title={`#${order.orderNumber}`}
                      className={`shrink-0 flex flex-col items-start justify-center min-w-[140px] h-16 p-3 rounded-2xl text-left whitespace-nowrap ${
                        selected
                          ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                          : orderHasIssues
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-300'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 w-full">
                        {orderHasIssues ? (
                          <>
                            <span className="text-[10px] leading-none text-red-600">🔴</span>
                            <span className="text-[10px] leading-none font-semibold text-red-600">Inventory Issue</span>
                          </>
                        ) : (
                          <>
                            <span className={`text-[10px] leading-none ${selected ? 'text-blue-200' : ''}`}>{badge.dot}</span>
                            <span className={`text-[10px] leading-none font-semibold ${selected ? 'text-blue-200' : 'text-slate-500'}`}>{badge.label}</span>
                          </>
                        )}
                      </div>
                      <span className={`text-xs font-bold leading-tight w-full ${selected ? 'text-white' : orderHasIssues ? 'text-red-900' : 'text-slate-900'}`}>
                        {displayLabel}
                      </span>
                      <span className={`text-[10px] leading-tight font-medium ${selected ? 'text-blue-200' : orderHasIssues ? 'text-red-500' : 'text-slate-500'}`}>
                        {getShortOrderNumber(order)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active order detail section */}
          {activeOrderId && activeOrder ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Inventory issue warning banner - red for INVALID */}
              {isInventoryInvalid && (
                <div className="shrink-0 mx-3 lg:mx-4 mt-2 rounded-xl border border-red-300 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 text-lg leading-none shrink-0 mt-0.5">⚠</span>
                    <div>
                      <p className="text-sm font-bold text-red-800">Inventory Issue</p>
                      <p className="text-xs text-red-700">
                        {inventoryIssues.length} items in this order cannot be prepared due to insufficient ingredients.
                        Please adjust quantities or remove affected items.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Needs revalidation warning banner - yellow (only when existing issues need re-check) */}
              {needsRevalidation && hasInventoryIssues && (
                <div className="shrink-0 mx-3 lg:mx-4 mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 text-lg leading-none shrink-0 mt-0.5">⚠</span>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Order Changed</p>
                      <p className="text-xs text-amber-700">
                        Order modified. Inventory needs revalidation.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer info - fixed */}
              <div className="shrink-0 px-3 lg:px-4 pt-2 lg:pt-3 pb-1 lg:pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserRound className="h-4 w-4 text-slate-500 shrink-0" />
                    <span className="text-sm lg:text-base font-black text-slate-900 truncate">{getCustomerLabel(activeOrder)}</span>
                    <span className="shrink-0 text-[10px] lg:text-xs font-semibold text-slate-400" title={`#${activeOrder.orderNumber}`}>{getShortOrderNumber(activeOrder)}</span>
                    {hasInventoryIssues ? (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] lg:text-xs font-black text-red-700">
                        🔴 INVENTORY ISSUE
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] lg:text-xs font-black text-amber-700">
                        {(ORDER_STATUS_BADGE[normalizeStatus(activeOrder.status)] || ORDER_STATUS_BADGE.PENDING).dot} {activeOrder.status}
                      </span>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <Tag className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-slate-400 shrink-0" />
                  <input
                    value={labels[activeOrder.id] ?? ''}
                    onChange={e => updateCustomerLabel(activeOrder.id, e.target.value)}
                    placeholder={`Guest ${getShortOrderNumber(activeOrder)}`}
                    className="h-8 lg:h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs lg:text-sm font-bold outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              {/* Order items - scrollable only section */}
              <div className="flex-1 overflow-y-auto px-3 lg:px-4 py-2 space-y-1.5 lg:space-y-2">
                {orderLines.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-xs lg:text-sm text-slate-500">
                    Chưa có món. Chọn sản phẩm ở menu bên trái.
                  </div>
                )}
                {orderLines.map(line => {
                  const issue = inventoryIssues.find(i => i.menuItemId === line.menuItemId);
                  const hasIssue = !!issue;
                  return (
                  <div
                    key={line.menuItemId}
                    className={`rounded-xl lg:rounded-2xl border p-2 lg:p-3 ${
                      hasIssue
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="mb-1 lg:mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          {hasIssue && <span className="text-red-600 text-sm leading-none">🔴</span>}
                          <div className="text-xs lg:text-sm font-black text-slate-900 truncate">{line.name}</div>
                        </div>
                        <div className="text-[10px] lg:text-sm text-slate-500">{formatMoney(line.price)} x {line.quantity}</div>
                      </div>
                      <div className="shrink-0 text-xs lg:text-sm font-black text-slate-900">{formatMoney(line.price * line.quantity)}</div>
                    </div>
                    {hasIssue && issue && (
                      <div className="mb-1 lg:mb-2 text-[10px] lg:text-xs text-red-700">
                        <div className="font-semibold">Thiếu nguyên liệu:</div>
                        {issue.missingIngredients.map((mi, idx) => (
                          <div key={idx} className="ml-1">• {mi.ingredientName} (cần {mi.required}g, còn {mi.available}g)</div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 lg:gap-2">
                      <button
                        type="button"
                        className="flex h-7 w-7 lg:h-9 lg:w-9 items-center justify-center rounded-lg lg:rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100"
                        onClick={() => changeQuantity(line.menuItemId, -1)}
                        aria-label={`Giảm số lượng ${line.name}`}
                      >
                        <Minus className="h-3 w-3 lg:h-4 lg:w-4" />
                      </button>
                      <span className="w-6 lg:w-8 text-center text-sm lg:text-lg font-black">{line.quantity}</span>
                      <button
                        type="button"
                        className="flex h-7 w-7 lg:h-9 lg:w-9 items-center justify-center rounded-lg lg:rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => changeQuantity(line.menuItemId, 1)}
                        aria-label={`Tăng số lượng ${line.name}`}
                      >
                        <Plus className="h-3 w-3 lg:h-4 lg:w-4" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Notes - fixed */}
              <div className="shrink-0 px-3 lg:px-4 pb-1">
                <textarea
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  onBlur={() => flushPersist()}
                  placeholder="Ghi chú order..."
                  rows={1}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs lg:text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {/* Totals - fixed */}
              <div className="shrink-0 px-3 lg:px-4 pb-1">
                <div className="rounded-xl lg:rounded-2xl bg-slate-50 p-2 lg:p-3">
                  <div className="flex justify-between text-sm lg:text-xl font-black">
                    <span>Total</span>
                    <span className="text-blue-700">{formatMoney(payableTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Payment + actions - fixed */}
              <div className="shrink-0 px-3 lg:px-4 pb-3 lg:pb-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Phương thức thanh toán"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="h-9 lg:min-h-11 rounded-2xl border border-slate-200 bg-white px-2 text-xs lg:text-sm font-bold"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="QR">QR</option>
                  </select>
                  <button
                    type="button"
                    onClick={processPayment}
                    disabled={checkoutLoading || orderLines.length === 0 || !canPayment}
                    className="flex h-9 lg:min-h-11 items-center justify-center gap-1 lg:gap-2 rounded-2xl bg-emerald-600 px-3 text-xs lg:text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CreditCard className="h-4 w-4 lg:h-5 lg:w-5" />
                    Checkout
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => cancelOrder(activeOrder)}
                  disabled={deleteLoading || !canDelete}
                  className="flex h-9 lg:min-h-11 w-full items-center justify-center gap-1 lg:gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-xs lg:text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4 lg:h-5 lg:w-5" />
                  Cancel Order
                </button>
              </div>
            </div>
          ) : (
            /* No active order - show order list for selection */
            <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2 lg:space-y-3">
              {filteredOrders.length > 0 ? (
                filteredOrders.map(order => (
                  <article
                    key={order.id}
                    onClick={() => setActiveOrderId(order.id)}
                    className="cursor-pointer rounded-2xl lg:rounded-3xl border border-slate-200 bg-white p-3 lg:p-4 transition hover:border-blue-300 hover:bg-slate-50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm lg:text-lg font-black text-blue-700" title={`#${order.orderNumber}`}>{getShortOrderNumber(order)}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs lg:text-sm font-semibold text-slate-600">
                          <UserRound className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                          <span className="truncate">{getCustomerLabel(order)}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] lg:text-xs font-black text-amber-700">
                        {(ORDER_STATUS_BADGE[normalizeStatus(order.status)] || ORDER_STATUS_BADGE.PENDING).dot} {order.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 lg:gap-2 text-xs lg:text-sm">
                      <div className="rounded-xl lg:rounded-2xl bg-slate-50 p-1.5 lg:p-2">
                        <div className="text-slate-400 text-[10px] lg:text-xs">Items</div>
                        <div className="font-black text-slate-900">{order.itemCount || 0}</div>
                      </div>
                      <div className="rounded-xl lg:rounded-2xl bg-slate-50 p-1.5 lg:p-2">
                        <div className="text-slate-400 text-[10px] lg:text-xs">Total</div>
                        <div className="font-black text-slate-900 text-xs lg:text-sm truncate">{formatMoney(order.total)}</div>
                      </div>
                      <div className="rounded-xl lg:rounded-2xl bg-slate-50 p-1.5 lg:p-2">
                        <div className="text-slate-400 text-[10px] lg:text-xs">Time</div>
                        <div className="flex items-center gap-1 font-black text-slate-900 text-xs lg:text-sm">
                          <Clock className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0" />
                          {formatTime(order.createdAt)}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-slate-500 text-sm">
                  {loading ? 'Đang tải...' : 'Không có OPEN order phù hợp.'}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right: Orders To Make (20%) */}
        <div className="lg:flex-[2] min-w-[280px] flex flex-col">
          <OrdersToMakePanel refreshKey={ordersToMakeRefresh} />
        </div>
      </div>
    </div>
  );
}