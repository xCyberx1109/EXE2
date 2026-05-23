import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Smartphone, LogOut, Wifi, WifiOff, Clock, ShoppingCart, Loader2, CookingPot, ChefHat } from 'lucide-react';
import { posAuthApi, clearAllPosStorage, getPosToken } from '../api/posServices';
import { ordersApi } from '../api/services';
import type { PosProfile, KitchenOrder, KitchenOrderItem } from '../types';

const PING_INTERVAL = 30000;
const KITCHEN_POLL_INTERVAL = 10000;

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PREPARING: 'bg-blue-100 text-blue-800',
    SERVED: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<string, string> = {
    PENDING: 'Chờ làm',
    PREPARING: 'Đang làm',
    SERVED: 'Đã phục vụ',
    COMPLETED: 'Hoàn tất',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}

function KitchenQueue() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);

  const fetchOrders = async () => {
    try {
      const data = await ordersApi.list();
      const pending = data
        .filter((o: any) => ['PENDING', 'PREPARING'].includes(o.status))
        .map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || `ORD-${o.id.slice(0, 8)}`,
          tableNumber: o.table,
          status: o.status || 'PENDING',
          createdAt: o.time || o.createdAt,
          items: (o.items || []).map((i: any) => ({
            id: i.id || i.menuItemId,
            name: i.name,
            quantity: i.quantity,
            note: i.note,
          })),
        }));
      setOrders(pending);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, KITCHEN_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    );
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <ChefHat className="w-16 h-16 mb-4" />
        <p className="text-lg font-medium">Không có món cần làm</p>
        <p className="text-sm mt-1">Chờ order mới từ POS...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <CookingPot className="w-5 h-5 text-orange-500" />
          Món cần làm ({orders.length})
        </h2>
        <button
          onClick={fetchOrders}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Làm mới
        </button>
      </div>
      <div className="grid gap-3">
        {orders.map(order => (
          <div
            key={order.id}
            className={`bg-white rounded-lg border p-4 ${
              order.status === 'PREPARING' ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-mono font-bold text-gray-900">{order.orderNumber}</span>
                <span className="ml-2 text-sm text-gray-500">
                  Bàn {order.tableNumber || '---'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status} />
                <span className="text-xs text-gray-400">{formatTime(order.createdAt)}</span>
              </div>
            </div>
            <div className="space-y-1 mb-3">
              {order.items.map((item: KitchenOrderItem) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    <span className="font-medium text-gray-900 mr-1">x{item.quantity}</span>
                    {item.name}
                  </span>
                  {item.note && <span className="text-xs text-orange-600 italic">{item.note}</span>}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              {order.status === 'PENDING' && (
                <button
                  onClick={() => handleStatusChange(order.id, 'PREPARING')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Bắt đầu làm
                </button>
              )}
              {order.status === 'PREPARING' && (
                <button
                  onClick={() => handleStatusChange(order.id, 'SERVED')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Đã xong
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashierDashboard({ profile, lastPing }: { profile: PosProfile; lastPing: string | null }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{profile.ordersToday ?? 0}</p>
              <p className="text-xs text-gray-500">Đơn hôm nay</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {profile.currentShift
                  ? new Date(profile.currentShift.startTime).toLocaleTimeString('vi-VN')
                  : 'Chưa có ca'}
              </p>
              <p className="text-xs text-gray-500">
                {profile.currentShift?.isOnline ? 'Ca đang hoạt động' : 'Ca đã đóng'}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Thông tin thiết bị</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Tên thiết bị</p>
            <p className="font-medium text-gray-900">{profile.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Mã thiết bị</p>
            <p className="font-medium text-gray-900 font-mono">{profile.deviceCode}</p>
          </div>
          <div>
            <p className="text-gray-500">Chi nhánh</p>
            <p className="font-medium text-gray-900">{profile.branch?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-500">Chế độ</p>
            <p className="font-medium text-gray-900">
              {profile.mode === 'CASHIER' ? 'Thu ngân' : profile.mode === 'KITCHEN' ? 'Bếp' : 'Kết hợp'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Trạng thái</p>
            <p className="font-medium text-gray-900">{profile.status === 'ONLINE' ? 'Trực tuyến' : 'Ngoại tuyến'}</p>
          </div>
          <div>
            <p className="text-gray-500">Hoạt động cuối</p>
            <p className="font-medium text-gray-900">
              {lastPing ? new Date(lastPing).toLocaleString('vi-VN') : 'N/A'}
            </p>
          </div>
        </div>
      </div>
      {lastPing && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Ping gần nhất: {new Date(lastPing).toLocaleString('vi-VN')}
        </p>
      )}
    </div>
  );
}

export function PosDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PosProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastPing, setLastPing] = useState<string | null>(null);

  useEffect(() => {
    if (!getPosToken()) {
      navigate('/pos/login', { replace: true });
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await posAuthApi.profile();
        setProfile(data);
        setLastPing(data.lastActive);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Phiên đăng nhập hết hạn';
        setError(msg);
        clearAllPosStorage();
        navigate('/pos/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();

    pingRef.current = setInterval(async () => {
      try {
        const result = await posAuthApi.ping();
        setLastPing(result.lastActive);
      } catch { /* silently fail, let the next ping recover */ }
    }, PING_INTERVAL);

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await posAuthApi.logout();
    } catch { /* ignore */ }
    clearAllPosStorage();
    navigate('/pos/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Không thể tải thông tin'}</p>
          <button
            onClick={() => navigate('/pos/login')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg"
          >
            Đăng nhập lại
          </button>
        </div>
      </div>
    );
  }

  const header = (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="font-semibold text-gray-900">{profile.name}</h1>
            <p className="text-xs text-gray-500 font-mono">{profile.deviceCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {profile.mode === 'CASHIER' ? 'Thu ngân' : profile.mode === 'KITCHEN' ? 'Bếp' : 'Kết hợp'}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {profile.status === 'ONLINE' ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-gray-400" />
            )}
            {profile.status === 'ONLINE' ? 'Trực tuyến' : 'Ngoại tuyến'}
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );

  // Mode-based rendering
  if (profile.mode === 'KITCHEN') {
    return (
      <div className="min-h-screen bg-gray-50">
        {header}
        <main className="max-w-4xl mx-auto p-4">
          <KitchenQueue />
        </main>
      </div>
    );
  }

  if (profile.mode === 'HYBRID') {
    return (
      <div className="min-h-screen bg-gray-50">
        {header}
        <main className="max-w-6xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <CashierDashboard profile={profile} lastPing={lastPing} />
            </div>
            <div className="lg:border-l lg:border-gray-200 lg:pl-6">
              <KitchenQueue />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Default: CASHIER mode
  return (
    <div className="min-h-screen bg-gray-50">
      {header}
      <main className="p-4">
        <CashierDashboard profile={profile} lastPing={lastPing} />
      </main>
    </div>
  );
}
