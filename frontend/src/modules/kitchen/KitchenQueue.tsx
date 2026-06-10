import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import { Button } from '../../app/components/ui/button';
import { Clock, ChefHat, CheckCircle2, ArrowUpDown, Timer, AlertTriangle } from 'lucide-react';
import { APP_NAME } from '../../shared/constants';
import { useAuth } from '../../app/context/AuthContext';
import { useKitchenQueue, useUpdateKitchenStatusMutation } from '../../app/api/hooks';
import type { KitchenOrder } from '../../app/api/hooks';

const STATUS_CONFIG: Record<string, { label: string; color: string; nextStatus: string | null; icon: any }> = {
  PENDING: { label: 'Chờ', color: 'bg-gray-100 text-gray-700', nextStatus: 'RECEIVED', icon: Timer },
  RECEIVED: { label: 'Đã nhận', color: 'bg-blue-100 text-blue-700', nextStatus: 'PREPARING', icon: ChefHat },
  PREPARING: { label: 'Đang nấu', color: 'bg-yellow-100 text-yellow-700', nextStatus: 'READY', icon: ChefHat },
  READY: { label: 'Hoàn thành', color: 'bg-green-100 text-green-700', nextStatus: 'SERVED', icon: CheckCircle2 },
  SERVED: { label: 'Đã phục vụ', color: 'bg-purple-100 text-purple-700', nextStatus: null, icon: CheckCircle2 },
  CANCELLED: { label: 'Đã hủy', color: 'bg-red-100 text-red-700', nextStatus: null, icon: AlertTriangle },
};

type SortMode = 'time' | 'priority' | 'status';
type FilterStatus = 'all' | 'PENDING' | 'RECEIVED' | 'PREPARING' | 'READY';

export function KitchenQueue() {
  const { hasDevicePermission } = useAuth();
  const { data: orders = [], isLoading, error: queryError } = useKitchenQueue();
  const updateStatusMutation = useUpdateKitchenStatusMutation();
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const canUpdateStatus = hasDevicePermission('kitchen:update_status');

  const handleUpdateStatus = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Không thể tải dữ liệu bếp') : '';

  const filteredOrders = useMemo(() => orders
    .filter((o) => filterStatus === 'all' || o.status === filterStatus)
    .filter((o) => o.status !== 'SERVED' && o.status !== 'CANCELLED')
    .sort((a, b) => {
      const elapsedA = Date.now() - new Date(a.createdAt).getTime();
      const elapsedB = Date.now() - new Date(b.createdAt).getTime();
      if (sortMode === 'priority') return b.priority - a.priority || elapsedA - elapsedB;
      if (sortMode === 'time') return elapsedA - elapsedB;
      return a.status.localeCompare(b.status);
    }), [orders, filterStatus, sortMode]);

  const formatElapsed = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h${mins % 60}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Clock className="w-6 h-6 animate-spin mr-2" />
        Đang tải {APP_NAME} hàng chờ bếp...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-lg border p-1">
          {(['all', 'PENDING', 'RECEIVED', 'PREPARING', 'READY'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                filterStatus === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? 'Tất cả' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-sm text-gray-500 mr-1">Sắp xếp:</span>
          {(['time', 'priority', 'status'] as SortMode[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortMode(s)}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                sortMode === s ? 'bg-gray-800 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ArrowUpDown className="w-3 h-3" />
              {s === 'time' ? 'Thời gian' : s === 'priority' ? 'Ưu tiên' : 'Trạng thái'}
            </button>
          ))}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ml-2 ${
              autoRefresh ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
            title={autoRefresh ? 'Tự động cập nhật' : 'Dừng tự động cập nhật'}
          >
            <Timer className="w-3 h-3" />
            {autoRefresh ? 'Live' : 'Dừng'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ChefHat className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Không có món nào trong hàng chờ</p>
          <p className="text-sm">Hàng chờ bếp đang trống</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusCfg.icon;
            return (
              <Card key={order.id} className={`border-l-4 ${order.priority > 0 ? 'border-l-red-500' : 'border-l-blue-500'}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        #{order.kotNumber}
                        {order.tableNumber && (
                          <Badge variant="outline">Bàn {order.tableNumber}</Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Đơn #{order.orderNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusCfg.color}>
                        <StatusIcon className="w-3 h-3 mr-1 inline" />
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-xs text-gray-400 mb-2">
                    <Timer className="w-3 h-3 mr-1" />
                    <span className={order.elapsed > 30 * 60 * 1000 ? 'text-red-500 font-bold' : ''}>
                      {formatElapsed(order.elapsed)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm py-0.5">
                        <span>
                          <span className="font-medium text-gray-800">x{item.quantity || 1}</span>{' '}
                          {item.name || item.menuItem?.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.note && (
                    <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      Ghi chú: {order.note}
                    </div>
                  )}

                  {canUpdateStatus && statusCfg.nextStatus && (
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => handleUpdateStatus(order.id, statusCfg.nextStatus!)}
                      disabled={updateStatusMutation.isPending}
                    >
                      Chuyển → {STATUS_CONFIG[statusCfg.nextStatus]?.label}
                    </Button>
                  )}
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
