import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router';
import { authApi } from '../api/services';
import { Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { APP_NAME } from '../../shared/constants';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
        <div className="w-full max-w-md bg-card rounded-md shadow-xl overflow-hidden p-4 text-center">
          <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-xl text-destructive">!</span>
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">Link không hợp lệ</h1>
          <p className="text-muted-foreground mb-4">Thiếu token xác thực. Vui lòng kiểm tra lại link.</p>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-xs">
            <ArrowLeft className="size-3.5" /> Về trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Mật khẩu phải có chữ hoa, chữ thường và số');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
        <div className="w-full max-w-md bg-card rounded-md shadow-xl overflow-hidden p-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
            <Lock className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">Đặt lại mật khẩu thành công</h1>
          <p className="text-muted-foreground mb-4">Vui lòng đăng nhập lại.</p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent to-muted px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-md shadow-xl overflow-hidden p-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-md mb-4">
            <Lock className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Đặt lại mật khẩu</h1>
          <p className="text-xs text-muted-foreground mt-1">{APP_NAME}</p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1.5 text-xs text-destructive mb-3">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-1.5">
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1">Mật khẩu mới</label>
            <div className="relative">
              <input
                id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự" disabled={loading}
                className="w-full px-2 py-1.5 pr-10 border border-input rounded-md text-xs bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-foreground mb-1">Xác nhận mật khẩu mới</label>
            <div className="relative">
              <input
                id="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu" disabled={loading}
                className="w-full px-2 py-1.5 pr-10 border border-input rounded-md text-xs bg-input-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted"
              />
              <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-2 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <><Loader2 className="size-3.5 animate-spin" /> Đang xử lý...</> : <>Đặt lại mật khẩu</>}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-xs">
            <ArrowLeft className="size-3.5" /> Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
