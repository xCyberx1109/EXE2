import { useState, useEffect } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import { Card } from '../../app/components/ui/card';
import { apiFetch } from '../../app/api/client';
import { ChefHat, Clock } from 'lucide-react';

interface KitchenItem {
  id: string;
  orderNumber: string;
  table: string;
  items: Array<{ id: string; name: string; quantity: number; status: string }>;
  note: string;
  createdAt: string;
}

export function PosKitchenPage() {
  const { hasPermission } = useAuth();
  const [queue, setQueue] = useState<KitchenItem[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiFetch<any>('/orders/kitchen-queue', { auth: false,
          headers: { 'Authorization': `Bearer ${localStorage.getItem('fnb_pos_machine_token')}` }
        } as any);
        setQueue(Array.isArray(res) ? res : res?.data || []);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 10000);
    return () => clearInterval(id);
  }, []);

  if (!hasPermission('POS_ORDER_QUEUE_VIEW')) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Bạn không có quyền xem hàng chờ bếp</div>;
  }

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center gap-2">
        <ChefHat className="w-6 h-6 text-muted-foreground" />
        <h2 className="text-xl font-bold text-foreground">Hàng chờ bếp</h2>
        <span className="ml-auto text-sm text-muted-foreground">
          <Clock className="w-4 h-4 inline mr-1" />
          {queue.length} đơn chờ
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queue.map((order) => (
          <Card key={order.id} className="p-4 border-l-4 border-l-orange-400">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{order.orderNumber}</h3>
                <p className="text-sm text-muted-foreground">Bàn {order.table}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString()}</span>
            </div>
            {order.note && <p className="text-xs text-amber-600 mb-2">📝 {order.note}</p>}
            <div className="space-y-1">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                  <span>{item.name} × {item.quantity}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${item.status === 'COOKING' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                    {item.status === 'COOKING' ? 'Nấu' : 'Chờ'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {queue.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <ChefHat className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Không có đơn hàng nào trong hàng chờ</p>
          </div>
        )}
      </div>
    </div>
  );
}
