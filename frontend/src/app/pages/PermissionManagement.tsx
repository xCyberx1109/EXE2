import { useState, useEffect, useMemo, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Shield, Lock, User, Save, Search, Calendar, BadgeCheck,
  Layers, List, ChevronRight, ChevronDown, CircleDot, UtensilsCrossed,
  Package, Smartphone, Building2, LayoutDashboard, FileText, ShoppingCart,
  ClipboardList, Users, BarChart3, Clock, Monitor, Grid3X3, Download,
  Settings, UserPen, Play, CalendarCheck, ShoppingBag, CreditCard,
  ChartColumn, Trash2, ShieldCheck, Table,
} from 'lucide-react';
import { api } from '../api/client';
import {
  SUBSCRIPTION_PLANS, getPlanFeatures, getLockedFeatures,
  getOwnPlanPermissions, isFeatureFullyAssigned, determinePlan,
  type PlanKey, type PlanFeature,
} from '../../shared/permissions/permissionPlans';

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

const FEATURE_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Table, FileText, ShoppingCart, ClipboardList,
  UtensilsCrossed, Users, Package, BarChart3, Clock, Monitor, CircleDot,
  Smartphone, Shield, Download, Building2, UserPen, Grid3X3, Settings,
  Play, CalendarCheck, ShoppingBag, CreditCard, ChartColumn, Trash2, ShieldCheck,
};

