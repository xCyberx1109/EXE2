import { useState } from 'react';
import { User, Lock, KeyRound, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/services';

export function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  
  // Profile update state
  const [profileFullName, setProfileFullName] = useState(user?.fullName || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Reset password self state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileFullName.trim() || !profileEmail.trim()) {
      setProfileError('Vui lòng điền đầy đủ họ tên và email');
      return;
    }
    try {
      setProfileSaving(true);
      setProfileError(null);
      setProfileSuccess(null);
      const updatedUser = await authApi.updateMe({
        fullName: profileFullName.trim(),
        email: profileEmail.trim(),
      });
      setUser(updatedUser);
      setProfileSuccess('Cập nhật thông tin cá nhân thành công!');
    } catch (err: any) {
      setProfileError(err.message || 'Lỗi khi cập nhật thông tin');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Vui lòng điền đầy đủ các thông tin mật khẩu');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không trùng khớp');
      return;
    }
    try {
      setPasswordSaving(true);
      setPasswordError(null);
      setPasswordSuccess(null);
      await authApi.changePassword({ currentPassword, newPassword });
      setPasswordSuccess('Đổi mật khẩu thành công! Nếu bạn cần đổi mật khẩu tiếp hoặc đăng nhập sau này, hãy dùng mật khẩu mới này.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Lỗi khi đổi mật khẩu');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleResetPasswordSelf = async () => {
    try {
      setResetting(true);
      setResetError(null);
      setResetSuccess(null);
      const result = await authApi.resetMyPassword();
      setResetSuccess(`Đặt lại mật khẩu thành công! Mật khẩu mới ngẫu nhiên đã được gửi về email ${result.email}. Đang đăng xuất...`);
      setShowResetConfirm(false);
      
      // Chờ 3 giây để user kịp đọc thông tin, sau đó tự động logout
      setTimeout(() => {
        logout();
      }, 3000);
    } catch (err: any) {
      setResetError(err.message || 'Lỗi khi đặt lại mật khẩu');
      setResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hồ sơ & Bảo mật</h1>
          <p className="text-gray-500 text-sm">Quản lý thông tin tài khoản và cấu hình bảo mật</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Profile details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-500" />
              Thông tin cá nhân
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            {profileError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600 border border-green-100">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò hệ thống</label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 text-sm font-semibold">
                  {user.role === 'ADMIN' ? 'ADMIN' : user.role}
                </div>
              </div>

              {user.branchId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mã chi nhánh</label>
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 text-sm">
                    {user.branchId}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="profileFullName" className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                <input
                  id="profileFullName"
                  type="text"
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label htmlFor="profileEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="profileEmail"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {profileSaving ? 'Đang lưu...' : 'Cập nhật thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Password and Security */}
        <div className="space-y-8">
          {/* Card 2: Change password */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-500" />
                Đổi mật khẩu
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {passwordError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600 border border-green-100">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Tối thiểu 6 ký tự"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu mới</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {passwordSaving ? 'Đang đổi...' : 'Lưu mật khẩu mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Card 3: Reset password */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-gray-500" />
                Khôi phục & Đặt lại mật khẩu ngẫu nhiên
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {resetError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}
              {resetSuccess && (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600 border border-green-100">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <p className="text-sm text-gray-600 leading-relaxed">
                Khi chọn <b>Đặt lại mật khẩu</b>, hệ thống sẽ tự động tạo một mật khẩu ngẫu nhiên mới và gửi nó tới email của bạn (<b>{user.email}</b>).
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Lưu ý quan trọng:</p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Mật khẩu cũ của bạn sẽ bị vô hiệu hóa ngay lập tức.</li>
                    <li>Bạn sẽ bị đăng xuất tự động sau khi đặt lại thành công.</li>
                    <li><b>Yêu cầu bắt buộc:</b> Bạn phải dùng mật khẩu mới trong email để đăng nhập lại và thực hiện đổi mật khẩu ngay sau đó.</li>
                  </ul>
                </div>
              </div>

              {!showResetConfirm ? (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-4 py-2 text-sm font-medium flex items-center gap-2"
                  >
                    Yêu cầu đặt lại mật khẩu ngẫu nhiên
                  </button>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-red-800 font-medium">
                    Bạn chắc chắn muốn đặt lại mật khẩu và tự động đăng xuất chứ?
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-1.5 rounded bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      disabled={resetting}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPasswordSelf}
                      className="px-3 py-1.5 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
                      disabled={resetting}
                    >
                      {resetting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {resetting ? 'Đang đặt lại...' : 'Xác nhận Đặt lại & Đăng xuất'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}