import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../../shared/constants';
import { Loader2, LogIn, Eye, EyeOff, Smartphone, Monitor } from 'lucide-react';

export function LoginPage() {
  const {
    login,
    isAuthenticated, isReady, user, authMode,
  } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getAccountRedirectPath(): string {
    if (!user) return '/app';
    const perms = user.permissions || [];
    if (perms.includes('BRANCH_VIEW') || perms.includes('REPORT_VIEW')) {
      return '/app';
    }
    if (perms.includes('POS_CREATE_ORDER') || perms.includes('POS_OPEN')) {
      return '/app/order-queue';
    }
    return '/app';
  }

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) return;

    if (authMode === 'account' && user) {
      navigate(getAccountRedirectPath(), { replace: true });
    }
  }, [isReady, isAuthenticated, authMode, user, navigate]);

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

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  if (isAuthenticated && authMode === 'account') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang chuyển hướng...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-md shadow-xl overflow-hidden">
        <div className="p-3">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-md mb-4">
              <Monitor className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Đăng nhập quản trị</h1>
            <p className="text-xs text-muted-foreground mt-1">{APP_NAME}</p>
          </div>

          <form onSubmit={handleAccountLogin} className="space-y-1">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1">Email</label>
              <input
                id="email" type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@store.com" disabled={loading}
                className="w-full px-2 py-1.5 border border-input rounded-md text-xs bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1">Mật khẩu</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" disabled={loading}
                  className="w-full px-2 py-1.5 pr-10 border border-input rounded-md text-xs bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:text-primary/80 transition-colors">
                Quên mật khẩu?
              </Link>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1.5 text-xs text-destructive">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-2 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <><Loader2 className="size-3.5 animate-spin" /> Đang đăng nhập...</> : <><LogIn className="size-3.5" /> Đăng nhập</>}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
            <Link
              to="/pos-machine/login"
              className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-2 py-1.5 rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors"
            >
              <Smartphone className="size-3.5" />
              Đăng nhập POS bằng mã PIN
            </Link>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Dành cho thiết bị POS đã được quản lý cấp mã PIN
            </p>
          </div>
        </div>

        <div className="px-6 pb-4">
          <p className="text-center text-xs text-muted-foreground">© 2026 {APP_NAME}</p>
        </div>
      </div>
    </div>
  );
}
