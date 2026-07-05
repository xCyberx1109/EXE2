import { useState, useMemo } from 'react';
import { FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { taxRecords as initialTaxRecords, TaxRecord } from '../data/mockData';
import { DataTable, type Column } from '../components/DataTable';

export function TaxManagement() {
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>(initialTaxRecords);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    month: new Date().toISOString().slice(0, 7),
    revenue: '',
    taxRate: 10,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        return <CheckCircle className="size-4 text-green-600" />;
      case 'pending':
        return <Clock className="size-4 text-orange-600" />;
      case 'overdue':
        return <AlertCircle className="size-4 text-red-600" />;
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

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return taxRecords.slice(start, start + pageSize);
  }, [taxRecords, page, pageSize]);

  const pagination = useMemo(() => taxRecords.length > pageSize ? {
    page,
    limit: pageSize,
    total: taxRecords.length,
    totalPages: Math.ceil(taxRecords.length / pageSize),
  } : undefined, [taxRecords, page, pageSize]);

  const columns: Column<TaxRecord>[] = [
    { key: 'taxPeriod', header: 'Kỳ tính thuế', render: (record) => {
      const monthDate = new Date(record.month + '-01');
      const monthName = monthDate.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' });
      return (
        <div className="flex items-center gap-1.5">
          {getStatusIcon(record.status)}
          <span className="font-medium text-foreground">{monthName}</span>
        </div>
      );
    }},
    { key: 'revenue', header: 'Doanh thu', render: (record) => <span className="font-medium text-foreground">{record.revenue.toLocaleString()} ₫</span> },
    { key: 'taxRate', header: 'Thuế suất', render: (record) => <span>{record.taxRate}%</span> },
    { key: 'taxAmount', header: 'Số tiền thuế', render: (record) => <span className="font-bold text-blue-600">{record.taxAmount.toLocaleString()} ₫</span> },
    { key: 'status', header: 'Trạng thái', render: (record) => getStatusBadge(record.status) },
    { key: 'actions', header: 'Thao tác', className: 'text-right', render: (record) => (
      <div className="text-right">
        {record.status === 'pending' && (
          <button onClick={() => handleUpdateStatus(record.id, 'paid')} className="text-xs font-medium text-green-600 hover:text-green-900 mr-3">Đánh dấu đã thanh toán</button>
        )}
        {record.status === 'paid' && (
          <button onClick={() => handleUpdateStatus(record.id, 'pending')} className="text-xs font-medium text-orange-600 hover:text-orange-900">Hoàn tác</button>
        )}
      </div>
    )},
  ];

  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Quản lý Thuế</h1>
          <p className="text-muted-foreground mt-1">Theo dõi và quản lý nghĩa vụ thuế</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
        >
          <FileText className="size-3.5" />
          Khai báo thuế mới
        </button>
      </div>

      {/* Stats Grid */}
      <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1.5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-card rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{stat.name}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-md ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={paginatedRecords}
        keyExtractor={(record) => record.id}
        emptyMessage="Chưa có kỳ khai báo thuế nào."
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      {/* Tax Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
        <div className="bg-card rounded-md border border-border p-3">
          <h2 className="text-sm font-semibold text-foreground mb-3">Thông tin thuế GTGT</h2>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Thuế suất áp dụng:</span>
              <span className="font-medium text-foreground">10%</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Phương pháp tính:</span>
              <span className="font-medium text-foreground">Trực tiếp trên doanh thu</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Kỳ khai báo:</span>
              <span className="font-medium text-foreground">Hàng tháng</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Hạn nộp thuế:</span>
              <span className="font-medium text-foreground">Ngày 20 tháng sau</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-md border border-blue-200 p-3">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">Lưu ý quan trọng</h2>
          <ul className="space-y-1 text-xs text-blue-800">
            <li className="flex items-start gap-1.5">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Khai báo thuế đúng hạn để tránh bị phạt chậm nộp</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Lưu trữ đầy đủ hóa đơn chứng từ liên quan</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Kiểm tra kỹ số liệu trước khi nộp hồ sơ</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>Tham khảo chuyên gia thuế khi có thay đổi chính sách</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-50">
          <div className="bg-card rounded-md max-w-md w-full p-3">
            <h2 className="text-lg font-bold text-foreground mb-3">Khai báo thuế mới</h2>
            <form onSubmit={handleSubmit} className="space-y-1">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Kỳ tính thuế</label>
                <input
                  type="month"
                  required
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                  className="w-full px-2 py-1.5 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Doanh thu (₫)</label>
                <input
                  type="number"
                  required
                  value={formData.revenue}
                  onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                  className="w-full px-2 py-1.5 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Nhập doanh thu"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Thuế suất (%)</label>
                <select
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                </select>
              </div>
              <div className="bg-muted rounded-md p-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Số tiền thuế phải nộp:</span>
                  <span className="text-base font-bold text-blue-600">
                    {((Number(formData.revenue) * formData.taxRate) / 100).toLocaleString()} ₫
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-3 py-1.5 border border-input text-foreground rounded-md hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90"
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
