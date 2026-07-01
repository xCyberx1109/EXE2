import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { APP_NAME } from '../../shared/constants';
import {
  Loader2, LogIn, Eye, EyeOff, Smartphone, Mail, Lock, TrendingUp, Sparkles,
  Users, Armchair, Coffee, UtensilsCrossed, Receipt, Wallet, Clock,
} from 'lucide-react';

const REVENUE_CHART = [42, 58, 50, 70, 64, 88, 76];

const TABLE_STATUS: Array<'empty' | 'occupied' | 'reserved'> = [
  'empty', 'occupied', 'empty', 'empty',
  'occupied', 'empty', 'empty', 'reserved',
  'empty', 'empty', 'occupied', 'empty',
  'empty', 'empty', 'empty', 'empty',
];

const RECENT_ORDERS = [
  { label: 'Bàn 5 · 2 món', amount: '185.000đ', time: '2 phút trước' },
  { label: 'Mang về · 1 món', amount: '65.000đ', time: '5 phút trước' },
];

const FNB_STATS = [
  { icon: Coffee, label: 'Đồ uống bán ra hôm nay', value: '54' },
  { icon: UtensilsCrossed, label: 'Món ăn bán ra hôm nay', value: '132' },
  { icon: Receipt, label: 'Đơn hàng đang xử lý', value: '6' },
  { icon: Wallet, label: 'Doanh thu hiện tại', value: '12.4tr' },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
} as const;

