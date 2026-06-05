import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { inviteApi } from '../api/services';

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError('Thiếu token xác thực. Vui lòng kiểm tra lại link.');
      return;
    }

    setVerifying(true);
    setVerifyError('');

    inviteApi.verify(token)
      .then((data) => {
        setValid(data.valid);
        setEmail(data.email || '');
        setFullName(data.fullName || '');
      })
      .catch((err) => {
        setVerifyError(err.message || 'Link không hợp lệ hoặc đã hết hạn');
      })
      .finally(() => setVerifying(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 6) {
      setSubmitError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('Mật khẩu xác nhận không khớp');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await inviteApi.setPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Lỗi khi đặt mật khẩu');
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Đang xác thực link...</p>
        </div>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link không hợp lệ</h1>
          <p className="text-gray-600 mb-6">{verifyError}</p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Về trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-green-600">&#10003;</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Đặt mật khẩu thành công</h1>
          <p className="text-gray-600 mb-2">
            Bạn có thể đăng nhập ngay bây giờ với email <b>{email}</b> và mật khẩu vừa tạo.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-white font-medium hover:bg-blue-700"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link không hợp lệ</h1>
          <p className="text-gray-600 mb-6">Link đã được sử dụng hoặc không tồn tại.</p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Về trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">Thiết lập mật khẩu</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tài khoản: <b>{email}</b>
          </p>
          {fullName && <p className="text-sm text-gray-500">{fullName}</p>}
        </div>

        {submitError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600 mb-4">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Mật khẩu mới</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              placeholder="Ít nhất 6 ký tự"
              autoFocus
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Xác nhận mật khẩu</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              placeholder="Nhập lại mật khẩu"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !password || !confirmPassword}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Đang xử lý...' : 'Đặt mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
