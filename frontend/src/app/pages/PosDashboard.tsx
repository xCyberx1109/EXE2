import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Smartphone, LogOut, Wifi, WifiOff, Clock, ShoppingCart, Loader2 } from 'lucide-react';
import { posAuthApi, clearAllPosStorage, getPosToken } from '../api/posServices';
import type { PosProfile } from '../types';

const PING_INTERVAL = 30000;

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="font-semibold text-gray-900">{profile?.name || 'POS'}</h1>
              <p className="text-xs text-gray-500 font-mono">{profile?.deviceCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {profile?.status === 'ONLINE' ? (
                <Wifi className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-gray-400" />
              )}
              {profile?.status === 'ONLINE' ? 'Trực tuyến' : 'Ngoại tuyến'}
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

      <main className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile?.ordersToday ?? 0}</p>
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
                  {profile?.currentShift
                    ? new Date(profile.currentShift.startTime).toLocaleTimeString('vi-VN')
                    : 'Chưa có ca'}
                </p>
                <p className="text-xs text-gray-500">
                  {profile?.currentShift?.isOnline ? 'Ca đang hoạt động' : 'Ca đã đóng'}
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
              <p className="font-medium text-gray-900">{profile?.name}</p>
            </div>
            <div>
              <p className="text-gray-500">Mã thiết bị</p>
              <p className="font-medium text-gray-900 font-mono">{profile?.deviceCode}</p>
            </div>
            <div>
              <p className="text-gray-500">Chi nhánh</p>
              <p className="font-medium text-gray-900">{profile?.branch?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-500">Loại thiết bị</p>
              <p className="font-medium text-gray-900">{profile?.type}</p>
            </div>
            <div>
              <p className="text-gray-500">Trạng thái</p>
              <p className="font-medium text-gray-900">{profile?.status === 'ONLINE' ? 'Trực tuyến' : 'Ngoại tuyến'}</p>
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
      </main>
    </div>
  );
}
