import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Printer, X } from 'lucide-react';
import { QRCodeCanvas } from "qrcode.react";
import { menuApi, ordersApi, inventoryApi } from '../api/services';
import type { MenuItem, InventoryItem } from '../types';
import { buildInventoryMap, isItemOutOfStock } from '../../shared/utils/inventoryAvailability';
import { APP_NAME } from '../../shared/constants';

interface OrderItem extends MenuItem {
  quantity: number;
  orderedAt?: string;
}

interface Table {
  id: string;
  number: number;
  status: 'available' | 'occupied';
  qrOrders?: OrderItem[];
}


export function POSSystem() {
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const inventoryMap = useMemo(() => buildInventoryMap(inventoryItems), [inventoryItems]);

  useEffect(() => {
    Promise.all([
      menuApi.list({ available: 'true' }),
      inventoryApi.list(),
    ]).then(([items, inv]) => {
      setMenuItems(Array.isArray(items) ? items : []);
      setInventoryItems(Array.isArray(inv) ? inv : []);
    }).catch(console.error);
  }, []);

  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && item.available;
  });

  useEffect(() => {

    const initTables: Table[] = Array.from({ length: 8 }, (_, i) => ({
      id: `table-${i + 1}`,
      number: i + 1,
      status: "available",
      qrOrders: []
    }));

    setTables(initTables);

  }, []);

  useEffect(() => {
    let pollInterval = 2000;
    let intervalId: ReturnType<typeof setInterval>;

    const loadOrders = async () => {
      try {
        const data = await ordersApi.list();
        pollInterval = 2000; // reset on success

        setTables(prevTables =>
          prevTables.map(table => {
            const orders = (Array.isArray(data) ? data : [])
              .filter((o: any) => Number(o.table) === table.number)
              .flatMap((o: any) =>
                (o.items ?? []).map((item: any) => ({
                  ...item,
                  orderedAt: new Date(o.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                }))
              );

            return {
              ...table,
              status: orders.length ? "occupied" : "available",
              qrOrders: orders
            };
          })
        );
      } catch (err) {
        console.log("Load order error", err);
        pollInterval = Math.min(pollInterval * 1.5, 10000); // backoff on error
      }

      clearInterval(intervalId);
      intervalId = setInterval(loadOrders, pollInterval);
    };

    loadOrders();

    intervalId = setInterval(loadOrders, pollInterval);

    return () => clearInterval(intervalId);
  }, []);



  // Load QR orders when table is selected
  const handleTableSelect = (table: Table) => {
    setSelectedTable(table);
    if (table.qrOrders) {
      setOrderItems(table.qrOrders);
    } else {
      setOrderItems([]);
    }
  };

  const addToOrder = (item: MenuItem) => {
    if (!selectedTable) return;

    const existingItem = orderItems.find(i => i.id === item.id);

    if (existingItem) {
      setOrderItems(orderItems.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setOrderItems([...orderItems, { ...item, quantity: 1 }]);
    }
  };



  const updateQuantity = (id: string, delta: number) => {
    if (!selectedTable) return;

    const updatedOrder = orderItems
      .map(item => {
        if (item.id === id) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
        }
        return item;
      })
      .filter(item => item.quantity > 0);

    setOrderItems(updatedOrder);

    setTables(prev =>
      prev.map(t =>
        t.id === selectedTable.id
          ? { ...t, qrOrders: updatedOrder }
          : t
      )
    );
  };


  const removeItem = (id: string) => {
    if (!selectedTable) return;

    const updatedOrder = orderItems.filter(item => item.id !== id);

    setOrderItems(updatedOrder);

    setTables(prev =>
      prev.map(t =>
        t.id === selectedTable.id
          ? { ...t, qrOrders: updatedOrder }
          : t
      )
    );
  };


  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleOrder = async () => {

    if (!selectedTable || orderItems.length === 0) return;

    try {

      await ordersApi.create({
        table: selectedTable.number,
        items: orderItems,
        time: new Date().toISOString(),
      });

      alert("Đã gửi order xuống bếp");

      setSelectedTable(null);
      setOrderItems([]);

    } catch (err) {

      console.log("Send order error", err);
      alert("Không gửi được order");

    }

  };

  const handlePayment = async (method: 'cash' | 'card') => {

    if (!selectedTable) return;

    try {

      // Gọi API thanh toán - update status = COMPLETED + release table (không xóa order)
      const paymentMethod = method === 'cash' ? 'CASH' : 'CARD';
      await ordersApi.completePayment(selectedTable.number, paymentMethod);

      toast.success(`Đã thanh toán ${(calculateTotal() * 1.1).toLocaleString()} ₫`, {
        description: `Phương thức: ${method === 'cash' ? 'Tiền mặt' : 'Thẻ'}`,
      });

      // reset UI
      setTables(prev =>
        prev.map(t =>
          t.id === selectedTable.id
            ? { ...t, status: 'available', qrOrders: [] }
            : t
        )
      );

      setOrderItems([]);
      setShowPayment(false);
      setSelectedTable(null);

    } catch (err) {

      console.log("Payment error", err);
      toast.error('Thanh toán thất bại');

    }
  };


  const getTableStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'occupied':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTableStatusText = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return 'Trống';
      case 'occupied':
        return 'Có khách';
      default:
        return '';
    }
  };

  const getTableOrderCount = (table: Table) => {
    if (!table.qrOrders) return 0;
    return table.qrOrders.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTableTotal = (table: Table) => {
    if (!table.qrOrders) return 0;
    return table.qrOrders.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-gray-500 mt-1">Quản lý đơn hàng và thanh toán</p>
        </div>
        {selectedTable && (
          <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-md">
            <span className="font-semibold text-blue-900">Bàn {selectedTable.number}</span>
            <button
              onClick={() => {
                setSelectedTable(null);
                setOrderItems([]);
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
        {/* Left Side - Menu & Tables */}
        <div className="lg:col-span-2 space-y-1">
          {/* Table Selection */}
          {!selectedTable && (
            <>
              <div className="bg-white rounded-md border border-gray-200 p-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Chọn bàn</h2>
                <div className="grid grid-cols-4 gap-1.5">
                  {tables.map((table) => {
                    const orderCount = getTableOrderCount(table);
                    const tableTotal = getTableTotal(table);
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableSelect(table)}
                        className={`p-3 rounded-md border-2 transition-all relative ${getTableStatusColor(table.status)} hover:shadow-md`}
                      >
                        {orderCount > 0 && (
                          <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full size-4 flex items-center justify-center text-xs font-bold">
                            {orderCount}
                          </div>
                        )}
                        <div className="text-center">
                          <div className="text-lg font-bold">Bàn {table.number}</div>
                          <div className="text-xs mt-1">{getTableStatusText(table.status)}</div>
                          {table.qrOrders && (
                            <>
                              <div className="text-xs font-semibold mt-1">
                                {tableTotal.toLocaleString()} ₫
                              </div>
                            </>
                          )}
                        </div>
                        <div className='flex justify-center mt-3'>
                          <QRCodeCanvas
                            value={`${import.meta.env.VITE_FRONTEND_URL}/qrmenu?table=${table.number}`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>


            </>
          )}

          {/* Menu Items */}
          {selectedTable && (
            <>
              {/* Search */}
              <div className="bg-white rounded-md border border-gray-200 p-3">
                <input
                  type="text"
                  placeholder="Tìm món ăn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Menu Grid */}
              <div className="bg-white rounded-md border border-gray-200 p-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {filteredMenuItems.map((item) => {
                    const outOfStock = isItemOutOfStock(item, inventoryMap);
                    return (
                      <div key={item.id} className="relative">
                        <button
                          onClick={outOfStock ? undefined : () => addToOrder(item)}
                          className={`p-3 bg-gray-50 rounded-md border border-gray-200 transition-all text-left w-full ${outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:bg-blue-50 hover:border-blue-300'}`}
                        >
                          <div className="font-semibold text-gray-900 mb-1">{item.name}</div>
                          
                          <div className="text-lg font-bold text-blue-600">{item.price.toLocaleString()} ₫</div>
                        </button>
                        {outOfStock && (
                          <div className="absolute inset-0 flex items-start justify-center pt-3 pointer-events-none">
                            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow">
                              Hết nguyên liệu
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Side - Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-md border border-gray-200 p-3 sticky top-4 max-h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex items-center gap-1.5 mb-4 shrink-0">
              <ShoppingCart className="size-4 text-gray-600" />
              <h2 className="text-sm font-semibold text-gray-900">Đơn hàng</h2>
              <span className="ml-auto bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                {orderItems.reduce((sum, item) => sum + item.quantity, 0)} món
              </span>
            </div>

            {orderItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Chưa có món nào</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-1 overflow-y-auto mb-4 min-h-0">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-1.5 pb-3 border-b border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{item.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {item.price.toLocaleString()} ₫
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-6 h-6 rounded bg-red-50 hover:bg-red-100 flex items-center justify-center ml-1"
                        >
                          <Trash2 className="size-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-1 shrink-0">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Tạm tính:</span>
                    <span className="font-medium">{calculateTotal().toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">VAT (10%):</span>
                    <span className="font-medium">{(calculateTotal() * 0.1).toLocaleString()} ₫</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                    <span>Tổng cộng:</span>
                    <span className="text-blue-600">{(calculateTotal() * 1.1).toLocaleString()} ₫</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 shrink-0">
                  <button
                    onClick={handleOrder}
                    className="w-full py-2 bg-orange-500 text-white rounded-md font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="size-3.5" />
                    Gửi Order
                  </button>
                  <button
                    onClick={() => alert("In hóa đơn tạm")}
                    className="w-full py-1.5 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Printer className="size-3.5" />
                    In tạm
                  </button>
                  <button
                    onClick={() => setShowPayment(true)}
                    className="w-full py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="size-3.5" />
                    Thanh toán
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-md max-w-md w-full p-3 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Thanh toán</h2>

            <div className="bg-gray-50 rounded-md p-3 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Tổng tiền:</span>
                <span className="font-semibold">{calculateTotal().toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">VAT (10%):</span>
                <span className="font-semibold">{(calculateTotal() * 0.1).toLocaleString()} ₫</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                <span>Khách cần trả:</span>
                <span className="text-blue-600">{(calculateTotal() * 1.1).toLocaleString()} ₫</span>
              </div>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => handlePayment('cash')}
                className="w-full py-2 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Banknote className="size-3.5" />
                Tiền mặt
              </button>
              <button
                onClick={() => handlePayment('card')}
                className="w-full py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <CreditCard className="size-3.5" />
                Thẻ / Chuyển khoản
              </button>
              <button
                onClick={() => setShowPayment(false)}
                className="w-full py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
