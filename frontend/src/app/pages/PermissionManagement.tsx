import { useState, useEffect } from 'react';
import { Shield, Lock, User, Save, ChevronRight, Search, Calendar, BadgeCheck, Layers } from 'lucide-react';
import { api } from '../api/client';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

interface AssignedPermission {
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  module: string;
  allowed: boolean;
}

interface Account {
  id: string;
  accountId: string;
  email: string;
  fullName: string;
  username: string;
  status: string;
  active: boolean;
  createdAt: string;
  assignedRoles: string[];
  assignedPermissions: AssignedPermission[];
  permissionCount: number;
}

interface AccountPermission {
  permissionId: string;
  allowed: boolean;
}

export function PermissionManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountPermissions, setAccountPermissions] = useState<AccountPermission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadAccountPermissions(selectedAccount.id);
    }
  }, [selectedAccount]);

  const loadInitialData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [accountsData, permsData] = await Promise.all([
        api.get<Account[]>('/rbac/accounts'),
        api.get<Permission[]>('/rbac/permissions'),
      ]);

      // Hard guard: dedupe permissions to avoid duplicate rendering (prefer code)
      const dedupedPermissions = Array.from(
        new Map(
          (permsData || []).map((p) => [p.code ?? p.id, p]),
        ).values(),
      );

      setAccounts(accountsData || []);
      setPermissions(dedupedPermissions);
    } catch (err: any) {
      console.error('Failed to load permission data:', err);
      if (err?.status === 403) {
        setLoadError('Bạn không có quyền truy cập trang này (cần quyền PERMISSION_VIEW).');
      } else {
        setLoadError('Không thể tải dữ liệu phân quyền. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAccountPermissions = async (accountId: string) => {
    try {
      const res = await api.get<AccountPermission[]>(`/rbac/accounts/${accountId}/permissions`);

      // Hard guard: dedupe by permissionId to avoid duplicate checkboxes/state
      const normalized = (res || []).map((ap: any) => ({
        permissionId: ap.permissionId,
        allowed: ap.allowed,
      }));

      const deduped = Array.from(
        new Map(
          normalized.map((ap) => [ap.permissionId, ap]),
        ).values(),
      );

      setAccountPermissions(deduped);
    } catch (err) {
      console.error('Failed to load account permissions:', err);
    }
  };

  const handleTogglePermission = (permId: string) => {
    setAccountPermissions(prev => {
      const exists = prev.find(p => p.permissionId === permId);
      if (exists) {
        return prev.filter(p => p.permissionId !== permId);
      } else {
        return [...prev, { permissionId: permId, allowed: true }];
      }
    });
  };

  const savePermissions = async () => {
    if (!selectedAccount) return;
    try {
      await api.put(`/rbac/accounts/${selectedAccount.id}/permissions`, {
        permissions: accountPermissions,
      });
      alert('Đã lưu thay đổi quyền cho tài khoản ' + selectedAccount.fullName);
    } catch (err) {
      alert('Lỗi khi lưu quyền');
    }
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const filteredAccounts = accounts.filter(a =>
    a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.accountId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string, active: boolean) => {
    if (status === 'ACTIVE' && active) {
      return { label: 'Hoạt động', className: 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' };
    }
    return { label: 'Không hoạt động', className: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' };
  };

  const roleLabel = (roles: string[]) => {
    if (!roles || roles.length === 0) return 'Chưa gán vai trò';
    return roles.join(', ');
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu phân quyền...</div>;
  }

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-md mx-auto bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <p className="text-red-600 dark:text-red-400 font-medium">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Quản lý Phân quyền Tài khoản
          </h1>
          <p className="text-muted-foreground mt-1">Thiết lập quyền truy cập trực tiếp cho từng tài khoản</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account List */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 bg-muted border-b border-border">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Tìm tài khoản..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{filteredAccounts.length} tài khoản</p>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {filteredAccounts.map(account => {
                const statusBadge = getStatusBadge(account.status, account.active);
                return (
                  <button
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className={`w-full text-left p-3 hover:bg-muted transition-colors group ${
                      selectedAccount?.id === account.id ? 'bg-accent ring-1 ring-primary/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        selectedAccount?.id === account.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium text-sm truncate ${
                            selectedAccount?.id === account.id ? 'text-primary' : 'text-foreground'
                          }`}>
                            {account.fullName}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{account.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(account.createdAt)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">|</span>
                          <span className={`text-[10px] ${account.permissionCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {account.permissionCount > 0 ? `${account.permissionCount} quyền` : 'Chưa gán vai trò'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                        selectedAccount?.id === account.id ? 'text-primary translate-x-0.5' : 'text-muted-foreground/50'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Permission Editor */}
        <div className="md:col-span-2">
          {selectedAccount ? (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border bg-card sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selectedAccount.fullName}</h2>
                      <p className="text-muted-foreground text-sm">{selectedAccount.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={savePermissions}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    Lưu quyền hạn
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    ID: {selectedAccount.accountId}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Ngày tạo: {formatDate(selectedAccount.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    Vai trò: {roleLabel(selectedAccount.assignedRoles)}
                  </span>
                  {selectedAccount.id && (
                    <span className="flex items-center gap-1">
                      ID: {selectedAccount.accountId.substring(0, 8)}...
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto max-h-[600px]">
                {Object.entries(groupedPermissions).map(([module, perms]) => (
                  <div key={module} className="space-y-3">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      {module}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {perms.map(perm => {
                        const isChecked = accountPermissions.some(p => p.permissionId === perm.id && p.allowed);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-primary/5 border-primary/30 text-primary ring-1 ring-primary/20' 
                                : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                            }`}
                          >
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(perm.id)}
                                className="w-5 h-5 text-primary rounded-md border-border bg-input-background focus:ring-primary transition-all"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{perm.name}</p>
                              <p className="text-[10px] opacity-60 font-mono">{perm.code}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-muted border-2 border-dashed border-border rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Chưa chọn tài khoản</h3>
              <p className="text-muted-foreground mt-2 max-w-xs">Chọn một tài khoản từ danh sách bên trái để quản lý các quyền truy cập riêng biệt.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