function useCountUp(target: number, durationMs = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

function AnimatedStat({ target, format, className }: { target: number; format: (n: number) => string; className?: string }) {
  const value = useCountUp(target);
  return <span className={className}>{format(value)}</span>;
}

const TABLE_STATUS_STYLE: Record<string, string> = {
  empty: 'bg-emerald-100 border border-emerald-200',
  occupied: 'bg-[#4F46E5]/15 border border-[#4F46E5]/30',
  reserved: 'bg-amber-100 border border-amber-200',
};

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
      <div className="min-h-screen flex items-center justify-center bg-white text-[#64748B]">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  if (isAuthenticated && authMode === 'account') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#64748B]">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang chuyển hướng...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel - san pham that, an tren tablet/mobile */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col overflow-hidden bg-white px-16 pt-8 pb-10">
        <div className="pointer-events-none absolute top-1/3 right-0 w-[26rem] h-[26rem] rounded-full bg-[#4F46E5]/10 blur-3xl" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative z-10 flex flex-col gap-5 max-w-xl"
        >
          <motion.div variants={itemVariants} className="flex items-center gap-3">
            <img src="/Logo.png" alt="POSitive" className="h-10 w-auto object-contain" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4F46E5]/10 px-3 py-1 text-xs font-medium text-[#4F46E5]">
              <Sparkles className="w-3.5 h-3.5" />
              500+ cửa hàng F&B tin dùng
            </span>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h1 className="text-4xl font-bold text-[#0F172A] leading-[1.2] tracking-tight">
              Điều hành nhà hàng<br />
              <span className="bg-gradient-to-r from-[#1E3A8A] to-[#4F46E5] bg-clip-text text-transparent">hiệu quả hơn mỗi ngày</span>
            </h1>
            <p className="text-[#64748B] text-base mt-3 leading-relaxed">
              POS, kho hàng, nhân viên và báo cáo doanh thu trên cùng một nền tảng.
            </p>
          </motion.div>

          {/* Dashboard that - san pham thuc te */}
          <motion.div variants={itemVariants} className="relative mt-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#0F172A]">Tổng quan hôm nay</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Đang hoạt động
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] text-[#64748B]">Doanh thu hôm nay</p>
                  <AnimatedStat
                    target={12400000}
                    format={(n) => `${n.toLocaleString('vi-VN')}đ`}
                    className="block text-[#0F172A] font-bold text-lg mt-1"
                  />
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] text-[#64748B]">Đơn hàng</p>
                  <AnimatedStat target={86} format={(n) => String(n)} className="block text-[#0F172A] font-bold text-lg mt-1" />
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1"><Users className="w-3 h-3" /> Đang phục vụ</p>
                  <AnimatedStat target={17} format={(n) => String(n)} className="block text-[#0F172A] font-bold text-lg mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-medium text-[#64748B] mb-2">Doanh thu theo giờ</p>
                  <div className="h-16 flex items-end gap-1.5">
                    {REVENUE_CHART.map((h, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${i === REVENUE_CHART.length - 1 ? 'bg-[#4F46E5]' : 'bg-[#4F46E5]/20'}`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#64748B] mb-2 flex items-center gap-1">
                    <Armchair className="w-3 h-3" /> Trạng thái bàn (12 trống)
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TABLE_STATUS.map((s, i) => (
                      <div key={i} className={`aspect-square rounded ${TABLE_STATUS_STYLE[s]}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[11px] font-medium text-[#64748B] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Đơn hàng mới
                </p>
                {RECENT_ORDERS.map((o) => (
                  <div key={o.label} className="flex items-center justify-between text-xs">
                    <span className="text-[#0F172A]">{o.label}</span>
                    <span className="text-[#64748B]">{o.amount} · {o.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -right-5 -top-5 rounded-xl bg-white border border-slate-100 shadow-lg px-3.5 py-2 flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-[#0F172A]">+18% doanh thu tuần này</span>
            </motion.div>

            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              className="absolute -left-5 top-1/2 rounded-xl bg-[#4F46E5] shadow-lg px-3.5 py-2"
            >
              <span className="text-xs font-semibold text-white">86 đơn hàng hôm nay</span>
            </motion.div>

            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
              className="absolute -right-3 -bottom-5 rounded-xl bg-white border border-slate-100 shadow-lg px-3.5 py-2"
            >
              <span className="text-xs font-semibold text-[#0F172A]">Tồn kho ổn định</span>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-4 gap-3 pt-3">
            {FNB_STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <Icon className="w-4 h-4 text-[#4F46E5] mb-1.5" />
                <p className="text-sm font-bold text-[#0F172A]">{value}</p>
                <p className="text-[10px] text-[#64748B] leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Right panel - form dang nhap */}
      <div className="flex-1 flex items-center justify-center lg:items-start lg:justify-center lg:pt-8 px-4 py-10 sm:py-16 lg:py-0 bg-[#F8FAFC] lg:bg-white">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.15)] px-8 py-10 sm:px-10"
        >
          <img src="/Logo.png" alt="POSitive" className="h-9 w-auto object-contain mx-auto mb-8 lg:hidden" />

          <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Chào mừng trở lại</h2>
          <p className="text-sm text-[#64748B] mt-1.5 mb-8">
            Đăng nhập để tiếp tục quản lý hoạt động kinh doanh của bạn.
          </p>

          <form onSubmit={handleAccountLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#0F172A] mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8]" />
                <input
                  id="email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@cuahang.com" disabled={loading}
                  className="w-full pl-11 pr-3.5 py-3 border border-[#E2E8F0] rounded-xl text-sm bg-white text-[#0F172A] placeholder:text-[#94A3B8] transition-all duration-200 hover:border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] disabled:bg-[#F8FAFC]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#0F172A] mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#94A3B8]" />
                <input
                  id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" disabled={loading}
                  className="w-full pl-11 pr-11 py-3 border border-[#E2E8F0] rounded-xl text-sm bg-white text-[#0F172A] placeholder:text-[#94A3B8] transition-all duration-200 hover:border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] disabled:bg-[#F8FAFC]"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-[#4F46E5] hover:text-[#4338CA] font-medium transition-colors">
                Quên mật khẩu?
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <motion.button
              type="submit" disabled={loading}
              whileHover={!loading ? { scale: 1.02, y: -2 } : undefined}
              whileTap={!loading ? { scale: 0.98 } : undefined}
              transition={{ duration: 0.2 }}
              className="w-full h-[52px] flex items-center justify-center gap-2 bg-[#4F46E5] text-white rounded-xl text-sm font-semibold shadow-[0_4px_14px_rgba(79,70,229,0.35)] hover:bg-[#4338CA] hover:shadow-[0_10px_25px_rgba(79,70,229,0.45)] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng nhập...</> : <><LogIn className="w-4 h-4" /> Đăng nhập</>}
            </motion.button>
          </form>

          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-xs font-medium text-[#94A3B8] tracking-wide">HOẶC</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <Link
            to="/pos-machine/login"
            className="w-full flex items-center justify-center gap-2 border-2 border-[#10B981]/30 text-[#0F172A] px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:border-[#10B981]/60 hover:bg-[#10B981]/5"
          >
            <Smartphone className="w-[18px] h-[18px] text-[#10B981]" />
            Đăng nhập POS bằng mã PIN
          </Link>
          <p className="text-xs text-center text-[#64748B] mt-3">
            Dành cho thiết bị POS đã được cấp mã PIN
          </p>

          <p className="text-center text-xs text-[#94A3B8] mt-8">© 2026 {APP_NAME}. All rights reserved.</p>
        </motion.div>
      </div>
    </div>
  );
}
