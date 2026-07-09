import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { menuApi, ordersQueueApi, inventoryApi, paymentApi } from '../api/services';
import { MenuItem, OrderDetail, InventoryItem, InventoryIssue } from '../types';
import { APP_NAME } from '../../shared/constants';
import { printReceipt, openReceiptWindow } from '../../shared/utils/printReceipt';
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
import { InvoicePaymentModal } from '../../shared/components/InvoicePaymentModal';
import type { BankAccountInfo } from '../../shared/utils/printReceipt';

type QueueLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
};

type OrderLabelMap = Record<string, string>;

const OPEN_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'OPEN', 'PENDING_PAYMENT'];
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
  const { hasPermission } = useAuth();

  const showMenuColumn = hasPermission('POS_ORDER_QUEUE_CREATE');
  const showOrdersColumn = hasPermission('POS_ORDER_QUEUE_VIEW');
  const showKitchenColumn = hasPermission('ORDER_VIEW');
  const isKitchenMode = showKitchenColumn && !showMenuColumn;
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    orderId: string; amount: number; paymentContent: string; bankAccounts: BankAccountInfo[]; orderNumber?: string;
  } | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'CASH' | 'BANKING' | 'CARD' | 'TRANSFER'>('CASH');

  const pendingLinesRef = useRef<QueueLine[]>([]);
  const pendingDiscountRef = useRef(0);
  const pendingNoteRef = useRef('');
  const pendingOrderNumberRef = useRef('');
  const pendingBankAccountsRef = useRef<BankAccountInfo[]>([]);
  const pendingPaymentContentRef = useRef('');

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

      if (!canUpdate) {
        setError('Bạn không có quyền thêm món vào đơn hàng');
        return;
      }

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
  const activeOrderPaid = normalizeStatus(activeOrder?.paymentStatus) === 'PAID';

  const filteredMenuItems = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    const result = menuItems.filter(item => {
      const matchKeyword =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword);
      return matchKeyword;
    });
    return result;
  }, [menuItems, productSearch]);

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
    setLoading(true);
    setError(null);
    ordersQueueApi
      .list()
      .then(data => {
        const openOrders = (Array.isArray(data) ? data : []).filter(order => OPEN_STATUSES.includes(normalizeStatus(order.status)) && normalizeStatus(order.paymentStatus) !== 'PAID');
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
    const fetchData = () => {
      loadOrders();
      menuApi
        .list({ available: 'true' })
        .then((data) => {
          setMenuItems(Array.isArray(data) ? data : []);
        })
        .catch((e) => {
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
            .catch(() => { });
        }
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const updateLocalOrderFromCart = (orderId: string, lines: QueueLine[], nextDiscount = discount) => {
    const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const nextTax = 0;
    const total = Math.max(0, subtotal - nextDiscount);

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

    setCreateLoading(true);
    setError(null);
    try {
      const payload = { items: [] };
      const created = await ordersQueueApi.create(payload);
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
    if (!canUpdate) {
      setError('Bạn không có quyền thêm món vào đơn hàng');
      return;
    }

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
        return ordersQueueApi
          .update(id, {
            items: lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
            discount: nextDiscount,
            note: nextNote,
          } as any)
          .then(updated => {
            setOrders(current => current.map(order => (order.id === id ? updated : order)));
          })
          .catch((e: any) => {
            setError(e.message || 'Không thể lưu order.');
          });
      }
    }
    return Promise.resolve();
  };

  const handlePaymentConfirmed = () => {
    const orderId = activeOrder?.id;
    if (!orderId) return;

    const orderNumber = pendingOrderNumberRef.current;

    toast.success(`Thanh toán thành công • ${orderNumber}`);
    setOrders(current => current.filter(order => order.id !== orderId));
    setActiveOrderId(current => (current === orderId ? null : current));
    setOrdersToMakeRefresh(k => k + 1);
    queryClient.invalidateQueries({ queryKey: ['orders', 'queue'] });

    setPaymentData(null);
    setShowPaymentModal(false);
  };

  const processPayment = async () => {
    if (!activeOrder || !canPayment) return;
    if (normalizeStatus(activeOrder.paymentStatus) === 'PAID') {
      setError('Order này đã được thanh toán.');
      return;
    }
    if (orderLines.length === 0) {
      console.warn("PAYMENT BLOCKED: Cart is empty");
      setError('Order cần có ít nhất 1 món trước khi thanh toán.');
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const orderId = activeOrder.id;
    const method = paymentMethod;
    const lines = orderLines.map(l => ({ ...l }));
    const discountValue = discount;
    const noteValue = orderNote;

    const receiptWindow = openReceiptWindow();

    setCheckoutLoading(true);
    setError(null);
    try {
      const savedOrder = await ordersQueueApi.update(orderId, {
        items: lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
        discount: discountValue,
        note: noteValue,
      } as any);
      setOrders(current => current.map(order => (order.id === orderId ? savedOrder : order)));

      const validation = await ordersQueueApi.pay(orderId, method);

      if (validation && 'inventoryIssues' in validation) {
        setInventoryStatus('INVALID');
        setInventoryIssues(validation.inventoryIssues || []);
        toast.error('Kiểm tra tồn kho thất bại', {
          description: 'Vui lòng điều chỉnh số lượng hoặc xóa món không đủ nguyên liệu.',
        });
        setCheckoutLoading(false);
        return;
      }

      setInventoryStatus('VALID');
      setInventoryIssues([]);

      const mappedMethod = method === 'QR' ? 'BANKING' : method;
      const initiateResult = await paymentApi.initiate(orderId, { paymentMethod: mappedMethod });

      const bankAccounts = initiateResult.bankAccounts || [];
      const paymentContent = initiateResult.paymentContent || `TT${savedOrder?.orderNumber || ''}`;

      pendingLinesRef.current = lines;
      pendingDiscountRef.current = discountValue;
      pendingNoteRef.current = noteValue;
      pendingOrderNumberRef.current = savedOrder?.orderNumber || activeOrder?.orderNumber || '';
      pendingBankAccountsRef.current = bankAccounts;
      pendingPaymentContentRef.current = paymentContent;

      setPaymentData({
        orderId,
        amount: payableTotal,
        paymentContent,
        bankAccounts,
        orderNumber: savedOrder?.orderNumber || activeOrder?.orderNumber,
      });
      setPendingPaymentMethod(mappedMethod as 'CASH' | 'BANKING' | 'CARD' | 'TRANSFER');

      const orderNumber = savedOrder?.orderNumber || activeOrder?.orderNumber || '';
      const localPrintItems = lines.map(l => ({
        name: l.name || '',
        quantity: l.quantity,
        unitPrice: l.price,
        total: l.price * l.quantity,
      }));
      printReceipt({
        businessName: APP_NAME,
        invoiceNumber: `#${orderNumber}`,
        checkoutDate: new Date().toISOString(),
        items: localPrintItems,
        foodTotal: localPrintItems.reduce((s, i) => s + i.total, 0),
        discount: discountValue || undefined,
        grandTotal: localPrintItems.reduce((s, i) => s + i.total, 0),
        bankAccounts,
        paymentContent,
      }, receiptWindow);

      setShowPaymentModal(true);
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Không thể thanh toán order.';
      console.error('===== PAYMENT ERROR =====');
      console.error('Error:', e);
      toast.error('Thanh toán thất bại', { description: message });
      setError(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isKitchenMode) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden px-3 lg:px-4 pb-3 lg:pb-4">
          <OrdersToMakePanel refreshKey={ordersToMakeRefresh} variant="full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 lg:px-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg lg:text-xl font-black tracking-tight text-foreground">Điều phối đơn hàng</h1>
            <p className="text-[11px] lg:text-xs text-muted-foreground">
              {showMenuColumn && showOrdersColumn && !showKitchenColumn && 'Thực đơn • Đơn đang mở'}
              {showKitchenColumn && !showMenuColumn && 'Đơn cần làm'}
              {showMenuColumn && showKitchenColumn && 'Thực đơn • Đơn đang mở • Điều phối sản xuất'}
              {!showMenuColumn && !showKitchenColumn && 'Đơn đang mở'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="size-4 animate-spin text-primary" />}
            {canCreate && (
              <button
                onClick={createNewOrder}
                disabled={createLoading}
                className="flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:opacity-60 text-xs"
              >
                {createLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Đơn mới
              </button>
            )}
          </div>
        </div>
        {error && <div className="mt-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2 text-xs font-medium text-red-700 dark:text-red-400">{error}</div>}
      </div>

      {/* Main content: dynamic column layout based on permissions */}
      <div className="flex-1 min-h-0 flex gap-2 lg:gap-3 overflow-hidden px-3 lg:px-4 pb-3 lg:pb-4">
        {/* Left: Product Menu — CASHIER only */}
        {showMenuColumn && (
          <section
            className="flex flex-col min-w-0 rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
            style={{ flex: showKitchenColumn ? '3 1 0%' : '3 1 0%' }}
          >
            <div className="shrink-0 p-2.5 lg:p-3 border-b border-border">
              <div className="flex flex-col gap-1.5">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-xs lg:text-base font-black text-foreground">
                    <ShoppingCart className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary shrink-0" />
                    <span className="truncate">Thực đơn</span>
                  </h2>
                  <p className="text-[10px] lg:text-xs text-muted-foreground truncate">
                    {activeOrder ? `Đang thêm vào ${getCustomerLabel(activeOrder)}` : 'Tạo hoặc chọn đơn để thêm món'}
                  </p>
                </div>
                <div className="relative w-full shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Tìm sản phẩm..."
                    className="h-9 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:bg-input-background focus:ring-4 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Product grid - scrollable */}
            <div className="flex-1 overflow-y-auto p-2.5 lg:p-3">
              <div className="grid grid-cols-2 gap-2 lg:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {filteredMenuItems.map(item => {
                  const outOfStock = isItemOutOfStock(item, inventoryMap);
                  return (
                    <div key={item.id} className="relative">
                      <button
                        type="button"
                        onClick={outOfStock ? undefined : () => addProduct(item)}
                        disabled={!activeOrderId || !canUpdate || outOfStock}
                        className={`group flex flex-col rounded-md lg:rounded-2xl border bg-gradient-to-br from-card to-muted p-1.5 lg:p-2.5 text-left shadow-sm transition min-h-24 lg:min-h-28 w-full ${outOfStock
                          ? 'opacity-50 grayscale border-border cursor-not-allowed'
                          : 'border-border hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50'
                          }`}
                      >
                        <div className="mb-1.5 flex h-6 w-6 lg:h-8 lg:w-8 items-center justify-center rounded-md lg:rounded-xl bg-accent font-black text-primary text-[10px] lg:text-xs group-hover:bg-primary group-hover:text-primary-foreground">
                          {item.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="text-[10px] lg:text-xs font-black text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</div>
                        
                        <div className="mt-auto pt-0.5 lg:pt-1 text-xs lg:text-sm font-black text-primary">{formatMoney(item.price)}</div>
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
                  <div className="col-span-full rounded-lg border border-dashed border-border p-2 text-center text-muted-foreground text-xs">
                    Không có sản phẩm phù hợp.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Center: Open Orders — CASHIER only */}
        {showOrdersColumn && (
          <aside
            className="flex flex-col min-w-0 rounded-3xl border border-border bg-card shadow-sm overflow-hidden"
            style={{ flex: showKitchenColumn ? '5 1 0%' : '5 1 0%', maxWidth: '960px' }}
          >
            {/* Fixed header + search */}
            <div className="shrink-0 border-b border-border p-2.5 lg:p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-xs lg:text-base font-black text-foreground">Đơn đang mở</h2>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">Cũ nhất • {filteredOrders.length} chưa thanh toán</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[10px] lg:text-xs font-black text-emerald-700 dark:text-emerald-400">ACTIVE</span>
              </div>
              <div className="relative mb-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="h-9 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:bg-input-background focus:ring-4 focus:ring-primary/20"
                />
              </div>
              {/* Order tabs - touch-friendly cards */}
              {filteredOrders.length > 0 && (
                <div className="flex flex-row gap-2 overflow-x-auto overflow-y-hidden scrollbar-none">
                  {filteredOrders.map(order => {
                    const selected = order.id === activeOrderId;
                    const label = getCustomerLabel(order);
                    const displayLabel = label.startsWith('Khách') ? 'Khách' : label;
                    const orderHasIssues = activeOrderId === order.id && hasInventoryIssues;
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setActiveOrderId(order.id)}
                        title={`#${order.orderNumber}`}
                        className={`shrink-0 flex flex-col items-start justify-center min-w-[120px] h-14 p-2.5 rounded-md text-left whitespace-nowrap ${selected
                          ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40'
                          : orderHasIssues
                            ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-300 dark:border-red-800'
                            : 'bg-muted text-foreground hover:bg-accent border border-border'
                          }`}
                      >
                        <div className="flex items-center gap-1 w-full">
                          {orderHasIssues ? (
                            <>
                              <span className="text-[9px] leading-none text-red-600 dark:text-red-400">🔴</span>
                              <span className="text-[9px] leading-none font-semibold text-red-600 dark:text-red-400">Vấn đề tồn kho</span>
                            </>
                          ) : null}
                        </div>
                        <span className={`text-[11px] font-bold leading-tight w-full ${selected ? 'text-primary-foreground' : orderHasIssues ? 'text-red-900 dark:text-red-300' : 'text-foreground'}`}>
                          {displayLabel}
                        </span>
                        <span className={`text-[9px] leading-tight font-medium ${selected ? 'text-primary-foreground/70' : orderHasIssues ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
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
                  <div className="shrink-0 mx-3 lg:mx-4 mt-2 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400 text-lg leading-none shrink-0 mt-0.5">⚠</span>
                      <div>
                        <p className="text-xs font-bold text-red-800 dark:text-red-300">Vấn đề tồn kho</p>
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
                  <div className="shrink-0 mx-3 lg:mx-4 mt-2 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-600 dark:text-amber-400 text-lg leading-none shrink-0 mt-0.5">⚠</span>
                      <div>
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Đơn hàng đã thay đổi</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Đơn hàng đã được sửa. Tồn kho cần kiểm tra lại.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer info - fixed */}
                <div className="shrink-0 px-3 lg:px-4 pt-1.5 lg:pt-2 pb-1 border-b border-border">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs lg:text-sm font-black text-foreground truncate">{getCustomerLabel(activeOrder)}</span>
                      <span className="shrink-0 text-[9px] lg:text-[10px] font-semibold text-muted-foreground" title={`#${activeOrder.orderNumber}`}>{getShortOrderNumber(activeOrder)}</span>
                      {hasInventoryIssues ? (
                        <span className="shrink-0 rounded-full bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 text-[9px] lg:text-[10px] font-black text-red-700 dark:text-red-400">
                          🔴 VẤN ĐỀ TỒN KHO
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5">
                    <Tag className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-muted-foreground shrink-0" />
                    <input
                      value={labels[activeOrder.id] ?? ''}
                      onChange={e => updateCustomerLabel(activeOrder.id, e.target.value)}
                      placeholder={`Khách ${getShortOrderNumber(activeOrder)}`}
                      className="h-7 lg:h-8 w-full rounded-md border border-border bg-input-background px-2 text-[10px] lg:text-xs font-bold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20"
                    />
                  </label>
                </div>

                {/* Order items - scrollable only section */}
                <div className="flex-1 overflow-y-auto">
                  {orderLines.length === 0 && (
                    <div className="mx-3 lg:mx-4 mt-1.5 rounded-md border border-dashed border-border p-2 text-center text-[10px] lg:text-xs text-muted-foreground">
                      Chưa có món. Chọn sản phẩm ở menu bên trái.
                    </div>
                  )}
                  <div className="divide-y divide-border">
                    {orderLines.map(line => {
                      const issue = inventoryIssues.find(i => i.menuItemId === line.menuItemId);
                      const hasIssue = !!issue;
                      return (
                        <div key={line.menuItemId} className={`${hasIssue ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
                          <div className="flex items-center gap-1.5 px-3 lg:px-4 h-8 lg:h-11">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              {hasIssue && (
                                <span className="text-red-600 dark:text-red-400 text-[10px] leading-none shrink-0" title="Thiếu nguyên liệu">🔴</span>
                              )}
                              <span className="text-[11px] lg:text-xs font-semibold text-foreground truncate">{line.name}</span>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted hover:bg-accent transition-colors"
                                onClick={() => changeQuantity(line.menuItemId, -1)}
                                aria-label={`Giảm số lượng ${line.name}`}
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </button>
                              <span className="w-6 text-center text-[11px] lg:text-xs font-bold tabular-nums">{line.quantity}</span>
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                onClick={() => changeQuantity(line.menuItemId, 1)}
                                aria-label={`Tăng số lượng ${line.name}`}
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </button>
                            </div>
                            <span className="text-[11px] lg:text-xs font-bold text-foreground tabular-nums w-16 text-right shrink-0">
                              {formatMoney(line.price * line.quantity)}
                            </span>
                            <button
                              type="button"
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                              onClick={() => changeQuantity(line.menuItemId, -line.quantity)}
                              aria-label={`Xóa ${line.name}`}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                          {hasIssue && issue && (
                            <div className="px-3 lg:px-4 pb-1.5 text-[9px] lg:text-[10px] text-red-700 dark:text-red-400">
                              <span className="font-semibold">Thiếu nguyên liệu:</span>
                              {issue.missingIngredients.map((mi, idx) => (
                                <span key={idx} className="ml-1">• {mi.ingredientName} (cần {mi.required}g, còn {mi.available}g)</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes - fixed */}
                <div className="shrink-0 px-2.5 lg:px-3 pb-0.5">
                  <textarea
                    value={orderNote}
                    onChange={e => setOrderNote(e.target.value)}
                    onBlur={() => flushPersist()}
                    placeholder="Ghi chú order..."
                    rows={1}
                    className="w-full rounded-md border border-border bg-input-background px-2 py-1 text-[10px] lg:text-xs outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20"
                  />
                </div>

                {/* Totals - fixed */}
                <div className="shrink-0 px-2.5 lg:px-3 pb-0.5">
                  <div className="rounded-md lg:rounded-xl bg-muted p-1.5 lg:p-2">
                    <div className="flex justify-between text-xs lg:text-base font-black">
                      <span>Tổng cộng</span>
                      <span className="text-primary">{formatMoney(payableTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment + actions - fixed */}
                <div className="shrink-0 px-2.5 lg:px-3 pb-2.5 lg:pb-3 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      aria-label="Phương thức thanh toán"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="h-9 lg:h-10 rounded-md border border-border bg-input-background px-2 text-[10px] lg:text-xs font-bold"
                    >
                      <option value="CASH">Tiền mặt</option>
                      <option value="QR">Chuyển khoản QR</option>
                    </select>
                    <button
                      type="button"
                      onClick={processPayment}
                      disabled={checkoutLoading || orderLines.length === 0 || !canPayment || activeOrderPaid}
                      className="flex h-9 lg:h-10 items-center justify-center gap-1.5 rounded-md bg-emerald-600 dark:bg-emerald-700 px-3 text-[10px] lg:text-xs font-black text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-60"
                    >
                      <CreditCard className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                      Thanh toán
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelOrder(activeOrder)}
                    disabled={deleteLoading || !canDelete}
                    className="flex h-9 lg:h-10 w-full items-center justify-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 text-[10px] lg:text-xs font-black text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    Hủy đơn
                  </button>
                </div>
              </div>
            ) : (
              /* No active order - show order list for selection */
              <div className="flex-1 overflow-y-auto p-2.5 lg:p-3 space-y-1.5 lg:space-y-2">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <article
                      key={order.id}
                      onClick={() => setActiveOrderId(order.id)}
                      className="cursor-pointer rounded-md lg:rounded-2xl border border-border bg-card p-2.5 lg:p-3 transition hover:border-primary/60 hover:bg-accent"
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs lg:text-base font-black text-primary" title={`#${order.orderNumber}`}>{getShortOrderNumber(order)}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] lg:text-xs font-semibold text-muted-foreground">
                            <UserRound className="h-2.5 w-2.5 lg:h-3 lg:w-3 shrink-0" />
                            <span className="truncate">{getCustomerLabel(order)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px] lg:text-xs">
                        <div className="rounded-md lg:rounded-xl bg-muted p-1 lg:p-1.5">
                          <div className="text-muted-foreground text-[9px] lg:text-[10px]">Món</div>
                          <div className="font-black text-foreground">{order.itemCount || 0}</div>
                        </div>
                        <div className="rounded-md lg:rounded-xl bg-muted p-1 lg:p-1.5">
                          <div className="text-muted-foreground text-[9px] lg:text-[10px]">Tổng</div>
                          <div className="font-black text-foreground text-[10px] lg:text-xs truncate">{formatMoney(order.total)}</div>
                        </div>
                        <div className="rounded-md lg:rounded-xl bg-muted p-1 lg:p-1.5">
                          <div className="text-muted-foreground text-[9px] lg:text-[10px]">Thời gian</div>
                          <div className="flex items-center gap-1 font-black text-foreground text-[10px] lg:text-xs">
                            <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3 shrink-0" />
                            {formatTime(order.createdAt)}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-border p-3 text-center text-muted-foreground text-[10px] lg:text-xs">
                    {loading ? 'Đang tải...' : 'Không có đơn mở phù hợp.'}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Right: Orders To Make — KITCHEN only */}
        {showKitchenColumn && (
          <div
            className="flex flex-col"
            style={{ flex: (showMenuColumn || showOrdersColumn) ? '2 1 0%' : '1 1 100%', minWidth: 0 }}
          >
            <OrdersToMakePanel refreshKey={ordersToMakeRefresh} />
          </div>
        )}
      </div>

      <InvoicePaymentModal
        open={showPaymentModal}
        onOpenChange={(v) => { setShowPaymentModal(v); if (!v) setPaymentData(null); }}
        paymentMethod={pendingPaymentMethod}
        data={paymentData}
        onConfirmed={handlePaymentConfirmed}
      />
    </div>
  );
}
