import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { invitationApi } from '../api/services';
import { BankSelect } from '../components/ui/BankSelect';
import type { BankOption } from '../../data/banks';

export function SetupBranchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState('');
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState('');
  const [packageName, setPackageName] = useState('');

  const [branchName, setBranchName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError('Thiếu token xác thực. Vui lòng kiểm tra lại link.');
      return;
    }

    setVerifying(true);
    setVerifyError('');

    invitationApi.verify(token)
      .then((data) => {
        setValid(data.valid);
        setEmail(data.email);
        setPackageName(data.packageName);
      })
      .catch((err) => {
        setVerifyError(err.message || 'Link không hợp lệ hoặc đã hết hạn');
      })
      .finally(() => setVerifying(false));
  }, [token]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!branchName.trim()) errors.branchName = 'Vui lòng nhập tên chi nhánh';
    if (!address.trim()) errors.address = 'Vui lòng nhập địa chỉ';

    const phoneClean = phone.replace(/\D/g, '');
    if (!phoneClean) {
      errors.phone = 'Vui lòng nhập số điện thoại';
    } else if (phoneClean.length < 10 || phoneClean.length > 11) {
      errors.phone = 'Số điện thoại không hợp lệ (10-11 số)';
    }

    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 8) {
      errors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (!selectedBank) errors.bank = 'Vui lòng chọn ngân hàng';
    if (!accountHolder.trim()) errors.accountHolder = 'Vui lòng nhập tên chủ tài khoản';
    if (!accountNumber.trim()) errors.accountNumber = 'Vui lòng nhập số tài khoản';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!validate()) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      await invitationApi.accept({
        token,
        branchName: branchName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        password,
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Lỗi khi tạo chi nhánh');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-[10px] border ${fieldErrors[field] ? 'border-destructive' : 'border-[#3a3a40]'} bg-[#202024] px-3 py-2.5 text-sm text-white placeholder-[#8d8d95] transition-colors duration-200 focus:border-[#4f8cff] focus:outline-none focus:ring-2 focus:ring-[#4f8cff]/20 disabled:bg-[#27272a] disabled:cursor-not-allowed disabled:opacity-60`;

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f10]">
        <div className="bg-[#18181b] rounded-[16px] border border-[#2b2b31] shadow-[0_10px_30px_rgba(0,0,0,.35)] p-8 max-w-md w-full text-center">
          <div className="animate-spin w-8 h-8 border-3 border-[#4f8cff] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-[#9ca3af]">Đang xác thực link...</p>
        </div>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f10]">
        <div className="bg-[#18181b] rounded-[16px] border border-[#2b2b31] shadow-[0_10px_30px_rgba(0,0,0,.35)] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl text-destructive font-bold">!</span>
          </div>
          <h1 className="text-lg font-bold text-white mb-3">Link không hợp lệ</h1>
          <p className="text-sm text-[#9ca3af] mb-6">{verifyError}</p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-[10px] bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors duration-200"
          >
            Về trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f10]">
        <div className="bg-[#18181b] rounded-[16px] border border-[#2b2b31] shadow-[0_10px_30px_rgba(0,0,0,.35)] p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl text-green-400">&#10003;</span>
          </div>
          <h1 className="text-lg font-bold text-white mb-3">Tạo chi nhánh thành công</h1>
          <p className="text-sm text-[#9ca3af] mb-6">
            Bạn có thể đăng nhập ngay bây giờ với email <b className="text-white">{email}</b> và mật khẩu vừa tạo.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-[10px] bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors duration-200"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f10]">
        <div className="bg-[#18181b] rounded-[16px] border border-[#2b2b31] shadow-[0_10px_30px_rgba(0,0,0,.35)] p-8 max-w-md w-full text-center">
          <h1 className="text-lg font-bold text-white mb-3">Link không hợp lệ</h1>
          <p className="text-sm text-[#9ca3af] mb-6">Link đã được sử dụng hoặc không tồn tại.</p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-[10px] bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors duration-200"
          >
            Về trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f10] py-10 px-4">
      <div className="w-full max-w-[540px] bg-[#18181b] rounded-[16px] border border-[#2b2b31] shadow-[0_10px_30px_rgba(0,0,0,.35)] p-8 animate-[fadeIn_0.3s_ease-out]">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-white">Hoàn tất tạo chi nhánh</h1>
          <p className="text-sm text-[#9ca3af] mt-2">
            Email: <b className="text-white">{email}</b> &middot; Gói: <b className="text-white">{packageName}</b>
          </p>
        </div>

        {submitError && (
          <div className="rounded-[10px] bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive mb-6">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-[#2b2b31] rounded-[10px] p-5 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] border-b border-[#2b2b31] pb-2 mb-1">
              Thông tin chi nhánh
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white">Tên chi nhánh *</label>
                <input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  disabled={submitting}
                  className={inputClass('branchName')}
                  placeholder="Nhập tên chi nhánh"
                />
                {fieldErrors.branchName && <p className="text-xs text-destructive">{fieldErrors.branchName}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white">Số điện thoại *</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  className={inputClass('phone')}
                  placeholder="Nhập số điện thoại"
                />
                {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white">Địa chỉ *</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
                className={inputClass('address')}
                placeholder="Nhập địa chỉ"
              />
              {fieldErrors.address && <p className="text-xs text-destructive">{fieldErrors.address}</p>}
            </div>
          </div>

          <div className="border border-[#2b2b31] rounded-[10px] p-5 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] border-b border-[#2b2b31] pb-2 mb-1">
              Bảo mật
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white">Mật khẩu *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className={inputClass('password')}
                  placeholder="Ít nhất 8 ký tự"
                />
                {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white">Xác nhận mật khẩu *</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  className={inputClass('confirmPassword')}
                  placeholder="Nhập lại mật khẩu"
                />
                {fieldErrors.confirmPassword && <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>}
              </div>
            </div>
          </div>

          <div className="border border-[#2b2b31] rounded-[10px] p-5 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] border-b border-[#2b2b31] pb-2 mb-1">
              Tài khoản ngân hàng
            </p>

            <div className="space-y-1.5">
                <label className="text-sm font-medium text-white">Ngân hàng *</label>
                <BankSelect
                  value={selectedBank}
                  onChange={setSelectedBank}
                  disabled={submitting}
                  error={!!fieldErrors.bank}
                />
                {fieldErrors.bank && <p className="text-xs text-destructive">{fieldErrors.bank}</p>}
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white">Tên chủ tài khoản *</label>
                <input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  disabled={submitting}
                  className={inputClass('accountHolder')}
                  placeholder="VD: NGUYEN VAN A"
                />
                {fieldErrors.accountHolder && <p className="text-xs text-destructive">{fieldErrors.accountHolder}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white">Số tài khoản *</label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  disabled={submitting}
                  className={inputClass('accountNumber')}
                  placeholder="Nhập số tài khoản"
                />
                {fieldErrors.accountNumber && <p className="text-xs text-destructive">{fieldErrors.accountNumber}</p>}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-[10px] bg-[#2563eb] px-4 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:bg-[#3f3f46] disabled:text-[#8d8d95] disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {submitting && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {submitting ? 'Đang xử lý...' : 'Hoàn tất tạo chi nhánh'}
          </button>
        </form>
      </div>
    </div>
  );
}
