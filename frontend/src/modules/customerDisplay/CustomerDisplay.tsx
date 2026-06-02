import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import { useAuth } from '../../app/context/AuthContext';
import { apiFetch } from '../../app/api/client';
import { ChefHat, Timer } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xử lý', color: 'text-gray-500' },
  RECEIVED: { label: 'Đã nhận', color: 'text-blue-600' },
  PREPARING: { label: 'Đang chế biến', color: 'text-yellow-600' },
  READY: { label: 'Hoàn thành', color: 'text-green-600' },
  SERVED: { label: 'Đã phục vụ', color: 'text-purple-600' },
};

export function CustomerDisplay() {
  const { branchInfo } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await apiFetch<{ orders: any[] }>('/orders/daily?status=PREPARING,READY', { auth: false });
        setOrders(data.orders || []);
      } catch {
        // silent
      }
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">{branchInfo?.name || 'Nhà hàng'}</h1>
          <p className="text-gray-500 mt-1">Trạng thái đơn hàng</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <ChefHat className="w-20 h-20 mx-auto text-gray-300 mb-4" />
            <p className="text-xl text-gray-400">Chưa có đơn hàng nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order: any) => {
              const statusInfo = STATUS_LABELS[order.kitchenStatus || order.status] || STATUS_LABELS.PENDING;
              return (
                <Card key={order.id} className="shadow-lg border-0 overflow-hidden">
                  <div className={`h-2 ${order.kitchenStatus === 'READY' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold">Đơn #{order.orderNumber?.slice(-4) || order.id?.slice(0, 6)}</h2>
                        {order.tableNumber && (
                          <p className="text-sm text-gray-500">Bàn {order.tableNumber}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`${statusInfo.color} text-sm`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {(order.items || []).slice(0, 5).map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>
                            <span className="font-medium">x{item.quantity}</span> {item.name}
                          </span>
                        </div>
                      ))}
                      {order.items?.length > 5 && (
                        <p className="text-xs text-gray-400">+{order.items.length - 5} món khác</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
                      <Timer className="w-3 h-3" />
                      <span>{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
