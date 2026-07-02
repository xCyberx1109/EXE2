import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../../shared/constants';
import { Loader2, Delete, CheckCircle2, Monitor, Settings } from 'lucide-react';
import { getRouteByTemplate } from '../../shared/permissions/posTemplateRoutes';
import type { LoginByPinMachine } from '../types';

const PIN_LENGTH = 6;
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

export function PosMachineLoginPage() {
  const { loginByPin, loginWithPosPin, isAuthenticated, isReady, authMode, posMachineInfo, posMachineTemplate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Multi-device fallback state
  const [showMachinePicker, setShowMachinePicker] = useState(false);
  const [candidateMachines, setCandidateMachines] = useState<LoginByPinMachine[]>([]);
  const [employeeInfo, setEmployeeInfo] = useState<{ id: string; fullName: string; employeeCode: string } | null>(null);

  const loadingRef = useRef(false);

  useEffect(() => {
    if (!success || !posMachineTemplate) return;
    const route = getRouteByTemplate(posMachineTemplate);
    const timer = setTimeout(() => navigate(route, { replace: true }), 900);
    return () => clearTimeout(timer);
  }, [success, posMachineTemplate, navigate]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || authMode !== 'pos_machine' || !posMachineTemplate) return;
    const route = getRouteByTemplate(posMachineTemplate);
    if (location.pathname !== route && location.pathname !== '/pos-machine/login') {
      navigate(route, { replace: true });
    }
  }, [isReady, isAuthenticated, authMode, posMachineTemplate, navigate, location.pathname]);

  const triggerError = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => {
      setPinCode('');
      setShake(false);
    }, 400);
  };

  const handleLogin = async (pin: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setError('');
    setLoading(true);
    try {
      const result = await loginByPin(pin);

      if ('requiresMachineSelection' in result) {
        setCandidateMachines(result.machines);
        setEmployeeInfo(result.employee);
        setShowMachinePicker(true);
        setPinCode('');
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      triggerError(err?.message || 'Mã PIN không đúng');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Tu dong submit ngay khi nhap du 6 so - khong can bam nut Dang nhap.
  useEffect(() => {
    if (pinCode.length === PIN_LENGTH && !showMachinePicker && !success) {
      handleLogin(pinCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinCode]);

  const handleKeyPress = (key: string) => {
    if (loading || success) return;
    setError('');
    if (key === 'backspace') {
      setPinCode((p) => p.slice(0, -1));
      return;
    }
    if (key === '') return;
    setPinCode((p) => (p.length < PIN_LENGTH ? p + key : p));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showMachinePicker || success) return;
      if (/^[0-9]$/.test(e.key)) handleKeyPress(e.key);
      else if (e.key === 'Backspace') handleKeyPress('backspace');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMachinePicker, success, loading]);

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
    setPinCode('');
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1220] text-white/60">
        <Loader2 className="w-8 h-8 animate-spin mr-2" /> Đang tải...
      </div>
    );
  }

  if (isAuthenticated && authMode === 'pos_machine' && !showMachinePicker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1220] text-white/60">
        <Loader2 className="w-8 h-8 animate-spin mr-2" /> Đang chuyển hướng...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0B1220] to-[#152040] text-white select-none">
      {/* Header - nhan dien thuong hieu toi gian o goc, khong marketing */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <div className="inline-flex items-center gap-2 bg-white rounded-lg px-3 py-1.5">
          <img src="/Logo.png" alt="POSitive" className="h-5 w-auto object-contain" />
        </div>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Đăng nhập quản trị
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-11 h-11 text-emerald-400" />
              </div>
              <h1 className="text-xl font-semibold">Đăng nhập thành công</h1>
              <p className="text-sm text-white/50">{posMachineInfo?.name || 'Máy POS'}</p>
            </motion.div>
          ) : showMachinePicker ? (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm"
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl mb-3">
                  <Monitor className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-lg font-semibold">Chọn máy POS</h1>
                {employeeInfo && (
                  <p className="text-sm text-white/50 mt-1">
                    Xin chào, <strong className="text-white">{employeeInfo.fullName}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {candidateMachines.map((machine) => (
                  <button
                    key={machine.id}
                    onClick={() => handleSelectMachine(machine)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all text-left disabled:opacity-50"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#4F46E5]/20 flex items-center justify-center flex-shrink-0">
                      <Monitor className="w-5 h-5 text-[#818CF8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{machine.name}</p>
                      <p className="text-xs text-white/40 truncate">{machine.template}</p>
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 text-center">{error}</div>
              )}

              <button
                onClick={handleBackToPin}
                className="mt-5 w-full text-center text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Nhập lại mã PIN
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="numpad"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-xs flex flex-col items-center"
            >
              <p className="text-sm text-white/50 mb-6">Nhập mã PIN để đăng nhập</p>

              {/* PIN dots */}
              <motion.div
                animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-3 mb-8"
              >
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-colors ${
                      i < pinCode.length
                        ? error ? 'bg-red-400 border-red-400' : 'bg-[#818CF8] border-[#818CF8]'
                        : 'border-white/20'
                    }`}
                  />
                ))}
              </motion.div>

              <div className="h-5 mb-2">
                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                {loading && <p className="text-sm text-white/40 text-center flex items-center gap-1.5 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xác thực...</p>}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-3 w-full">
                {NUMPAD_KEYS.map((key, i) =>
                  key === '' ? (
                    <div key={i} />
                  ) : key === 'backspace' ? (
                    <button
                      key={i}
                      onClick={() => handleKeyPress('backspace')}
                      disabled={loading}
                      className="aspect-square rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40"
                    >
                      <Delete className="w-5 h-5 text-white/70" />
                    </button>
                  ) : (
                    <button
                      key={i}
                      onClick={() => handleKeyPress(key)}
                      disabled={loading}
                      className="aspect-square rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center text-2xl font-medium disabled:opacity-40"
                    >
                      {key}
                    </button>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-xs text-white/25 pb-4">© 2026 {APP_NAME}</p>
    </div>
  );
}
