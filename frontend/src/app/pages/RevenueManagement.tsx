import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Percent, Loader2 } from 'lucide-react';
import { revenueApi } from '../api/services';
import { DailyOrdersPanel } from '../components/DailyOrdersPanel';
import type { RevenueRecord, TopSellingItem } from '../types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export function RevenueManagement() {
  const [timeRange, setTimeRange] = useState<'7days' | '14days' | '30days'>('14days');
  const [filteredData, setFilteredData] = useState<RevenueRecord[]>([]);
  const [topFoods, setTopFoods] = useState<TopSellingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [daily, top] = await Promise.all([
          revenueApi.daily(timeRange),
          revenueApi.topItems(8),
        ]);
        setFilteredData(daily);
        setTopFoods(top);
      } catch (err) {
        console.error(err);
        alert('Không tải được doanh thu. Kiểm tra backend.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [timeRange]);

  const safeData = filteredData;
  const displayData = [...safeData].reverse();

  const totalRevenue = safeData.reduce((sum, record) => sum + record.revenue, 0);
  const totalProfit = safeData.reduce((sum, record) => sum + record.profit, 0);
  const totalOrders = safeData.reduce((sum, record) => sum + record.orderCount, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const chartData = safeData.map(record => ({
    date: new Date(record.date).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
    'Doanh thu': record.revenue / 1000,
    'Chi phí': record.cost / 1000,
    'Lợi nhuận': record.profit / 1000,
  }));

  const orderData = safeData.map(record => ({
    date: new Date(record.date).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }),
    'Số đơn': record.orderCount,
  }));

  const pieData = [
    { name: 'Lợi nhuận', value: totalProfit },
    { name: 'Chi phí', value: totalRevenue - totalProfit },
  ];

  const stats = [
    {
      name: 'Tổng doanh thu',
      value: `${(totalRevenue / 1000000).toFixed(1)}M ₫`,
      change: '+12.5%',
      icon: DollarSign,
      color: 'bg-green-50 text-green-700',
    },
    {
      name: 'Tổng lợi nhuận',
      value: `${(totalProfit / 1000000).toFixed(1)}M ₫`,
      change: '+8.2%',
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      name: 'Tổng đơn hàng',
      value: totalOrders.toLocaleString(),
      change: safeData.length > 0 ? `${(totalOrders / safeData.length).toFixed(0)}/ngày` : '0/ngày',
      icon: ShoppingCart,
      color: 'bg-purple-50 text-purple-700',
    },
    {
      name: 'Tỷ suất lợi nhuận',
      value: `${profitMargin.toFixed(1)}%`,
      change: 'Khỏe mạnh',
      icon: Percent,
      color: 'bg-orange-50 text-orange-700',
    },
  ];

  if (loading && filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải doanh thu...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Doanh thu</h1>
          <p className="text-gray-500 mt-1">Theo dõi và phân tích doanh thu, lợi nhuận</p>
        </div>
        <div className="flex gap-2">
          {(['7days', '14days', '30days'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              {range === '7days' ? '7 ngày' : range === '14days' ? '14 ngày' : '30 ngày'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className="text-xs text-green-600 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Biểu đồ Doanh thu & Lợi nhuận</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis label={{ value: 'Nghìn đồng', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => `${Number(value).toLocaleString()}k ₫`} />
            <Legend />
            <Bar dataKey="Doanh thu" fill="#3B82F6" />
            <Bar dataKey="Chi phí" fill="#EF4444" />
            <Bar dataKey="Lợi nhuận" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Xu hướng Đơn hàng</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={orderData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Số đơn" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phân bổ Lợi nhuận</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[pieData.indexOf(entry) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${(Number(value) / 1000000).toFixed(1)}M ₫`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <DailyOrdersPanel />

      {/* Detailed Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Chi tiết theo ngày</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số đơn</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doanh thu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chi phí</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lợi nhuận</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TB/Đơn</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tỷ suất LN</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayData.map((record) => {
                const avgOrder = record.revenue / record.orderCount;
                const margin = (record.profit / record.revenue) * 100;
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString('vi-VN', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.orderCount}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">{record.revenue.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm text-red-600">{record.cost.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm font-semibold text-blue-600">{record.profit.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{avgOrder.toLocaleString()} ₫</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${margin >= 50 ? 'bg-green-100 text-green-800' :
                        margin >= 40 ? 'bg-blue-100 text-blue-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-4">Tóm tắt phân tích</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-medium">• Giá trị đơn hàng trung bình: <span className="text-blue-900 font-bold">{avgOrderValue.toLocaleString()} ₫</span></p>
            <p className="font-medium mt-2">• Doanh thu trung bình/ngày: <span className="text-blue-900 font-bold">{safeData.length > 0 ? (totalRevenue / safeData.length).toLocaleString() : 0} ₫</span></p>
          </div>
          <div>
            <p className="font-medium">• Lợi nhuận trung bình/đơn: <span className="text-blue-900 font-bold">{(totalProfit / totalOrders).toLocaleString()} ₫</span></p>
            <p className="font-medium mt-2">• Tỷ suất lợi nhuận tổng thể: <span className="text-blue-900 font-bold">{profitMargin.toFixed(1)}%</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}