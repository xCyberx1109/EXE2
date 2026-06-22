import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../../shared/constants';
import { Loader2, Smartphone, CheckCircle2 } from 'lucide-react';

const POS_MACHINE_ROUTES: Record<string, string> = {
  CASHIER: '/app/pos-system',
  KITCHEN: '/app/order-queue',
  CASHIER_KITCHEN: '/app/order-queue',
  BILLIARD: '/app/billiard',
};

let renderCount = 0;

export function PosMachineLoginPage() {
  const { loginWithPosPin, isAuthenticated, isReady, authMode, posMachineInfo, posMachineTemplate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pinInputRef = useRef<HTMLInputElement>(null);

  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  renderCount++;
  console.log('[POS Machine Login] render', renderCount, { pathname: location.pathname, isReady, isAuthenticated, authMode, template: posMachineTemplate, success });

  useEffect(() => {
    console.log('[POS Machine Login] Effect 1 (post-login redirect)', { success, template: posMachineInfo?.template });
    if (success && posMachineInfo?.template) {
      const template = posMachineInfo.template;
      const route = POS_MACHINE_ROUTES[template] || '/app';
      const timer = setTimeout(() => {
        console.log('[POS Machine Login] Effect 1: navigating to', route);
        navigate(route, { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [success, posMachineInfo?.template, navigate]);

  useEffect(() => {
    console.log('[POS Machine Login] Effect 2 (auto-redirect)', { isReady, isAuthenticated, authMode, template: posMachineTemplate, pathname: location.pathname });
    if (isReady && isAuthenticated && authMode === 'pos_machine' && posMachineTemplate) {
      const route = POS_MACHINE_ROUTES[posMachineTemplate] || '/app';
      if (location.pathname !== route && location.pathname !== '/pos-machine/login') {
        console.log('[POS Machine Login] Effect 2: redirecting to', route);
        navigate(route, { replace: true });
      }
    }
  }, [isReady, isAuthenticated, authMode, posMachineTemplate, navigate, location.pathname]);

  useEffect(() => {
    if (pinInputRef.current) pinInputRef.current.focus();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (pinCode.length !== 6) { setError('Mã PIN phải có 6 chữ số'); return; }

    setLoading(true);
    try {
      await loginWithPosPin(pinCode);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Mã PIN không hợp lệ');
      setPinCode('');
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

  if (isAuthenticated && authMode === 'pos_machine') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang chuyển hướng...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl overflow-hidden">
        {!success ? (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Đăng nhập POS</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Nhập mã PIN để đăng nhập máy POS
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Mã PIN</label>
                <input
                  ref={pinInputRef}
                  type="password"
                  placeholder="6 chữ số"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
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
                onClick={handleLogin}
                disabled={loading || pinCode.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang xác thực...</>
                ) : (
                  <><Smartphone className="w-4 h-4" /> Đăng nhập</>
                )}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Đăng nhập quản trị
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-green-700">Đăng nhập thành công!</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {posMachineInfo?.name || 'Máy POS'}
              </p>
            </div>
          </div>
        )}

        <div className="px-8 pb-6">
          <p className="text-center text-xs text-muted-foreground">© 2026 {APP_NAME}</p>
        </div>
      </div>
    </div>
  );
}
