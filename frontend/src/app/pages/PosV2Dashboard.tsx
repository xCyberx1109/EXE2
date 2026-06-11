import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import {
  getPosToken, staffAuthApi, shiftApi, deviceAuthApi,
} from '../api/posServices';
import { tableApi, menuApi, categoryApi, ordersApi } from '../api/services';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../../shared/constants';
import type { CurrentShift, ActiveStaff, TableItem, MenuItem, CategoryItem } from '../types';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Printer, X, Smartphone, Clock, Search, Utensils } from 'lucide-react';

type Tab = 'tables' | 'login' | 'shift' | 'staff' | 'settings';

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  source?: 'qr' | 'pos';
}

export function PosV2Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isDeviceMode, logoutDevice, deviceInfo, branchInfo, deviceType } = useAuth();

  useEffect(() => {
    if (!isDeviceMode || !deviceType) return;
    const redirectMap: Record<string, string> = {
      CASHIER: '/pos/table-view',
      KITCHEN: '/pos/kitchen-queue',
      WAITER: '/pos/waiter-order',
      KIOSK: '/pos/kiosk',
      CUSTOMER_DISPLAY: '/pos/display',
      MANAGER: '/pos/table-view',
      TABLET: '/pos/waiter-order',
    };
    const target = redirectMap[deviceType];
    if (target && target !== '/pos-v2/dashboard') {
      navigate(target, { replace: true });
    }
  }, [isDeviceMode, deviceType, navigate]);

  const [activeTab, setActiveTab] = useState<Tab>('tables');
  const [pinCode, setPinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);
  const [activeStaff, setActiveStaff] = useState<ActiveStaff[]>([]);
  const [shiftBalances, setShiftBalances] = useState({
    openingBalance: '',
    closingBalance: '',
    actualBalance: '',
    note: '',
  });

  // POS ordering state
  const [tables, setTables] = useState<TableItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [shift, staff] = await Promise.all([
        shiftApi.current().catch(() => null),
        staffAuthApi.activeStaff().catch(() => []),
      ]);
      setCurrentShift(shift);
      setActiveStaff(staff);
    } catch {
      // silently fail
    }
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const data = await tableApi.listPos();
      setTables(data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const [cats, items] = await Promise.all([
        categoryApi.list(),
        menuApi.list({ available: 'true' }),
      ]);
      setCategories(cats);
      setMenuItems(items);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (!getPosToken() || !isDeviceMode) {
      navigate('/login', { replace: true });
      return;
    }
    fetchData();
    fetchTables();
    fetchMenu();
    const interval = setInterval(fetchData, 15000);
    const tableInterval = setInterval(fetchTables, 5000);
    return () => {
      clearInterval(interval);
      clearInterval(tableInterval);
    };
  }, [navigate, fetchData, isDeviceMode, fetchTables, fetchMenu]);

  const handleStaffLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await staffAuthApi.loginPin(pinCode);
      setPinCode('');
      await fetchData();
      setActiveTab('shift');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogout = async () => {
    try {
      await staffAuthApi.logout();
      setActiveStaff([]);
    } catch {
      // silent
    }
  };

  const handleOpenShift = async () => {
    setLoading(true);
    setError('');
    try {
      await shiftApi.open({
        openingBalance: Number(shiftBalances.openingBalance),
        note: shiftBalances.note || undefined,
      });
      setShiftBalances({ openingBalance: '', closingBalance: '', actualBalance: '', note: '' });
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open shift');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await shiftApi.close({
        closingBalance: Number(shiftBalances.closingBalance),
        actualBalance: shiftBalances.actualBalance ? Number(shiftBalances.actualBalance) : undefined,
        note: shiftBalances.note || undefined,
      });
      setShiftBalances({ openingBalance: '', closingBalance: '', actualBalance: '', note: '' });
      alert(
        `Shift closed!\nExpected: ${result.expectedCashBalance}\nActual: ${result.closingBalance}\nVariance: ${result.balanceVariance}`,
      );
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close shift');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceLogout = async () => {
    await logoutDevice();
    navigate('/login', { replace: true });
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  // POS handlers
  const handleTableSelect = async (table: TableItem) => {
    setSelectedTable(table);
    setOrderItems([]);
    setSearchTerm('');
    setSelectedCategory('all');

    if (table.currentOrder) {
      try {
        const order = await ordersApi.getActiveByTable(table.id);
        if (order && order.items) {
          const items: OrderItem[] = order.items.map((i) => ({
            menuItemId: i.menuItemId || i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            source: 'qr',
          }));
          setOrderItems(items);
        }
      } catch {
        // silent
      }
    }
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setOrderItems([]);
    fetchTables();
  };

  const addToOrder = (item: MenuItem) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, source: 'pos' }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((i) => (i.menuItemId === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (id: string) => {
    setOrderItems((prev) => prev.filter((i) => i.menuItemId !== id));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  };

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
      handleBackToTables();
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Không thể tạo đơn'));
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handlePayment = async (method: 'cash' | 'card') => {
    if (!selectedTable) return;
    try {
      await apiFetch('/orders/complete-payment', {
        method: 'POST',
        body: JSON.stringify({
          table: parseInt(selectedTable.tableCode, 10) || 0,
          paymentMethod: method === 'cash' ? 'CASH' : 'CARD',
        }),
        auth: false,
        headers: (() => {
          const posToken = localStorage.getItem('fnb_pos_token');
          return posToken ? { 'Authorization': `Bearer ${posToken}` } : {};
        })(),
      });
      setShowPayment(false);
      handleBackToTables();
      toast.success(`Đã thanh toán ${(calculateTotal() * 1.1).toLocaleString()} ₫`, {
        description: `Phương thức: ${method === 'cash' ? 'Tiền mặt' : 'Thẻ'}`,
      });
    } catch (err: any) {
      toast.error('Thanh toán thất bại', { description: err.message || 'Không thể thanh toán' });
    }
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch && item.available;
  });

  const getTableStatusStyle = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 border-green-300';
      case 'OCCUPIED': return 'bg-red-100 text-red-800 border-red-300';
      case 'RESERVED': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'CHECKING_OUT': return 'bg-accent text-primary border-primary/30';
      default: return 'bg-muted text-gray-800 border-input';
    }
  };

  const getTableStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'Trống';
      case 'OCCUPIED': return 'Có khách';
      case 'RESERVED': return 'Đã đặt';
      case 'CHECKING_OUT': return 'Đang TT';
      default: return status;
    }
  };

  const getQRTableCount = (table: TableItem) => {
    if (!table.currentOrder) return 0;
    return table.currentOrder.itemCount;
  };

  const getQRTableTotal = (table: TableItem) => {
    if (!table.currentOrder) return 0;
    return table.currentOrder.total;
  };

  // Tables with active orders (for QR overview)
  const activeOrderTables = tables.filter((t) => t.currentOrder);

  const posLayout = (
    <div className="h-full space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{APP_NAME}</h1>
          <p className="text-muted-foreground mt-1">Quản lý đơn hàng và thanh toán</p>
        </div>
        {selectedTable && (
          <div className="flex items-center gap-3 bg-accent px-4 py-2 rounded-lg">
            <span className="font-semibold text-primary">Bàn {selectedTable.tableCode}</span>
            <button onClick={handleBackToTables} className="text-primary hover:text-primary/80">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Table grid or Menu */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedTable ? (
            <>
              {/* Table grid */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Chọn bàn</h2>
                <div className="grid grid-cols-4 gap-3">
                  {tables.map((table) => {
                    const orderCount = getQRTableCount(table);
                    const tableTotal = getQRTableTotal(table);
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableSelect(table)}
                        disabled={table.status === 'DISABLED'}
                        className={`p-4 rounded-lg border-2 transition-all relative ${getTableStatusStyle(table.status)} hover:shadow-md ${table.status === 'DISABLED' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {orderCount > 0 && (
                          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {orderCount}
                          </div>
                        )}
                        <div className="text-center">
                          <div className="text-xl font-bold">Bàn {table.tableCode}</div>
                          <div className="text-xs mt-1">{getTableStatusText(table.status)}</div>
                          {table.currentOrder && (
                            <>
                              <div className="flex items-center justify-center gap-1 text-xs mt-2 bg-card/50 rounded px-2 py-1">
                                <Smartphone className="w-3 h-3" />
                                <span>QR Order</span>
                              </div>
                              <div className="text-xs font-semibold mt-1">
                                {tableTotal.toLocaleString()} ₫
                              </div>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QR Orders overview */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Đơn hàng từ QR Code</h2>
                {activeOrderTables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Smartphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Chưa có đơn hàng nào từ QR</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeOrderTables.map((table) => (
                      <div key={table.id} className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${getTableStatusStyle(table.status)}`}>
                              {table.tableCode}
                            </span>
                            <div>
                              <div className="font-semibold text-foreground">Bàn {table.tableCode}</div>
                              {table.tableName && <div className="text-xs text-muted-foreground">{table.tableName}</div>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleTableSelect(table)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                          >
                            Xử lý
                          </button>
                        </div>
                        {table.currentOrder && (
                          <>
                            <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                              <span className="text-sm font-medium text-muted-foreground">
                                {table.currentOrder.itemCount} món
                              </span>
                              <span className="text-lg font-bold text-primary">
                                {table.currentOrder.total.toLocaleString()} ₫
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Category filter */}
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex gap-2 flex-wrap mb-3">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'}`}
                  >
                    Tất cả
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Tìm món ăn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Menu grid */}
              <div className="bg-card rounded-lg border border-border p-4">
                {filteredMenuItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Không có món nào</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredMenuItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addToOrder(item)}
                        className="p-4 bg-muted rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-all text-left"
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                        ) : (
                          <div className="w-full h-24 bg-muted rounded-lg mb-2 flex items-center justify-center text-gray-300">
                            <Utensils className="w-8 h-8" />
                          </div>
                        )}
                        <div className="font-semibold text-foreground mb-1">{item.name}</div>
                        <div className="text-sm text-muted-foreground mb-2">{item.category}</div>
                        <div className="text-lg font-bold text-primary">{item.price.toLocaleString()} ₫</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Order cart */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-lg border border-border p-4 sticky top-4 max-h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <ShoppingCart className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Đơn hàng</h2>
              <span className="ml-auto bg-accent text-primary px-2 py-1 rounded-full text-xs font-medium">
                {orderItems.reduce((sum, i) => sum + i.quantity, 0)} món
              </span>
            </div>

            {!selectedTable ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chọn bàn để bắt đầu</p>
              </div>
            ) : orderItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có món nào</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto mb-4 min-h-0">
                  {orderItems.map((item) => (
                    <div key={item.menuItemId} className="flex items-start gap-2 pb-3 border-b border-border">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.price.toLocaleString()} ₫</div>
                        {item.source === 'qr' && (
                          <div className="flex items-center gap-1 text-xs text-primary mt-0.5">
                            <Smartphone className="w-3 h-3" />
                            QR
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQuantity(item.menuItemId, -1)} className="w-7 h-7 rounded bg-muted hover:bg-accent flex items-center justify-center">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.menuItemId, 1)} className="w-7 h-7 rounded bg-muted hover:bg-accent flex items-center justify-center">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeItem(item.menuItemId)} className="w-7 h-7 rounded bg-red-50 hover:bg-red-100 flex items-center justify-center ml-1">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-2 shrink-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tạm tính:</span>
                    <span className="font-medium">{calculateTotal().toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT (10%):</span>
                    <span className="font-medium">{(calculateTotal() * 0.1).toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span>Tổng cộng:</span>
                    <span className="text-primary">{(calculateTotal() * 1.1).toLocaleString()} ₫</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 shrink-0">
                  <button
                    onClick={handleSubmitOrder}
                    disabled={orderSubmitting}
                    className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {orderSubmitting ? 'Đang xử lý...' : 'Gọi món'}
                  </button>
                  <button
                    onClick={() => setShowPayment(true)}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    Thanh toán
                  </button>
                  <button
                    onClick={() => alert('In hóa đơn tạm')}
                    className="w-full py-2 border border-input text-foreground rounded-lg font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    In tạm
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground mb-4">Thanh toán - Bàn {selectedTable.tableCode}</h2>
            <div className="bg-muted rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">Tổng tiền:</span>
                <span className="font-semibold">{calculateTotal().toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">VAT (10%):</span>
                <span className="font-semibold">{(calculateTotal() * 0.1).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Khách cần trả:</span>
                <span className="text-primary">{(calculateTotal() * 1.1).toLocaleString()} ₫</span>
              </div>
            </div>
            <div className="space-y-3">
              <button onClick={() => handlePayment('cash')} className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                <Banknote className="w-5 h-5" />
                Tiền mặt
              </button>
              <button onClick={() => handlePayment('card')} className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                Thẻ / Chuyển khoản
              </button>
              <button onClick={() => setShowPayment(false)} className="w-full py-2 border border-input text-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="bg-card border-b shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">{APP_NAME}</h1>
            {currentShift && (
              <Badge variant={currentShift.status === 'OPEN' ? 'default' : 'secondary'}>
                Shift {currentShift.status === 'OPEN' ? 'Open' : 'Closed'}
              </Badge>
            )}
            {activeStaff.length > 0 && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                {activeStaff[0].account.fullName}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDeviceLogout}>
              Device Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 overflow-hidden flex flex-col">
        <div className="flex gap-2 mb-6 shrink-0">
          {(['tables', 'login', 'shift', 'staff', 'settings'] as Tab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'tables' ? 'Bàn' : tab === 'login' ? 'Staff Login' : tab === 'shift' ? 'Shift' : tab === 'staff' ? 'Staff' : 'Settings'}
            </Button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-hidden">
          {activeTab === 'tables' && posLayout}
        </div>
        {activeTab === 'login' && (
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Staff Login</CardTitle>
                <CardDescription>Enter your PIN to start a session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="password"
                  placeholder="PIN Code"
                  value={pinCode}
                  onChange={handlePinChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                  className="font-mono text-2xl tracking-widest text-center h-14"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleStaffLogin}
                  disabled={loading || pinCode.length < 4}
                >
                  {loading ? 'Verifying...' : 'Login'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
        {activeTab === 'shift' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Shift Management</CardTitle>
                  <CardDescription>
                    {currentShift
                      ? `Shift opened at ${new Date(currentShift.openedAt).toLocaleTimeString()}`
                      : 'No active shift'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentShift && currentShift.status === 'OPEN' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent rounded-lg p-4 text-center">
                        <div className="text-sm text-muted-foreground">Opening Balance</div>
                        <div className="text-2xl font-bold">{currentShift.openingBalance.toLocaleString()}</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-muted-foreground">Cash Sales</div>
                        <div className="text-2xl font-bold text-green-600">{currentShift.cashSales.toLocaleString()}</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-muted-foreground">Card Sales</div>
                        <div className="text-2xl font-bold text-purple-600">{currentShift.cardSales.toLocaleString()}</div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-muted-foreground">Total Orders</div>
                        <div className="text-2xl font-bold">{currentShift.totalOrders}</div>
                      </div>
                    </div>
                  )}
                  {!currentShift || currentShift.status === 'CLOSED' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Opening Balance</label>
                        <Input type="number" min="0" value={shiftBalances.openingBalance} onChange={(e) => setShiftBalances({ ...shiftBalances, openingBalance: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Note (optional)</label>
                        <Input value={shiftBalances.note} onChange={(e) => setShiftBalances({ ...shiftBalances, note: e.target.value })} placeholder="e.g., Morning shift" />
                      </div>
                      <Button className="w-full" onClick={handleOpenShift} disabled={loading || !activeStaff.length}>
                        {loading ? 'Opening...' : 'Open Shift'}
                      </Button>
                      {!activeStaff.length && <p className="text-sm text-amber-600">A staff member must be logged in to open a shift</p>}
                    </div>
                  ) : (
                    <div className="space-y-4 border-t pt-4">
                      <div>
                        <label className="text-sm font-medium">Closing Balance (Cash Drawer)</label>
                        <Input type="number" min="0" value={shiftBalances.closingBalance} onChange={(e) => setShiftBalances({ ...shiftBalances, closingBalance: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Actual Balance (optional)</label>
                        <Input type="number" min="0" value={shiftBalances.actualBalance} onChange={(e) => setShiftBalances({ ...shiftBalances, actualBalance: e.target.value })} placeholder="Leave blank to use closing balance" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Note</label>
                        <Input value={shiftBalances.note} onChange={(e) => setShiftBalances({ ...shiftBalances, note: e.target.value })} placeholder="e.g., End of day" />
                      </div>
                      <Button className="w-full" variant="destructive" onClick={handleCloseShift} disabled={loading}>
                        {loading ? 'Closing...' : 'Close Shift'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Staff on Duty</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeStaff.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No staff logged in</p>
                  ) : (
                    <div className="space-y-3">
                      {activeStaff.map((s) => (
                        <div key={s.sessionId} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <div>
                            <div className="font-medium">{s.account.fullName}</div>

                          </div>
                          <div className="text-xs text-muted-foreground">{new Date(s.loginAt).toLocaleTimeString()}</div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full" onClick={handleStaffLogout}>Logout All Staff</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        {activeTab === 'staff' && (
          <Card>
            <CardHeader>
              <CardTitle>Active Staff Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {activeStaff.length === 0 ? (
                <p className="text-muted-foreground">No active staff sessions. Log in with a PIN first.</p>
              ) : (
                <div className="space-y-2">
                  {activeStaff.map((s) => (
                    <div key={s.sessionId} className="flex items-center justify-between p-3 bg-card border rounded-lg">
                      <div>
                        <div className="font-medium">{s.account.fullName}</div>

                      </div>
                      <div className="text-sm text-muted-foreground">Since {new Date(s.loginAt).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {activeTab === 'settings' && (
          <Card>
            <CardHeader>
              <CardTitle>Device Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full" onClick={handleDeviceLogout}>
                Logout Device & Return to Setup
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
