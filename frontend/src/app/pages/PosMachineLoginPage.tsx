import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../../shared/constants';
import { Loader2, Smartphone, CheckCircle2 } from 'lucide-react';

export function PosMachineLoginPage() {
  const { employeeLoginByPin, isAuthenticated, isReady, isEmployeeMode, employee } = useAuth();
  const navigate = useNavigate();
  const pinInputRef = useRef<HTMLInputElement>(null);

  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => navigate('/app', { replace: true }), 1500);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  useEffect(() => {
    if (isReady && isAuthenticated && isEmployeeMode && !success) {
      navigate('/app', { replace: true });
    }
  }, [isReady, isAuthenticated, isEmployeeMode, success, navigate]);

  useEffect(() => {
    if (pinInputRef.current) pinInputRef.current.focus();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (pinCode.length !== 6) { setError('Mã PIN phải có 6 chữ số'); return; }

    setLoading(true);
    try {
      await employeeLoginByPin(pinCode);
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
        <Loader2 className="w-8 h-8 animate-spin mr-2" /> Đang tải...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
      <div className="w-full max-w-sm bg-card rounded-md shadow-xl overflow-hidden">
        {!success ? (
          <div className="p-4">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 rounded-md mb-3">
                <Smartphone className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-lg font-bold text-foreground">Đăng nhập nhân viên</h1>
              <p className="text-xs text-muted-foreground mt-1">Nhập mã PIN để tiếp tục</p>
            </div>

            <div className="space-y-1.5">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Mã PIN</label>
                <input
                  ref={pinInputRef}
                  type="password"
                  placeholder="6 chữ số"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                  className="w-full px-3 py-3 border border-input rounded-md text-xs font-mono text-2xl tracking-widest text-center bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
                  disabled={loading}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1.5 text-xs text-destructive">{error}</div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading || pinCode.length !== 6}
                className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-2 py-1.5 rounded-md text-xs font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <><Loader2 className="size-3.5 animate-spin" /> Đang xác thực...</>
                ) : (
                  <><Smartphone className="size-3.5" /> Đăng nhập</>
                )}
              </button>
            </div>

            <div className="mt-4 text-center">
              <Link to="/login" className="text-xs text-primary hover:text-primary/80 transition-colors">
                Đăng nhập quản trị
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="text-center mb-4">
              <div className="mx-auto mb-4 w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h1 className="text-lg font-bold text-green-700">Đăng nhập thành công!</h1>
              <p className="text-xs text-muted-foreground mt-1">{employee?.fullName || 'Nhân viên'}</p>
            </div>
          </div>
        )}

        <div className="px-6 pb-4">
          <p className="text-center text-xs text-muted-foreground">© 2026 {APP_NAME}</p>
        </div>
      </div>
    </div>
  );
}
