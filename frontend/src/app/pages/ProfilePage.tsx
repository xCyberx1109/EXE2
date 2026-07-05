import { useState } from 'react';
import { User, Lock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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



  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  return (
    <div className="w-full flex flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="p-2 bg-accent rounded-md text-primary">
          <User className="size-4" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Hồ sơ & Bảo mật</h1>
          <p className="text-muted-foreground text-xs">Quản lý thông tin tài khoản và cấu hình bảo mật</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 min-h-0 flex-1">
        {/* Left Column: Profile details */}
        <div className="bg-card rounded-md border border-border shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted shrink-0">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-muted-foreground" />
              Thông tin cá nhân
            </h2>
          </div>
          
          <div className="p-3 overflow-y-auto space-y-1">
            {profileError && (
              <div className="flex items-start gap-1.5 rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                <XCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-start gap-1.5 rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-xs text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800">
                <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-1">
              {user.id && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Mã tài khoản</label>
                  <div className="px-2 py-1.5 bg-muted border border-border rounded-md text-muted-foreground text-xs">
                    {user.id}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="profileFullName" className="block text-xs font-medium text-foreground mb-1">Họ và tên</label>
                <input
                  id="profileFullName"
                  type="text"
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                  className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label htmlFor="profileEmail" className="block text-xs font-medium text-foreground mb-1">Email</label>
                <input
                  id="profileEmail"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {profileSaving && <Loader2 className="size-3.5 animate-spin" />}
                  {profileSaving ? 'Đang lưu...' : 'Cập nhật thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Password and Security */}
        <div className="flex flex-col gap-1.5 min-h-0">
          {/* Card 2: Change password */}
          <div className="bg-card rounded-md border border-border shadow-sm flex flex-col min-h-0 overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-border bg-muted shrink-0">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" />
                Đổi mật khẩu
              </h2>
            </div>
            
            <div className="p-3 overflow-y-auto space-y-1">
              {passwordError && (
                <div className="flex items-start gap-1.5 rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                  <XCircle className="size-3.5 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-start gap-1.5 rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-xs text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800">
                  <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-1">
                <div>
                  <label htmlFor="currentPassword" className="block text-xs font-medium text-foreground mb-1">Mật khẩu hiện tại</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-xs font-medium text-foreground mb-1">Mật khẩu mới</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Tối thiểu 6 ký tự"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-foreground mb-1">Xác nhận mật khẩu mới</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {passwordSaving && <Loader2 className="size-3.5 animate-spin" />}
                    {passwordSaving ? 'Đang đổi...' : 'Lưu mật khẩu mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
