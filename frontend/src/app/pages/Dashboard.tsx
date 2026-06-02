import { useEffect, useState } from 'react';
import { DollarSign, Package, UtensilsCrossed, TrendingUp, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { dashboardApi } from '../api/services';
import type { DashboardData } from '../types';

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .get()
      .then(setData)
      .catch((err) => setError(err.message || 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-red-600">
        {error || 'Không có dữ liệu'}
      </div>
    );
  }

  const { stats, topMenuItems, lowStockItems } = data;

  const statCards = [
    {
      name: 'Tổng doanh thu',
      value: `${(stats.totalRevenue / 1000000).toFixed(1)}M ₫`,
      change: '30 ngày qua',
      icon: DollarSign,
      color: 'bg-green-50 text-green-700',
      link: '/revenue',
    },
    {
      name: 'Lợi nhuận',
      value: `${(stats.totalProfit / 1000000).toFixed(1)}M ₫`,
      change: '30 ngày qua',
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-700',
      link: '/revenue',
    },
    {
      name: 'Món ăn khả dụng',
      value: stats.availableMenuItems,
      change: `${stats.availableMenuItems} đang bán`,
      icon: UtensilsCrossed,
      color: 'bg-purple-50 text-purple-700',
      link: '/menu',
    },
    {
      name: 'Cảnh báo tồn kho',
      value: stats.lowStockCount,
      change: 'Cần nhập hàng',
      icon: Package,
      color: 'bg-orange-50 text-orange-700',
      link: '/inventory',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 mt-1">Thống kê tổng quan hệ thống quản lý F&B</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              to={stat.link}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cảnh báo tồn kho thấp</h2>
          <div className="space-y-3">
              {lowStockItems.length > 0 ? (
              lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">Tồn: {item.quantity} / {item.warningQuantity} {item.unit}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    ⚠ Sắp hết
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Tất cả hàng hóa đều đủ số lượng</p>
            )}
          </div>
          <Link to="/inventory" className="block mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Xem tất cả →
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Menu phổ biến</h2>
          <div className="space-y-3">
            {topMenuItems.map((item, index) => (
              <div key={item.menuItemId} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium text-gray-700">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.category}</p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900">{(item.price || 0).toLocaleString()} ₫</p>
              </div>
            ))}
          </div>
          <Link to="/menu" className="block mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Xem menu đầy đủ →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Thống kê nhanh (30 ngày qua)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Tổng đơn hàng</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalOrders.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Doanh thu (30 ngày)</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {(stats.totalRevenue / 1000000).toFixed(2)}M ₫
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tỷ suất lợi nhuận</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {stats.totalRevenue > 0
                ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