const PLAN_ORDER: PlanKey[] = ['BASIC', 'STANDARD', 'PREMIUM'];

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function PermissionManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountPermissions, setAccountPermissions] = useState<AccountPermission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'plan' | 'advanced'>('plan');

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
      const normalized = (res || []).map((ap: any) => ({
        permissionId: ap.permissionId,
        allowed: ap.allowed,
      }));
      const deduped = Array.from(
        new Map(normalized.map((ap) => [ap.permissionId, ap])).values(),
      );
      setAccountPermissions(deduped);
    } catch (err) {
      console.error('Failed to load account permissions:', err);
    }
  };

  const codeToIdMap = useMemo(() => {
    return new Map(permissions.map((p) => [p.code, p.id]));
  }, [permissions]);

  const permIdToCodeMap = useMemo(() => {
    return new Map(permissions.map((p) => [p.id, p.code]));
  }, [permissions]);

  const accountPermIdSet = useMemo(() => {
    return new Set(
      accountPermissions
        .filter((ap) => ap.allowed)
        .map((ap) => ap.permissionId),
    );
  }, [accountPermissions]);

  const accountPermCodes = useMemo(() => {
    return Array.from(accountPermIdSet)
      .map((id) => permIdToCodeMap.get(id))
      .filter(Boolean) as string[];
  }, [accountPermIdSet, permIdToCodeMap]);

  const currentPlan = useMemo(() => {
    if (!selectedAccount) return null;
    const allCodes = new Set(accountPermCodes);
    // Nếu account chưa được chọn hoặc chưa load permissions, dùng account.assignedPermissions
    if (allCodes.size === 0 && selectedAccount.assignedPermissions) {
      selectedAccount.assignedPermissions.forEach((ap) => {
        if (ap.allowed) allCodes.add(ap.permissionCode);
      });
    }
    return determinePlan(Array.from(allCodes));
  }, [selectedAccount, accountPermCodes]);

  const handleSave = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      await api.put(`/rbac/accounts/${selectedAccount.id}/permissions`, {
        permissions: accountPermissions,
      });
      alert('Đã lưu thay đổi quyền cho tài khoản ' + selectedAccount.fullName);
    } catch {
      alert('Lỗi khi lưu quyền');
    }
  }, [selectedAccount, accountPermissions]);

  const handleToggleFeature = useCallback(
    (feature: PlanFeature) => {
      setAccountPermissions((prev) => {
        const existing = new Map(prev.map((p) => [p.permissionId, p]));
        const newPerms = new Map(existing);

        const allAssigned = feature.permissions.every((code) => {
          const id = codeToIdMap.get(code);
          return id && existing.has(id);
        });

        for (const code of feature.permissions) {
          const id = codeToIdMap.get(code);
          if (!id) continue;
          if (allAssigned) {
            newPerms.delete(id);
          } else {
            newPerms.set(id, { permissionId: id, allowed: true });
          }
        }

        return Array.from(newPerms.values());
      });
    },
    [codeToIdMap],
  );

  const handleTogglePermission = useCallback((permId: string) => {
    setAccountPermissions((prev) => {
      const exists = prev.find((p) => p.permissionId === permId);
      if (exists) {
        return prev.filter((p) => p.permissionId !== permId);
      }
      return [...prev, { permissionId: permId, allowed: true }];
    });
  }, []);

  const groupedPermissions = useMemo(() => {
    return permissions.reduce(
      (acc, perm) => {
        if (!acc[perm.module]) acc[perm.module] = [];
        acc[perm.module].push(perm);
        return acc;
      },
      {} as Record<string, Permission[]>,
    );
  }, [permissions]);

  const filteredAccounts = accounts.filter(
    (a) =>
      a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Đang tải dữ liệu phân quyền...
      </div>
    );
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
          <p className="text-muted-foreground mt-1">
            Quản lý gói dịch vụ và quyền truy cập cho từng tài khoản
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setTab('plan')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'plan'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-1.5" />
          Gói dịch vụ
        </button>
        <button
          onClick={() => setTab('advanced')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'advanced'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <List className="w-4 h-4 inline mr-1.5" />
          Quyền nâng cao
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account List Sidebar */}
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
              <p className="text-xs text-muted-foreground mt-2">
                {filteredAccounts.length} tài khoản
              </p>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {filteredAccounts.map((account) => {
                const plan = determinePlan(
                  account.assignedPermissions
                    .filter((ap) => ap.allowed)
                    .map((ap) => ap.permissionCode),
                );
                const planColors: Record<PlanKey, string> = {
                  BASIC: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/30',
                  STANDARD: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/30',
                  PREMIUM: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/30',
                };
                return (
                  <button
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className={`w-full text-left p-3 hover:bg-muted transition-colors group ${
                      selectedAccount?.id === account.id
                        ? 'bg-accent ring-1 ring-primary/30'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          selectedAccount?.id === account.id
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-medium text-sm truncate ${
                              selectedAccount?.id === account.id
                                ? 'text-primary'
                                : 'text-foreground'
                            }`}
                          >
                            {account.fullName}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {account.email}
                        </p>
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 ${planColors[plan]}`}
                        >
                          {SUBSCRIPTION_PLANS[plan].name}
                        </span>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                          selectedAccount?.id === account.id
                            ? 'text-primary translate-x-0.5'
                            : 'text-muted-foreground/50'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          {selectedAccount ? (
            <>
              {/* Account Info Bar */}
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-4">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        {selectedAccount.fullName}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {selectedAccount.email}
                      </p>
                    </div>
                  </div>
                  {currentPlan && (
                    <div className="text-right">
                      <div
                        className={`text-xs font-semibold ${SUBSCRIPTION_PLANS[currentPlan].color}`}
                      >
                        Gói: {SUBSCRIPTION_PLANS[currentPlan].name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Tạo: {formatDate(selectedAccount.createdAt)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {tab === 'plan' ? (
                <PlanTabView
                  selectedAccount={selectedAccount}
                  accountPermissions={accountPermissions}
                  accountPermIdSet={accountPermIdSet}
                  codeToIdMap={codeToIdMap}
                  currentPlan={currentPlan}
                  onToggleFeature={handleToggleFeature}
                  onSave={handleSave}
                />
              ) : (
                <AdvancedTabView
                  selectedAccount={selectedAccount}
                  accountPermissions={accountPermissions}
                  groupedPermissions={groupedPermissions}
                  accountPermIdSet={accountPermIdSet}
                  onTogglePermission={handleTogglePermission}
                  onSave={handleSave}
                />
              )}
            </>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-muted border-2 border-dashed border-border rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">
                Chưa chọn tài khoản
              </h3>
              <p className="text-muted-foreground mt-2 max-w-xs">
                Chọn một tài khoản từ danh sách bên trái để quản lý gói dịch vụ và
                quyền truy cập.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =============================
   PLAN TAB
============================= */
function PlanTabView({
  selectedAccount,
  accountPermissions,
  accountPermIdSet,
  codeToIdMap,
  currentPlan,
  onToggleFeature,
  onSave,
}: {
  selectedAccount: Account;
  accountPermissions: AccountPermission[];
  accountPermIdSet: Set<string>;
  codeToIdMap: Map<string, string>;
  currentPlan: PlanKey | null;
  onToggleFeature: (feature: PlanFeature) => void;
  onSave: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<'current' | 'locked' | null>('current');

  const planFeatures = useMemo(
    () => (currentPlan ? getPlanFeatures(currentPlan) : []),
    [currentPlan],
  );
  const lockedFeatures = useMemo(
    () => (currentPlan ? getLockedFeatures(currentPlan) : []),
    [currentPlan],
  );

  return (
    <div className="space-y-4">
      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLAN_ORDER.map((key) => {
          const plan = SUBSCRIPTION_PLANS[key];
          const isCurrent = key === currentPlan;
          return (
            <div
              key={key}
              className={`relative rounded-xl border p-4 transition-all ${
                isCurrent
                  ? `${plan.borderColor} ${plan.bgColor} ring-2 ring-offset-2 ${plan.borderColor.replace('border-', 'ring-')}`
                  : 'border-border bg-card'
              }`}
            >
              {isCurrent && (
                <span
                  className={`absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${plan.badgeColor}`}
                >
                  Đang dùng
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <h3 className={`font-bold text-base ${isCurrent ? plan.color : 'text-foreground'}`}>
                  {plan.name}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {plan.featureCountLabel}
              </p>
              <p className="text-sm font-semibold text-foreground">{plan.price}</p>
            </div>
          );
        })}
      </div>

      {/* Current Plan Features */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'current' ? null : 'current')}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-green-500" />
            <span className="font-semibold text-foreground">
              {currentPlan ? SUBSCRIPTION_PLANS[currentPlan].name : ''} — Tính năng được cấp
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {planFeatures.length} tính năng
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              expandedSection === 'current' ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        {expandedSection === 'current' && (
          <div className="px-4 pb-4 border-t border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {planFeatures.map((feature) => {
                const fullyAssigned = isFeatureFullyAssigned(
                  feature,
                  accountPermIdSet,
                  codeToIdMap,
                );
                const IconComp = FEATURE_ICONS[feature.icon] || Shield;
                return (
                  <label
                    key={feature.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      fullyAssigned
                        ? 'bg-primary/5 border-primary/30 text-primary'
                        : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                    }`}
                  >
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={fullyAssigned}
                        onChange={() => onToggleFeature(feature)}
                        className="w-5 h-5 text-primary rounded-md border-border bg-input-background focus:ring-primary transition-all"
                      />
                    </div>
                    <IconComp className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{feature.name}</p>
                      <p className="text-[10px] opacity-60">{feature.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Locked Features */}
      {lockedFeatures.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'locked' ? null : 'locked')}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold text-foreground">
                Yêu cầu nâng cấp
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {lockedFeatures.length} tính năng
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                expandedSection === 'locked' ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>

          {expandedSection === 'locked' && (
            <div className="px-4 pb-4 border-t border-border">
              {/* Group locked features by target plan */}
              {(['STANDARD', 'PREMIUM'] as PlanKey[]).map((targetPlan) => {
                if (targetPlan === currentPlan) return null;
                const planInfo = SUBSCRIPTION_PLANS[targetPlan];
                const features = getOwnPlanPermissions(targetPlan)
                  .map((code) => {
                    // Find feature that contains this permission
                    for (const f of SUBSCRIPTION_PLANS[targetPlan].features) {
                      if (f.permissions.includes(code)) return f;
                    }
                    return null;
                  })
                  .filter((f, i, arr) => f && arr.findIndex((x) => x?.id === f?.id) === i);

                const uniqueFeatures = SUBSCRIPTION_PLANS[targetPlan].features.filter(
                  (f) => !getPlanFeatures(currentPlan || 'BASIC').some((pf) => pf.id === f.id),
                );

                if (uniqueFeatures.length === 0) return null;

                return (
                  <div key={targetPlan} className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      Nâng cấp lên {planInfo.name}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {uniqueFeatures.map((feature) => {
                        const IconComp = FEATURE_ICONS[feature.icon] || Shield;
                        return (
                          <div
                            key={feature.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 opacity-70"
                          >
                            <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <IconComp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {feature.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {feature.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
        >
          <Save className="w-4 h-4" />
          Lưu quyền hạn
        </button>
      </div>
    </div>
  );
}

/* =============================
   ADVANCED TAB
============================= */
function AdvancedTabView({
  selectedAccount,
  accountPermissions,
  groupedPermissions,
  accountPermIdSet,
  onTogglePermission,
  onSave,
}: {
  selectedAccount: Account;
  accountPermissions: AccountPermission[];
  groupedPermissions: Record<string, Permission[]>;
  accountPermIdSet: Set<string>;
  onTogglePermission: (permId: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <List className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold text-foreground text-sm">
            Chi tiết quyền — {selectedAccount.fullName}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {accountPermissions.length}/{Object.values(groupedPermissions).flat().length} quyền
          </span>
        </div>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
        >
          <Save className="w-4 h-4" />
          Lưu
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[600px]">
        <div className="space-y-8">
          {Object.entries(groupedPermissions).map(([module, perms]) => (
            <div key={module} className="space-y-3">
              <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full" />
                {module}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {perms.map((perm) => {
                  const isChecked = accountPermIdSet.has(perm.id);
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
                          onChange={() => onTogglePermission(perm.id)}
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
    </div>
  );
}
