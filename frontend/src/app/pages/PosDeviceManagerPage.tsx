import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { posDevicesV2Api } from '../api/posServices';
import { APP_NAME } from '../../shared/constants';
import type { PosDeviceV2, PosMode } from '../types';

const STATUS_COLORS: Record<string, string> = {
  PENDING_ACTIVATION: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ACTIVATED: 'bg-green-100 text-green-800 border-green-300',
  ONLINE: 'bg-blue-100 text-blue-800 border-blue-300',
  OFFLINE: 'bg-gray-100 text-gray-800 border-gray-300',
  MAINTENANCE: 'bg-red-100 text-red-800 border-red-300',
};

export function PosDeviceManagerPage() {
  const [devices, setDevices] = useState<PosDeviceV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', type: 'CASHIER', mode: 'CASHIER' as PosMode });
  const [newDeviceResult, setNewDeviceResult] = useState<{
    setupPin: string;
  } | null>(null);
  const [regenerateResult, setRegenerateResult] = useState<{
    deviceId: string; setupPin: string;
  } | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<PosDeviceV2 | null>(null);
  const [logsDialog, setLogsDialog] = useState(false);
  const [deviceLogs, setDeviceLogs] = useState<Array<{ id: string; action: string; details: unknown; createdAt: string }>>([]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const data = await posDevicesV2Api.list();
      setDevices(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tải thiết bị thất bại');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  const handleCreate = async () => {
    try {
      const result = await posDevicesV2Api.create(newDevice);
      setNewDeviceResult({ setupPin: result.setupPin });
      setNewDevice({ name: '', type: 'CASHIER', mode: 'CASHIER' });
      await fetchDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tạo thiết bị thất bại');
    }
  };

  const handleRegeneratePin = async (deviceId: string) => {
    try {
      const result = await posDevicesV2Api.regeneratePin(deviceId);
      setRegenerateResult(result);
      await fetchDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tạo PIN mới thất bại');
    }
  };

  const handleReset = async (deviceId: string) => {
    if (!window.confirm('Đặt lại thiết bị này? Điều này sẽ vô hiệu hóa tất cả phiên làm việc.')) return;
    try {
      const result = await posDevicesV2Api.reset(deviceId);
      setRegenerateResult(result);
      await fetchDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đặt lại thiết bị thất bại');
    }
  };

  const handleRevoke = async (deviceId: string) => {
    const reason = window.prompt('Lý do thu hồi?');
    try {
      await posDevicesV2Api.revoke(deviceId, reason || undefined);
      await fetchDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Thu hồi thiết bị thất bại');
    }
  };

  const handleToggle = async (deviceId: string, active: boolean) => {
    try {
      await posDevicesV2Api.toggle(deviceId, active);
      await fetchDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chuyển đổi thiết bị thất bại');
    }
  };

  const handleDelete = async (deviceId: string) => {
    if (!window.confirm('Xóa vĩnh viễn thiết bị này?')) return;
    try {
      await posDevicesV2Api.delete(deviceId);
      await fetchDevices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xóa thiết bị thất bại');
    }
  };

  const handleViewLogs = async (device: PosDeviceV2) => {
    setSelectedDevice(device);
    try {
      const logs = await posDevicesV2Api.logs(device.id);
      setDeviceLogs(logs);
      setLogsDialog(true);
    } catch {
      setDeviceLogs([]);
      setLogsDialog(true);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quản lý thiết bị {APP_NAME}</h1>
          <p className="text-gray-500">Quản lý tất cả thiết bị {APP_NAME} trong chi nhánh</p>
        </div>
        <Dialog open={createDialog} onOpenChange={setCreateDialog}>
          <DialogTrigger asChild>
            <Button>Tạo thiết bị</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo thiết bị {APP_NAME} mới</DialogTitle>
              <DialogDescription>
                Mã thiết bị và mã PIN sẽ được tạo để kích hoạt lần đầu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Tên thiết bị</label>
                <Input
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  placeholder="VD: Thu ngân-01"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Loại</label>
                <Select
                  value={newDevice.type}
                  onValueChange={(v) => setNewDevice({ ...newDevice, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASHIER">Thu ngân</SelectItem>
                    <SelectItem value="KITCHEN">Bếp</SelectItem>
                    <SelectItem value="WAITER">Phục vụ bàn</SelectItem>
                    <SelectItem value="TABLET">Máy tính bảng</SelectItem>
                    <SelectItem value="KIOSK">KIOSK tự đặt</SelectItem>
                    <SelectItem value="CUSTOMER_DISPLAY">Màn hình khách</SelectItem>
                    <SelectItem value="MANAGER">Quản lý</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Chế độ</label>
                <Select
                  value={newDevice.mode}
                  onValueChange={(v: PosMode) => setNewDevice({ ...newDevice, mode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASHIER">Thu ngân</SelectItem>
                    <SelectItem value="KITCHEN">Hiển thị bếp</SelectItem>
                    <SelectItem value="HYBRID">Kết hợp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newDeviceResult && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription>
                  <div className="font-bold mb-2">Đã tạo thiết bị! Chia sẻ PIN với người thiết lập:</div>
                  <div className="space-y-1 font-mono text-sm">
                    <div>PIN: <strong className="text-lg">{newDeviceResult.setupPin}</strong></div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button onClick={handleCreate} disabled={!newDevice.name}>
                Tạo thiết bị
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {regenerateResult && (
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertDescription>
            <div className="font-bold">Đã tạo mã PIN thiết lập mới</div>
            <div className="font-mono">
              PIN: <strong className="text-lg">{regenerateResult.setupPin}</strong>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setRegenerateResult(null)}>
              Bỏ qua
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Đang tải thiết bị...</div>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Không tìm thấy thiết bị. Tạo thiết bị POS đầu tiên.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <Card key={device.id} className={!device.active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{device.name}</CardTitle>
                  </div>
                  <Badge className={STATUS_COLORS[device.status] || ''} variant="outline">
                    {device.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Loại</span>
                    <span>{device.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chế độ</span>
                    <Badge variant="secondary" className="text-xs">{device.mode}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kích hoạt</span>
                    <span>{device.active ? 'Có' : 'Không'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Đã kích hoạt</span>
                    <span>{device.activatedAt ? new Date(device.activatedAt).toLocaleDateString() : 'Chưa'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phiên bản Token</span>
                    <span className="font-mono text-xs">{device.tokenVersion}</span>
                  </div>
                  {device.currentShift && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ca</span>
                      <span className="text-green-600 font-medium">
                        Đang mở ({device.currentShift.cashier || 'Không có thu ngân'})
                      </span>
                    </div>
                  )}
                  {device.lastActive && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Hoạt động gần nhất</span>
                      <span className="text-xs">{new Date(device.lastActive).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Đơn hôm nay</span>
                    <span className="font-bold">{device.ordersToday}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleRegeneratePin(device.id)}>
                    PIN mới
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReset(device.id)}>
                    Đặt lại
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggle(device.id, !device.active)}
                    className={!device.active ? 'text-green-600' : 'text-amber-600'}
                  >
                    {device.active ? 'Vô hiệu' : 'Kích hoạt'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleViewLogs(device)}>
                    Nhật ký
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleRevoke(device.id)}>
                    Thu hồi
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(device.id)}>
                    Xóa
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Activity Logs Dialog */}
      <Dialog open={logsDialog} onOpenChange={setLogsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nhật ký hoạt động</DialogTitle>
            <DialogDescription>
              {selectedDevice?.name}
            </DialogDescription>
          </DialogHeader>
          {deviceLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Không tìm thấy nhật ký</p>
          ) : (
            <div className="space-y-2">
              {deviceLogs.map((log) => (
                <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-gray-400 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {log.details && (
                    <pre className="text-xs text-gray-500 mt-1 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
