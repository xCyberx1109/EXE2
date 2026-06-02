import { useState } from 'react';
import { FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { taxRecords as initialTaxRecords, TaxRecord } from '../data/mockData';

export function TaxManagement() {
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>(initialTaxRecords);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    month: new Date().toISOString().slice(0, 7),
    revenue: '',
    taxRate: 10,
  });

  const totalTax = taxRecords.reduce((sum, record) => sum + record.taxAmount, 0);
  const paidTax = taxRecords
    .filter(record => record.status === 'paid')
    .reduce((sum, record) => sum + record.taxAmount, 0);
  const pendingTax = taxRecords
    .filter(record => record.status === 'pending')
    .reduce((sum, record) => sum + record.taxAmount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const revenue = Number(formData.revenue);
    const taxAmount = (revenue * formData.taxRate) / 100;
    const newRecord: TaxRecord = {
      id: String(Date.now()),
      month: formData.month,
      revenue,
      taxRate: formData.taxRate,
      taxAmount,
      status: 'pending',
    };
    setTaxRecords([...taxRecords, newRecord]);
    setShowForm(false);
    setFormData({
      month: new Date().toISOString().slice(0, 7),
      revenue: '',
      taxRate: 10,
    });
  };

  const handleUpdateStatus = (id: string, status: TaxRecord['status']) => {
    setTaxRecords(records =>
      records.map(record =>
        record.id === id ? { ...record, status } : record
      )
    );
  };

  const getStatusIcon = (status: TaxRecord['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusBadge = (status: TaxRecord['status']) => {
    const styles = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-orange-100 text-orange-800',
      overdue: 'bg-red-100 text-red-800',
    };
    const labels = {
      paid: 'Đã thanh toán',
      pending: 'Chờ thanh toán',
      overdue: 'Quá hạn',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const stats = [
    {
      name: 'Tổng thuế phải nộp',
      value: `${(totalTax / 1000000).toFixed(1)}M ₫`,
      icon: DollarSign,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      name: 'Đã thanh toán',
      value: `${(paidTax / 1000000).toFixed(1)}M ₫`,
      icon: CheckCircle,
      color: 'bg-green-50 text-green-700',
    },
    {
      name: 'Chờ thanh toán',
      value: `${(pendingTax / 1000000).toFixed(1)}M ₫`,
      icon: Clock,
      color: 'bg-orange-50 text-orange-700',
    },
    {
      name: 'Kỳ khai báo',
      value: taxRecords.length,
      icon: Calendar,
      color: 'bg-purple-50 text-purple-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Thuế</h1>
          <p className="text-gray-500 mt-1">Theo dõi và quản lý nghĩa vụ thuế</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FileText className="w-5 h-5" />
          Khai báo thuế mới
        </button>
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
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tax Records Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Lịch sử khai báo thuế</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kỳ tính thuế</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doanh thu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thuế suất</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số tiền thuế</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {taxRecords.map((record) => {
                const monthDate = new Date(record.month + '-01');
                const monthName = monthDate.toLocaleDateString('vi-VN', { 
                  year: 'numeric', 
                  month: 'long' 
                });
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(record.status)}
                        <span className="font-medium text-gray-900">{monthName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {record.revenue.toLocaleString()} ₫
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{record.taxRate}%</td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">
                      {record.taxAmount.toLocaleString()} ₫
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(record.status)}</td>
                    <td className="px-6 py-4 text-right">
                      {record.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(record.id, 'paid')}
                          className="text-sm font-medium text-green-600 hover:text-green-900 mr-3"
                        >
                          Đánh dấu đã thanh toán
                        </button>
                      )}
                      {record.status === 'paid' && (
                        <button
                          onClick={() => handleUpdateStatus(record.id, 'pending')}
                          className="text-sm font-medium text-orange-600 hover:text-orange-900"
                        >
                          Hoàn tác
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông tin thuế GTGT</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Thuế suất áp dụng:</span>
              <span className="font-medium text-gray-900">10%</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Phương pháp tính:</span>
              <span className="font-medium text-gray-900">Trực tiếp trên doanh thu</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Kỳ khai báo:</span>
              <span className="font-medium text-gray-900">Hàng tháng</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Hạn nộp thuế:</span>
              <span className="font-medium text-gray-900">Ngày 20 tháng sau</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">Lưu ý quan trọng</h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Khai báo thuế đúng hạn để tránh bị phạt chậm nộp</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Lưu trữ đầy đủ hóa đơn chứng từ liên quan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Kiểm tra kỹ số liệu trước khi nộp hồ sơ</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Tham khảo chuyên gia thuế khi có thay đổi chính sách</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Khai báo thuế mới</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kỳ tính thuế</label>
                <input
                  type="month"
                  required
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doanh thu (₫)</label>
                <input
                  type="number"
                  required
                  value={formData.revenue}
                  onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập doanh thu"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thuế suất (%)</label>
                <select
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                </select>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Số tiền thuế phải nộp:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {((Number(formData.revenue) * formData.taxRate) / 100).toLocaleString()} ₫
                  </span>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Tạo khai báo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
