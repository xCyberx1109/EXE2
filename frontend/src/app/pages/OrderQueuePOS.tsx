import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { menuApi, ordersQueueApi, inventoryApi } from '../api/services';
import { MenuItem, OrderDetail, InventoryItem, InventoryIssue } from '../types';
import { APP_NAME } from '../../shared/constants';
import { printReceipt } from '../../shared/utils/printReceipt';
import { queryClient } from '../api/queryClient';
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
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function getShortOrderNumber(order: OrderDetail): string {
  const num = order.orderNumber || '';
  const digits = num.replace(/\D/g, '');
  if (digits) return `#${digits.slice(-4)}`;
  return `#${num.slice(-4)}`;
}

const ORDER_STATUS_BADGE: Record<string, { label: string; cell: string; dot: string }> = {
  PENDING: { label: 'Chờ xử lý', cell: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', dot: '🟡' },
  PREPARING: { label: 'Đang chế biến', cell: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300', dot: '🔵' },
  READY: { label: 'Sẵn sàng', cell: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400', dot: '🟢' },
  OPEN: { label: 'Đang mở', cell: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400', dot: '🟢' },
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
  const { hasPermission, posMachineTemplate } = useAuth();

  // ── Template-based column visibility ──────────────────────────────────────
  // CASHIER        : Menu + Orders (no kitchen)
  // KITCHEN        : Kitchen only (full width)
  // CASHIER_KITCHEN: All 3 columns
  // Others         : All 3 columns (fallback)
  const template = posMachineTemplate ?? 'CASHIER_KITCHEN';

  const showMenuColumn    = template !== 'KITCHEN';
  const showOrdersColumn  = template !== 'KITCHEN';
  const showKitchenColumn = template === 'KITCHEN' || template === 'CASHIER_KITCHEN';

  // Flex ratios per layout
  // 3-col: menu=3 orders=5 kitchen=2  (current)
  // 2-col (CASHIER): menu=35% orders=65%
  // 1-col (KITCHEN): kitchen=100%
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
  const canPayment = hasPermission('POS_ORDER_QUEUE_PAY');

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
      console.log("[schedulePersist] SAVING", scheduledOrderId, `items=${lines.length}`, lines.map(l => `${l.name} x${l.quantity}`).join(', '));
      ordersQueueApi
        .update(scheduledOrderId, payload as any)
        .then(updated => {
          console.log("[schedulePersist] API SUCCESS → setOrders", updated.orderNumber, `items=${updated.items.length}`);
          setOrders(current => current.map(order => (order.id === scheduledOrderId ? updated : order)));
        })
        .catch((e: any) => {
          console.log("[schedulePersist] API ERROR", e.message, "→ loadOrders()");
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
    console.log('[MENU ITEMS STATE]', menuItems);
    const keyword = productSearch.trim().toLowerCase();
    const result = menuItems.filter(item => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword);
      return matchCategory && matchKeyword;
    });
    console.log('[FILTERED MENU ITEMS]', result);
    return result;
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
    return label || `Khách #${order.orderNumber}`;
  }

  const loadOrders = () => {
    console.log("[loadOrders] fetching unpaid orders...");
    setLoading(true);
    setError(null);
    ordersQueueApi
      .list({ paymentStatus: 'UNPAID' })
      .then(data => {
        const openOrders = data.filter(order => OPEN_STATUSES.includes(normalizeStatus(order.status)));
        const sorted = [...openOrders].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        console.log("[loadOrders] got", sorted.length, "orders, IDs:", sorted.map(o => o.id.slice(0, 8)).join(', '));
        setOrders(sorted);
        setActiveOrderId(current => {
          if (current && sorted.some(order => order.id === current)) return current;
          console.log("[loadOrders] activeOrderId changed:", current, "→", sorted[0]?.id || null);
          return sorted[0]?.id || null;
        });
      })
      .catch((e: any) => setError(e.message || 'Không thể tải danh sách order queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const fetchData = () => {
      loadOrders();
      menuApi
        .list({ available: 'true' })
        .then((data) => {
          console.log('[MENU API RESPONSE]', data);
          setMenuItems(data);
        })
        .catch((e) => {
          console.log('[MENU API ERROR]', e);
          setMenuItems([]);
        });
      inventoryApi
        .list()
        .then((inv) => setInventoryItems(Array.isArray(inv) ? inv : []))
        .catch(() => setInventoryItems([]));
    };

    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('pos-refresh', handleRefresh);
    return () => window.removeEventListener('pos-refresh', handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistLabels(labels);
  }, [labels]);

  const prevActiveOrderIdRef = useRef(activeOrderId);

  // Only reset local editing state when user selects a DIFFERENT order,
  // NOT every time activeOrder reference changes (which happens on every
  // optimistic update, API response, etc.). This prevents race conditions
  // where server responses overwrite the user's in-progress edits.
  useEffect(() => {
    if (prevActiveOrderIdRef.current !== activeOrderId) {
      console.log("[ORDER SWITCH]", prevActiveOrderIdRef.current, "→", activeOrderId);
      prevActiveOrderIdRef.current = activeOrderId;
      setOrderLines(toQueueLines(activeOrder));
      setDiscount(Number(activeOrder?.discount || 0));
      setOrderNote((activeOrder as any)?.note || '');
      setInventoryIssues([]);
      setInventoryStatus('VALID');
    }
  }, [activeOrderId, activeOrder]);

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
    const nextTax = 0;
    const total = Math.max(0, subtotal - nextDiscount);

    console.log("[updateLocalOrderFromCart] orderId=", orderId, "lines=", lines.map(l => `${l.name} x${l.quantity}`).join(', '), "total=", total);

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

    console.log("[addProduct]", product.name, `x${1}`, `→ cart:`, nextLines.map(l => `${l.name} x${l.quantity}`).join(', '));

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

    const removed = orderLines.find(l => l.menuItemId === menuItemId && l.quantity + delta <= 0);
    console.log("[changeQuantity]", menuItemId, delta, removed ? `→ REMOVED` : `→ qty changed`);
    console.log("[orderLines]", nextLines.map(l => `${l.name} x${l.quantity}`).join(', '));

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
      queryClient.invalidateQueries({ queryKey: ['orders', 'queue'] });

      printReceipt({
        businessName: APP_NAME,
        invoiceNumber: `#${paidOrder.orderNumber}`,
        checkoutDate: new Date().toISOString(),
        items: paidOrder.items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          total: i.lineTotal,
        })),
        foodTotal: paidOrder.items.reduce((s, i) => s + i.lineTotal, 0),
        serviceCharge: paidOrder.serviceCharge || undefined,
        tax: paidOrder.tax || undefined,
        discount: paidOrder.discount || undefined,
        grandTotal: paidOrder.total,
      });
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
            <h1 className="text-xl lg:text-2xl font-black tracking-tight text-foreground">Điều phối đơn hàng</h1>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {template === 'CASHIER' && 'Thực đơn • Đơn đang mở'}
              {template === 'KITCHEN' && 'Đơn cần làm'}
              {template !== 'CASHIER' && template !== 'KITCHEN' && 'Thực đơn • Đơn đang mở • Điều phối sản xuất'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {canCreate && (
              <button
                onClick={createNewOrder}
                disabled={createLoading}
                className="flex min-h-10 items-center gap-2 rounded-2xl bg-primary px-4 py-2 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-60 text-sm"
              >
                {createLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Đơn mới
              </button>
            )}
          </div>
        </div>
        {error && <div className="mt-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2 text-sm font-medium text-red-700 dark:text-red-400">{error}</div>}
      </div>

      {/* Main content: dynamic column layout based on POS Machine template */}
      <div className="flex-1 flex gap-3 lg:gap-4 overflow-hidden px-3 lg:px-4 pb-3 lg:pb-4">
        {/* Left: Product Menu — CASHIER / CASHIER_KITCHEN only */}
        {showMenuColumn && (
        <section
          className="flex flex-col min-w-0 rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
          style={{ flex: showKitchenColumn ? '3 1 0%' : '0 0 35%' }}
        >
          <div className="shrink-0 p-3 lg:p-4 border-b border-border">
            <div className="flex flex-col gap-2">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-base lg:text-lg font-black text-foreground">
                  <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-primary shrink-0" />
                  <span className="truncate">Thực đơn</span>
                </h2>
                <p className="text-xs lg:text-sm text-muted-foreground truncate">
                  {activeOrder ? `Đang thêm vào ${getCustomerLabel(activeOrder)}` : 'Tạo hoặc chọn đơn để thêm món'}
                </p>
              </div>
              <div className="relative w-full shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Tìm sản phẩm..."
                  className="h-10 w-full rounded-2xl border border-border bg-muted pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-input-background focus:ring-4 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="shrink-0 flex gap-2 overflow-x-auto px-3 lg:px-4 py-2 border-b border-border">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs lg:text-sm font-bold transition whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'border border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              Tất cả
            </button>
            {categories.map(category => (
              <button
                type="button"
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 rounded-2xl px-3 py-1.5 text-xs lg:text-sm font-bold transition whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-slate-900 text-white'
                    : 'border border-border bg-card text-foreground hover:bg-accent'
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
                      className={`group flex flex-col rounded-2xl lg:rounded-3xl border bg-gradient-to-br from-card to-muted p-2 lg:p-4 text-left shadow-sm transition min-h-28 lg:min-h-36 w-full ${
                        outOfStock
                          ? 'opacity-50 grayscale border-border cursor-not-allowed'
                          : 'border-border hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50'
                      }`}
                    >
                      <div className="mb-2 flex h-8 w-8 lg:h-12 lg:w-12 items-center justify-center rounded-xl lg:rounded-2xl bg-accent font-black text-primary text-xs lg:text-base group-hover:bg-primary group-hover:text-primary-foreground">
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-xs lg:text-sm font-black text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</div>
                      <div className="mt-1 text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">{item.category}</div>
                      <div className="mt-auto pt-1 lg:pt-2 text-sm lg:text-lg font-black text-primary">{formatMoney(item.price)}</div>
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
                <div className="col-span-full rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
                  Không có sản phẩm phù hợp.
                </div>
              )}
            </div>
          </div>
        </section>
        )}

        {/* Center: Open Orders — CASHIER / CASHIER_KITCHEN only */}
        {showOrdersColumn && (
        <aside
          className="flex flex-col min-w-0 rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
          style={{ flex: showKitchenColumn ? '5 1 0%' : '0 0 65%' }}
        >
          {/* Fixed header + search */}
          <div className="shrink-0 border-b border-border p-3 lg:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm lg:text-lg font-black text-foreground">Đơn đang mở</h2>
                <p className="text-xs lg:text-sm text-muted-foreground">Cũ nhất • {filteredOrders.length} chưa thanh toán</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 lg:px-3 lg:py-1 text-xs lg:text-sm font-black text-emerald-700 dark:text-emerald-400">UNPAID</span>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                className="h-10 w-full rounded-2xl border border-border bg-muted pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-input-background focus:ring-4 focus:ring-primary/20"
              />
            </div>
            {/* Order tabs - touch-friendly cards */}
            {filteredOrders.length > 0 && (
              <div className="flex flex-row gap-3 overflow-x-auto overflow-y-hidden scrollbar-none">
                {filteredOrders.map(order => {
                  const selected = order.id === activeOrderId;
                  const badge = ORDER_STATUS_BADGE[normalizeStatus(order.status)] || ORDER_STATUS_BADGE.PENDING;
                  const label = getCustomerLabel(order);
                  const displayLabel = label.startsWith('Khách') ? 'Khách' : label;
                  const orderHasIssues = activeOrderId === order.id && hasInventoryIssues;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setActiveOrderId(order.id)}
                      title={`#${order.orderNumber}`}
                      className={`shrink-0 flex flex-col items-start justify-center min-w-[140px] h-16 p-3 rounded-2xl text-left whitespace-nowrap ${
                        selected
                          ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40'
                          : orderHasIssues
                            ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-300 dark:border-red-800'
                            : 'bg-muted text-foreground hover:bg-accent border border-border'
                      }`}
                    >
                      <div className="flex items-center gap-1 w-full">
                        {orderHasIssues ? (
                          <>
                            <span className="text-[10px] leading-none text-red-600 dark:text-red-400">🔴</span>
                            <span className="text-[10px] leading-none font-semibold text-red-600 dark:text-red-400">Vấn đề tồn kho</span>
                          </>
                        ) : (
                          <>
                            <span className={`text-[10px] leading-none ${selected ? 'text-primary-foreground/70' : ''}`}>{badge.dot}</span>
                            <span className={`text-[10px] leading-none font-semibold ${selected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{badge.label}</span>
                          </>
                        )}
                      </div>
                      <span className={`text-xs font-bold leading-tight w-full ${selected ? 'text-primary-foreground' : orderHasIssues ? 'text-red-900 dark:text-red-300' : 'text-foreground'}`}>
                        {displayLabel}
                      </span>
                      <span className={`text-[10px] leading-tight font-medium ${selected ? 'text-primary-foreground/70' : orderHasIssues ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
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
                <div className="shrink-0 mx-3 lg:mx-4 mt-2 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 dark:text-red-400 text-lg leading-none shrink-0 mt-0.5">⚠</span>
                    <div>
                      <p className="text-sm font-bold text-red-800 dark:text-red-300">Vấn đề tồn kho</p>
                      <p className="text-xs text-red-700 dark:text-red-400">
                        {inventoryIssues.length} món trong đơn không thể chế biến do thiếu nguyên liệu.
                        Vui lòng điều chỉnh số lượng hoặc xóa món bị ảnh hưởng.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Needs revalidation warning banner - yellow (only when existing issues need re-check) */}
              {needsRevalidation && hasInventoryIssues && (
                <div className="shrink-0 mx-3 lg:mx-4 mt-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 text-lg leading-none shrink-0 mt-0.5">⚠</span>
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Đơn hàng đã thay đổi</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Đơn hàng đã được sửa. Tồn kho cần kiểm tra lại.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer info - fixed */}
              <div className="shrink-0 px-3 lg:px-4 pt-2 lg:pt-3 pb-1 lg:pb-2 border-b border-border">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm lg:text-base font-black text-foreground truncate">{getCustomerLabel(activeOrder)}</span>
                    <span className="shrink-0 text-[10px] lg:text-xs font-semibold text-muted-foreground" title={`#${activeOrder.orderNumber}`}>{getShortOrderNumber(activeOrder)}</span>
                    {hasInventoryIssues ? (
                      <span className="shrink-0 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] lg:text-xs font-black text-red-700 dark:text-red-400">
                        🔴 VẤN ĐỀ TỒN KHO
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] lg:text-xs font-black text-amber-700 dark:text-amber-400">
                        {(ORDER_STATUS_BADGE[normalizeStatus(activeOrder.status)] || ORDER_STATUS_BADGE.PENDING).dot} {activeOrder.status}
                      </span>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2">
                  <Tag className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-muted-foreground shrink-0" />
                  <input
                    value={labels[activeOrder.id] ?? ''}
                    onChange={e => updateCustomerLabel(activeOrder.id, e.target.value)}
                    placeholder={`Khách ${getShortOrderNumber(activeOrder)}`}
                    className="h-8 lg:h-9 w-full rounded-xl border border-border bg-input-background px-2.5 text-xs lg:text-sm font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20"
                  />
                </label>
              </div>

              {/* Order items - scrollable only section */}
              <div className="flex-1 overflow-y-auto px-3 lg:px-4 py-2 space-y-1.5 lg:space-y-2">
                {orderLines.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs lg:text-sm text-muted-foreground">
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
                        ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="mb-1 lg:mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          {hasIssue && <span className="text-red-600 dark:text-red-400 text-sm leading-none">🔴</span>}
                          <div className="text-xs lg:text-sm font-black text-foreground truncate">{line.name}</div>
                        </div>
                        <div className="text-[10px] lg:text-sm text-muted-foreground">{formatMoney(line.price)} x {line.quantity}</div>
                      </div>
                      <div className="shrink-0 text-xs lg:text-sm font-black text-foreground">{formatMoney(line.price * line.quantity)}</div>
                    </div>
                    {hasIssue && issue && (
                      <div className="mb-1 lg:mb-2 text-[10px] lg:text-xs text-red-700 dark:text-red-400">
                        <div className="font-semibold">Thiếu nguyên liệu:</div>
                        {issue.missingIngredients.map((mi, idx) => (
                          <div key={idx} className="ml-1">• {mi.ingredientName} (cần {mi.required}g, còn {mi.available}g)</div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 lg:gap-2">
                      <button
                        type="button"
                        className="flex h-7 w-7 lg:h-9 lg:w-9 items-center justify-center rounded-lg lg:rounded-xl border border-border bg-muted hover:bg-accent"
                        onClick={() => changeQuantity(line.menuItemId, -1)}
                        aria-label={`Giảm số lượng ${line.name}`}
                      >
                        <Minus className="h-3 w-3 lg:h-4 lg:w-4" />
                      </button>
                      <span className="w-6 lg:w-8 text-center text-sm lg:text-lg font-black">{line.quantity}</span>
                      <button
                        type="button"
                        className="flex h-7 w-7 lg:h-9 lg:w-9 items-center justify-center rounded-lg lg:rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
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
                  className="w-full rounded-xl border border-border bg-input-background px-2.5 py-1.5 text-xs lg:text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20"
                />
              </div>

              {/* Totals - fixed */}
              <div className="shrink-0 px-3 lg:px-4 pb-1">
                <div className="rounded-xl lg:rounded-2xl bg-muted p-2 lg:p-3">
                  <div className="flex justify-between text-sm lg:text-xl font-black">
                    <span>Tổng cộng</span>
                    <span className="text-primary">{formatMoney(payableTotal)}</span>
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
                    className="h-9 lg:min-h-11 rounded-2xl border border-border bg-input-background px-2 text-xs lg:text-sm font-bold"
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="CARD">Thẻ</option>
                    <option value="QR">QR</option>
                  </select>
                  <button
                    type="button"
                    onClick={processPayment}
                    disabled={checkoutLoading || orderLines.length === 0 || !canPayment}
                    className="flex h-9 lg:min-h-11 items-center justify-center gap-1 lg:gap-2 rounded-2xl bg-emerald-600 dark:bg-emerald-700 px-3 text-xs lg:text-sm font-black text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <CreditCard className="h-4 w-4 lg:h-5 lg:w-5" />
                    Thanh toán
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => cancelOrder(activeOrder)}
                  disabled={deleteLoading || !canDelete}
                  className="flex h-9 lg:min-h-11 w-full items-center justify-center gap-1 lg:gap-2 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 text-xs lg:text-sm font-black text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4 lg:h-5 lg:w-5" />
                  Hủy đơn
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
                    className="cursor-pointer rounded-2xl lg:rounded-3xl border border-border bg-card p-3 lg:p-4 transition hover:border-primary/60 hover:bg-accent"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm lg:text-lg font-black text-primary" title={`#${order.orderNumber}`}>{getShortOrderNumber(order)}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs lg:text-sm font-semibold text-muted-foreground">
                          <UserRound className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                          <span className="truncate">{getCustomerLabel(order)}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] lg:text-xs font-black text-amber-700 dark:text-amber-400">
                        {(ORDER_STATUS_BADGE[normalizeStatus(order.status)] || ORDER_STATUS_BADGE.PENDING).dot} {order.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 lg:gap-2 text-xs lg:text-sm">
                      <div className="rounded-xl lg:rounded-2xl bg-muted p-1.5 lg:p-2">
                        <div className="text-muted-foreground text-[10px] lg:text-xs">Món</div>
                        <div className="font-black text-foreground">{order.itemCount || 0}</div>
                      </div>
                      <div className="rounded-xl lg:rounded-2xl bg-muted p-1.5 lg:p-2">
                        <div className="text-muted-foreground text-[10px] lg:text-xs">Tổng</div>
                        <div className="font-black text-foreground text-xs lg:text-sm truncate">{formatMoney(order.total)}</div>
                      </div>
                      <div className="rounded-xl lg:rounded-2xl bg-muted p-1.5 lg:p-2">
                        <div className="text-muted-foreground text-[10px] lg:text-xs">Thời gian</div>
                        <div className="flex items-center gap-1 font-black text-foreground text-xs lg:text-sm">
                          <Clock className="h-3 w-3 lg:h-3.5 lg:w-3.5 shrink-0" />
                          {formatTime(order.createdAt)}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
                  {loading ? 'Đang tải...' : 'Không có đơn mở phù hợp.'}
                </div>
              )}
            </div>
          )}
        </aside>
        )}

        {/* Right: Orders To Make — KITCHEN / CASHIER_KITCHEN only */}
        {showKitchenColumn && (
        <div
          className="flex flex-col"
          style={{ flex: (showMenuColumn || showOrdersColumn) ? '2 1 0%' : '1 1 100%', minWidth: (showMenuColumn || showOrdersColumn) ? '280px' : '0' }}
        >
          <OrdersToMakePanel refreshKey={ordersToMakeRefresh} />
        </div>
        )}
      </div>
    </div>
  );
}
