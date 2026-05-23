import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Loader2, LogIn, Eye, EyeOff, Smartphone } from 'lucide-react';
import { posAuthApi, setPosToken, setPosDeviceCode, getPosToken } from '../api/posServices';

type LoginMode = 'admin' | 'pos';

export function LoginPage() {
  const { login, isAuthenticated, isReady, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>('admin');

  const getRedirectPath = (currentUser = user) => {
    if (!currentUser) return '/login';
    if (currentUser.role === 'ADMIN') return '/app/branches';
    if (currentUser.role === 'COOK' || currentUser.role === 'CASHIER') return '/app/pos';
    return '/app';
  };

  // Admin form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // POS form state
  const [deviceCode, setDeviceCode] = useState('');
  const [pin, setPin] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate(getRedirectPath(user), { replace: true });
    }
  }, [isReady, isAuthenticated, user, navigate]);

  // Auto redirect POS if already has POS token
  useEffect(() => {
    if (getPosToken()) {
      posAuthApi.profile().then(() => {
        navigate('/pos/dashboard', { replace: true });
      }).catch(() => {});
    }
  }, [navigate]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Vui lòng nhập email'); return; }
    if (!password.trim()) { setError('Vui lòng nhập mật khẩu'); return; }

    setLoading(true);
    try {
      const loggedUser = await login(email.trim(), password);
      navigate(getRedirectPath(loggedUser), { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handlePosLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!deviceCode.trim()) { setError('Vui lòng nhập mã thiết bị'); return; }
    if (!pin.trim()) { setError('Vui lòng nhập PIN'); return; }

    setLoading(true);
    try {
      const result = await posAuthApi.login(deviceCode.trim(), pin.trim());
      setPosToken(result.token);
      setPosDeviceCode(result.device.deviceCode);
      navigate('/pos/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập POS thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Đăng nhập</h1>
          <p className="text-sm text-gray-500 mt-1">Hệ thống quản lý F&B</p>
        </div>

        {/* Tab chọn hình thức đăng nhập */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setMode('admin'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'admin' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Quản trị
          </button>
          <button
            onClick={() => { setMode('pos'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'pos' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Thiết bị POS
          </button>
        </div>

        {/* Admin login form */}
        {mode === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="email" type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@store.com" disabled={loading}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" disabled={loading}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng nhập...</> : <><LogIn className="w-4 h-4" /> Đăng nhập</>}
            </button>
          </form>
        )}

        {/* POS login form */}
        {mode === 'pos' && (
          <form onSubmit={handlePosLogin} className="space-y-5">
            <div>
              <label htmlFor="pos-device-code" className="block text-sm font-medium text-gray-700 mb-1">Mã thiết bị</label>
              <input
                id="pos-device-code" type="text" autoComplete="off"
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value.toUpperCase())}
                placeholder="POS-XXXXXX" disabled={loading}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>
            <div>
              <label htmlFor="pos-pin" className="block text-sm font-medium text-gray-700 mb-1">PIN (6 số)</label>
              <input
                id="pos-pin" type="password" autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Nhập 6 chữ số" maxLength={6} disabled={loading}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng nhập...</> : <><Smartphone className="w-4 h-4" /> Đăng nhập POS</>}
            </button>

            <p className="text-xs text-gray-400 text-center">Liên hệ quản lý nếu bạn chưa có mã thiết bị hoặc PIN</p>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">© 2026 F&B Management System</p>
      </div>
    </div>
  );
}