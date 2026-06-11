import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { getDeviceTypeLabel } from '../../shared/permissions/devicePermissions';
import { APP_NAME } from '../../shared/constants';
import { Loader2, LogIn, Eye, EyeOff, Smartphone, Monitor, CheckCircle2 } from 'lucide-react';

const DEVICE_ROUTES: Record<string, string> = {
  CASHIER: '/pos/table-view',
  KITCHEN: '/pos/kitchen-queue',
  WAITER: '/pos/waiter-order',
  KIOSK: '/pos/kiosk',
  CUSTOMER_DISPLAY: '/pos/display',
  MANAGER: '/pos/table-view',
  TABLET: '/pos/waiter-order',
};

export function LoginPage() {
  const {
    login, loginWithDevicePin,
    isAuthenticated, isReady, user, authMode, deviceInfo, branchInfo, devicePermissions, enabledFeatures,
  } = useAuth();
  const navigate = useNavigate();
  const pinInputRef = useRef<HTMLInputElement>(null);

  const [pinMode, setPinMode] = useState<'idle' | 'pin' | 'complete'>('idle');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [setupPin, setSetupPin] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getDeviceRedirectPath(): string {
    const type = authMode === 'device' ? deviceInfo?.type : null;
    return (type && DEVICE_ROUTES[type]) || '/pos-v2/dashboard';
  }

  function getAccountRedirectPath(): string {
    if (!user) return '/app';
    const perms = user.permissions || [];
    if (perms.includes('BRANCH_VIEW') || perms.includes('REPORT_VIEW')) {
      return '/app';
    }
    if (perms.includes('POS_CREATE_ORDER') || perms.includes('POS_OPEN')) {
      return '/pos/table-view';
    }
    return '/app';
  }

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) return;

    if (authMode === 'account' && user) {
      const target = getAccountRedirectPath();
      navigate(target, { replace: true });
    } else if (authMode === 'device') {
      navigate(getDeviceRedirectPath(), { replace: true });
    }
  }, [isReady, isAuthenticated, authMode, user, deviceInfo, navigate]);

  useEffect(() => {
    if (pinMode === 'pin' && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [pinMode]);

  const handleAccountLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Vui lòng nhập email'); return; }
    if (!password.trim()) { setError('Vui lòng nhập mật khẩu'); return; }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceLogin = async () => {
    setError('');
    if (setupPin.length !== 6) { setError('Mã PIN phải có 6 chữ số'); return; }

    setLoading(true);
    try {
      const result = await loginWithDevicePin(setupPin);
      setPinMode('complete');
    } catch (err: any) {
      setError(err?.message || 'Mã PIN không hợp lệ');
      setSetupPin('');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang chuyển hướng...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden">

        {pinMode === 'idle' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
                <Monitor className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Đăng nhập quản trị</h1>
              <p className="text-sm text-muted-foreground mt-1">{APP_NAME}</p>
            </div>

            <form onSubmit={handleAccountLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  id="email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@store.com" disabled={loading}
                  className="w-full px-3 py-2.5 border border-input rounded-lg text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">Mật khẩu</label>
                <div className="relative">
                  <input
                    id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" disabled={loading}
                    className="w-full px-3 py-2.5 pr-10 border border-input rounded-lg text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">{error}</div>
              )}

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng nhập...</> : <><LogIn className="w-4 h-4" /> Đăng nhập</>}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border">
              <button
                onClick={() => { setError(''); setPinMode('pin'); }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Smartphone className="w-5 h-5" />
                Đăng nhập POS bằng mã PIN
              </button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Dành cho thiết bị POS đã được quản lý cấp mã PIN
              </p>
            </div>
          </div>
        )}

        {pinMode === 'pin' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Đăng nhập POS</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Nhập mã PIN do quản lý cung cấp
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Mã PIN thiết lập</label>
                <input
                  ref={pinInputRef}
                  type="password"
                  placeholder="6 chữ số"
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDeviceLogin(); }}
                  className="w-full px-3 py-4 border border-input rounded-lg text-sm font-mono text-3xl tracking-widest text-center bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
                  disabled={loading}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">{error}</div>
              )}

              <button
                onClick={handleDeviceLogin}
                disabled={loading || setupPin.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang xác thực...</>
                ) : (
                  <><Smartphone className="w-4 h-4" /> Kích hoạt & Đăng nhập</>
                )}
              </button>

              <button
                onClick={() => { setError(''); setPinMode('idle'); setSetupPin(''); }}
                className="w-full text-muted-foreground hover:text-foreground text-sm transition-colors py-2"
              >
                Quay lại đăng nhập quản trị
              </button>

              <p className="text-xs text-center text-muted-foreground">
                Thiết bị chỉ cần nhập PIN <strong>1 lần</strong> khi setup. Lần sau sẽ tự động kết nối.
              </p>
            </div>
          </div>
        )}

        {pinMode === 'complete' && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-green-700">Kích hoạt thành công!</h1>
              <p className="text-sm text-muted-foreground mt-1">Thiết bị POS đã sẵn sàng sử dụng</p>
            </div>

            {branchInfo && (
              <div className="bg-muted rounded-lg p-4 text-center mb-4">
                <p className="text-sm text-muted-foreground">Chi nhánh</p>
                <p className="font-medium text-lg text-foreground">{branchInfo.name}</p>
              </div>
            )}

            {deviceInfo && (
              <div className="bg-accent rounded-lg p-4 text-center mb-4">
                <p className="text-sm text-primary font-medium">{getDeviceTypeLabel(deviceInfo.type as any)}</p>
                <p className="text-xs text-primary/80">
                  {devicePermissions.length} quyền • {enabledFeatures.length} tính năng
                </p>
              </div>
            )}

            <button
              onClick={() => navigate(getDeviceRedirectPath(), { replace: true })}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Monitor className="w-4 h-4" />
              Vào giao diện {deviceInfo ? getDeviceTypeLabel(deviceInfo.type as any) : 'POS'}
            </button>
          </div>
        )}

        <div className="px-8 pb-6">
          <p className="text-center text-xs text-muted-foreground">© 2026 {APP_NAME}</p>
        </div>
      </div>
    </div>
  );
}