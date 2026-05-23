import { useEffect, useState, useCallback } from 'react';
import { Plus, Smartphone, RefreshCw, ToggleLeft, ToggleRight, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { posDeviceApi } from '../api/posServices';
import type { PosDevice } from '../types';

const DEVICE_TYPES = [
  { value: 'CASHIER', label: 'Thu ngân' },
  { value: 'TABLET', label: 'Máy tính bảng' },
  { value: 'KIOSK', label: 'Ki-ốt' },
];

export function PosDeviceManagement() {
  const [devices, setDevices] = useState<PosDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', type: 'CASHIER' });
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<PosDevice | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await posDeviceApi.list();
      setDevices(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi tải danh sách';
      alert(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleCreate = async () => {
    if (!newDevice.name.trim()) { alert('Vui lòng nhập tên thiết bị'); return; }
    setCreating(true);
    try {
      const result = await posDeviceApi.create(newDevice);
      setCreatedResult(result);
      setDevices(prev => [result, ...prev]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi tạo thiết bị';
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (device: PosDevice) => {
    try {
      const updated = await posDeviceApi.toggle(device.id, !device.active);
      setDevices(prev => prev.map(d => d.id === device.id ? updated : d));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi cập nhật';
      alert(msg);
    }
  };

  const handleResetPin = async (deviceId: string) => {
    if (!confirm('Bạn có chắc muốn đặt lại PIN? Thiết bị sẽ tự động đăng xuất.')) return;
    try {
      const result = await posDeviceApi.resetPin(deviceId);
      alert(`PIN mới: ${result.devicePin}\nMã thiết bị: ${result.deviceCode}\nVui lòng chuyển thông tin này cho nhân viên.`);
      loadDevices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đặt lại PIN';
      alert(msg);
    }
  };

  const handleDelete = async (device: PosDevice) => {
    if (!confirm(`Xóa thiết bị "${device.name}" (${device.deviceCode})?`)) return;
    try {
      await posDeviceApi.delete(device.id);
      setDevices(prev => prev.filter(d => d.id !== device.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi xóa thiết bị';
      alert(msg);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ONLINE: 'bg-green-100 text-green-800',
      OFFLINE: 'bg-gray-100 text-gray-600',
      MAINTENANCE: 'bg-yellow-100 text-yellow-800',
    };
    const labels: Record<string, string> = {
      ONLINE: 'Trực tuyến',
      OFFLINE: 'Ngoại tuyến',
      MAINTENANCE: 'Bảo trì',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {status === 'ONLINE' && <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />}
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý thiết bị POS</h1>
          <p className="text-sm text-gray-500 mt-1">Tạo và quản lý thiết bị POS cho chi nhánh</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDevices}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Làm mới
          </button>
          <button
            onClick={() => { setShowCreateModal(true); setCreatedResult(null); setNewDevice({ name: '', type: 'CASHIER' }); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Thêm thiết bị
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Đang tải danh sách thiết bị...
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">Chưa có thiết bị POS nào</p>
          <p className="text-sm mt-1">Nhấn "Thêm thiết bị" để tạo thiết bị đầu tiên</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map(device => (
            <div key={device.id} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{device.name}</h3>
                  <p className="text-sm text-gray-500 font-mono mt-0.5">{device.deviceCode}</p>
                </div>
                {getStatusBadge(device.status)}
              </div>

              <div className="text-sm text-gray-600 space-y-1.5 mb-4">
                <p>Loại: {DEVICE_TYPES.find(t => t.value === device.type)?.label || device.type}</p>
                <p>Trạng thái: {device.active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</p>
                {device.lastActive && <p>Hoạt động cuối: {new Date(device.lastActive).toLocaleString('vi-VN')}</p>}
                {device._count && <p>Đơn hôm nay: {device._count.orders}</p>}
                {device.shifts && device.shifts[0] && (
                  <p>Ca hiện tại: {device.shifts[0].account?.fullName || 'Chưa có nhân viên'}</p>
                )}
                {device.branch && <p>Chi nhánh: {device.branch.name}</p>}
              </div>

              <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleToggle(device)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    device.active
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                  title={device.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                >
                  {device.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  {device.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                </button>
                <button
                  onClick={() => handleResetPin(device.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Đặt lại PIN
                </button>
                <button
                  onClick={() => copyToClipboard(device.deviceCode, `code-${device.id}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  {copied === `code-${device.id}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  Mã
                </button>
                <button
                  onClick={() => handleDelete(device)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {createdResult ? 'Thiết bị đã được tạo' : 'Thêm thiết bị POS mới'}
            </h2>

            {createdResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium mb-2">Thiết bị đã được tạo thành công!</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Tên:</span> {createdResult.name}</p>
                    <p><span className="font-medium">Mã thiết bị:</span>
                      <code className="ml-1 px-2 py-0.5 bg-gray-100 rounded font-mono">{createdResult.deviceCode}</code>
                      <button onClick={() => copyToClipboard(createdResult.deviceCode, 'final-code')} className="ml-1 text-blue-600 hover:text-blue-800">
                        {copied === 'final-code' ? <Check className="w-3.5 h-3.5 inline" /> : <Copy className="w-3.5 h-3.5 inline" />}
                      </button>
                    </p>
                    <p><span className="font-medium">PIN:</span>
                      <code className="ml-1 px-2 py-0.5 bg-yellow-100 rounded font-mono text-lg">{createdResult.devicePin}</code>
                      <button onClick={() => copyToClipboard(createdResult.devicePin || '', 'final-pin')} className="ml-1 text-blue-600 hover:text-blue-800">
                        {copied === 'final-pin' ? <Check className="w-3.5 h-3.5 inline" /> : <Copy className="w-3.5 h-3.5 inline" />}
                      </button>
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                  Vui lòng chuyển Mã thiết bị và PIN cho nhân viên để đăng nhập vào ứng dụng POS.
                </div>
                <button
                  onClick={() => { setShowCreateModal(false); setCreatedResult(null); }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên thiết bị</label>
                  <input
                    type="text"
                    value={newDevice.name}
                    onChange={e => setNewDevice(p => ({ ...p, name: e.target.value }))}
                    placeholder="VD: POS quầy 1, POS bàn 5..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại thiết bị</label>
                  <select
                    value={newDevice.type}
                    onChange={e => setNewDevice(p => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {DEVICE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newDevice.name.trim()}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Đang tạo...' : 'Tạo thiết bị'}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
