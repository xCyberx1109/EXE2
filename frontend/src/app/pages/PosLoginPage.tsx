import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Smartphone, Loader2 } from 'lucide-react';
import { posAuthApi, setPosToken, setPosDeviceCode, getPosToken } from '../api/posServices';

export function PosLoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getPosToken()) {
      posAuthApi.profile().then(() => {
        navigate('/pos/dashboard', { replace: true });
      }).catch(() => {});
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pin.trim() || pin.length !== 6) {
      setError('Vui lòng nhập mã PIN 6 chữ số');
      return;
    }

    setLoading(true);
    try {
      const result = await posAuthApi.login(pin.trim());
      setPosToken(result.token);
      setPosDeviceCode(result.device.deviceCode);
      navigate('/pos/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Đăng nhập POS</h1>
          <p className="text-sm text-gray-500 mt-1">Nhập mã PIN để đăng nhập</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Mã PIN (6 số)</label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Nhập 6 chữ số"
              maxLength={6}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-center tracking-widest text-2xl font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || pin.length !== 6}
            className="w-full py-3 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Liên hệ quản lý nếu bạn chưa có mã PIN
          </p>
        </form>
      </div>
    </div>
  );
}
