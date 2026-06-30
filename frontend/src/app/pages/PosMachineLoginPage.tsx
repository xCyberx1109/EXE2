import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../../shared/constants';
import { Loader2, Smartphone, CheckCircle2 } from 'lucide-react';
import { getRouteByTemplate } from '../../shared/permissions/posTemplateRoutes';
import type { LoginByPinMachine } from '../types';

export function PosMachineLoginPage() {
  const { loginByPin, loginWithPosPin, isAuthenticated, isReady, authMode, posMachineInfo, posMachineTemplate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pinInputRef = useRef<HTMLInputElement>(null);

  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Multi-device fallback state
  const [showMachinePicker, setShowMachinePicker] = useState(false);
  const [candidateMachines, setCandidateMachines] = useState<LoginByPinMachine[]>([]);
  const [employeeInfo, setEmployeeInfo] = useState<{ id: string; fullName: string; employeeCode: string } | null>(null);

  useEffect(() => {
    if (!success || !posMachineTemplate) return;
    const route = getRouteByTemplate(posMachineTemplate);
    const timer = setTimeout(() => navigate(route, { replace: true }), 1500);
    return () => clearTimeout(timer);
  }, [success, posMachineTemplate, navigate]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || authMode !== 'pos_machine' || !posMachineTemplate) return;
    const route = getRouteByTemplate(posMachineTemplate);
    if (location.pathname !== route && location.pathname !== '/pos-machine/login') {
      navigate(route, { replace: true });
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
      const result = await loginByPin(pinCode);

      if ('requiresMachineSelection' in result) {
        setCandidateMachines(result.machines);
        setEmployeeInfo(result.employee);
        setShowMachinePicker(true);
        setPinCode('');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Mã PIN không hợp lệ');
      setPinCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMachine = async (machine: LoginByPinMachine) => {
    setLoading(true);
    setError('');
    try {
      await loginWithPosPin(pinCode || '', machine.id);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPin = () => {
    setShowMachinePicker(false);
    setCandidateMachines([]);
    setEmployeeInfo(null);
    setError('');
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" /> Đang tải...
      </div>
    );
  }

  if (isAuthenticated && authMode === 'pos_machine' && !showMachinePicker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" /> Đang chuyển hướng...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl overflow-hidden">
        {!success ? (
          <div className="p-8">
            {!showMachinePicker ? (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
                    <Smartphone className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Đăng nhập POS</h1>
                  <p className="text-sm text-muted-foreground mt-1">Nhập mã PIN để đăng nhập</p>
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
                </div>

                <div className="mt-6 text-center">
                  <Link to="/login" className="text-xs text-primary hover:text-primary/80 transition-colors">
                    Đăng nhập quản trị
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4">
                    <Smartphone className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-foreground">Chọn máy POS</h1>
                  {employeeInfo && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Xin chào, <strong>{employeeInfo.fullName}</strong>
                    </p>
                  )}
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {candidateMachines.map((machine) => (
                    <button
                      key={machine.id}
                      onClick={() => handleSelectMachine(machine)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-input hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-60"
                    >
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-5 h-5 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{machine.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{machine.template}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">{error}</div>
                )}

                <div className="mt-4 text-center">
                  <button
                    onClick={handleBackToPin}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Nhập lại mã PIN
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-green-700">Đăng nhập thành công!</h1>
              <p className="text-sm text-muted-foreground mt-1">{posMachineInfo?.name || 'Máy POS'}</p>
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
