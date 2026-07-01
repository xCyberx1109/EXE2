import { useState, useEffect, useMemo, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Shield, Lock, User, Save, Search, Calendar, BadgeCheck,
  Layers, List, ChevronDown, ChevronUp, CircleDot, UtensilsCrossed,
  Package, Smartphone, Building2, LayoutDashboard, FileText, ShoppingCart,
  ClipboardList, Users, BarChart3, Clock, Monitor, Grid3X3, Download,
  Settings, Trash2, Check, Plus, ShieldAlert, Unlock,
} from 'lucide-react';
import { api } from '../api/client';
import {
  PLAN_ORDER, PLAN_PERMISSIONS, ADVANCED_PERMISSIONS,
  ADVANCED_FEATURES, SYSTEM_DANGER_PERMISSIONS,
  MODULE_GROUPS, getPlanPermissionCount,
  getOwnPlanFeatures, isAdvancedPermission,
  type PlanKey,
} from '../../constants/planPermissions';

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

type CardKey = PlanKey | 'ADVANCED';

const PLAN_LABELS: Record<PlanKey, string> = {
  BASIC: 'Cơ bản',
  STANDARD: 'Chuyên nghiệp',
  PREMIUM: 'Doanh nghiệp',
};

const CARD_CONFIG: Array<{ key: CardKey; label: string; count: number; desc: string; isPlan: boolean }> = [
  { key: 'BASIC', label: 'Cơ bản', count: getPlanPermissionCount('BASIC'), desc: 'Quyền dành cho cửa hàng nhỏ', isPlan: true },
  { key: 'STANDARD', label: 'Chuyên nghiệp', count: getPlanPermissionCount('STANDARD'), desc: 'Bao gồm toàn bộ Cơ bản. Thêm kho, ca làm việc, điều phối đơn hàng...', isPlan: true },
  { key: 'PREMIUM', label: 'Doanh nghiệp', count: getPlanPermissionCount('PREMIUM'), desc: 'Bao gồm toàn bộ Chuyên nghiệp. Thêm Billiard, Nhà hàng, báo cáo nâng cao...', isPlan: true },
  { key: 'ADVANCED', label: 'Nâng cao', count: ADVANCED_PERMISSIONS.length, desc: 'Không phải gói bán. Là tập hợp quyền quản trị đặc biệt.', isPlan: false },
];

const CARD_COLORS: Record<CardKey, { text: string; border: string; bg: string; badge: string; ring: string; iconBg: string }> = {
  BASIC: {
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    bg: 'bg-green-50 dark:bg-green-950/20',
    badge: 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400',
    ring: 'ring-green-500/30',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
  },
  STANDARD: {
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    badge: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
    ring: 'ring-blue-500/30',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  PREMIUM: {
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    badge: 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
    ring: 'ring-purple-500/30',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
  },
  ADVANCED: {
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    badge: 'bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400',
    ring: 'ring-orange-500/30',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
  },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function determinePlanFromPerms(codes: string[]): PlanKey {
  const set = new Set(Array.isArray(codes) ? codes : []);
  const planPermCounts = PLAN_ORDER.map((p) => ({
    plan: p,
    count: PLAN_PERMISSIONS[p].filter((c) => set.has(c)).length,
    total: PLAN_PERMISSIONS[p].length,
  }));
  const best = planPermCounts.reduce((a, b) => (a.count / a.total > b.count / b.total ? a : b));
  if (best.count / best.total >= 0.7) return best.plan;
  return 'BASIC';
}

export function PermissionManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountPermissions, setAccountPermissions] = useState<AccountPermission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'plan' | 'all'>('plan');

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
    if (!Array.isArray(permissions)) return new Map();
    return new Map(permissions.map((p) => [p.code, p.id]));
  }, [permissions]);

  const permIdToCodeMap = useMemo(() => {
    if (!Array.isArray(permissions)) return new Map();
    return new Map(permissions.map((p) => [p.id, p.code]));
  }, [permissions]);

  const idToNameMap = useMemo(() => {
    if (!Array.isArray(permissions)) return new Map();
    return new Map(permissions.map((p) => [p.id, p.name]));
  }, [permissions]);

  const idToModuleMap = useMemo(() => {
    if (!Array.isArray(permissions)) return new Map();
    return new Map(permissions.map((p) => [p.id, p.module]));
  }, [permissions]);

  const accountPermIdSet = useMemo(() => {
    if (!Array.isArray(accountPermissions)) return new Set();
    return new Set(
      accountPermissions
        .filter((ap) => ap.allowed)
        .map((ap) => ap.permissionId),
    );
  }, [accountPermissions]);

    const accountPermCodes = useMemo(() => {
      if (!selectedAccount) return [];
      return (selectedAccount.assignedPermissions ?? [])
        .filter((ap) => ap.allowed)
        .map((ap) => ap.permissionCode);
    }, [selectedAccount]);
    const currentPlan = useMemo(() => {
      if (!selectedAccount) return null;
      const allCodes = new Set(accountPermCodes);
      if (allCodes.size === 0 && Array.isArray(selectedAccount.assignedPermissions)) {
        selectedAccount.assignedPermissions.forEach((ap) => {
          if (ap.allowed) allCodes.add(ap.permissionCode);
        });
      }
      return determinePlanFromPerms(Array.from(allCodes));
    }, [selectedAccount, accountPermCodes]);

  const selectedPlan = useMemo(() => currentPlan || 'BASIC', [currentPlan]);

  const handleSelectPlan = useCallback(async (plan: PlanKey) => {
    if (!selectedAccount) return;
    const planPerms = PLAN_PERMISSIONS[plan] || [];
    const planPermIds = planPerms
      .map((code) => codeToIdMap.get(code))
      .filter(Boolean) as string[];
    const currentIds = accountPermissions
      .filter((ap) => ap.allowed)
      .map((ap) => ap.permissionId);
    const merged = new Set([...currentIds, ...planPermIds]);
    const newPerms = Array.from(merged).map((id) => ({
      permissionId: id,
      allowed: true,
    }));
    setAccountPermissions(newPerms);
    try {
      await api.put(`/rbac/accounts/${selectedAccount.id}/permissions`, {
        plan,
        permissions: newPerms,
      });
    } catch {
      // silent
    }
  }, [selectedAccount, codeToIdMap, accountPermissions]);

  const handleTogglePermission = useCallback((permId: string) => {
    setAccountPermissions((prev) => {
      const exists = prev.find((p) => p.permissionId === permId);
      if (exists) {
        return prev.filter((p) => p.permissionId !== permId);
      }
      return [...prev, { permissionId: permId, allowed: true }];
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      const currentPerms = accountPermissions
        .filter((ap) => ap.allowed)
        .map((ap) => ({
          permissionId: ap.permissionId,
          allowed: true,
        }));
      await api.put(`/rbac/accounts/${selectedAccount.id}/permissions`, {
        plan: selectedPlan,
        permissions: currentPerms,
      });
      setAccountPermissions(currentPerms);
      alert('Đã lưu thay đổi quyền cho ' + selectedAccount.fullName);
    } catch {
      alert('Lỗi khi lưu quyền');
    }
  }, [selectedAccount, selectedPlan, accountPermissions]);

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
          onClick={() => setTab('all')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <List className="w-4 h-4 inline mr-1.5" />
          Toàn bộ quyền
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
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
                const plan = determinePlanFromPerms(
                  account.assignedPermissions
                    .filter((ap) => ap.allowed)
                    .map((ap) => ap.permissionCode),
                );
                const c = CARD_COLORS[plan];
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
                        <p className={`font-medium text-sm truncate ${
                          selectedAccount?.id === account.id ? 'text-primary' : 'text-foreground'
                        }`}>
                          {account.fullName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {account.email}
                        </p>
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 ${c.text} ${c.badge}`}>
                          {PLAN_LABELS[plan]}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="md:col-span-2">
          {selectedAccount ? (
            <>
              {/* Account Info */}
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
                      <div className={`text-xs font-semibold ${CARD_COLORS[currentPlan].text}`}>
                        Gói: {PLAN_LABELS[currentPlan]}
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
                  selectedPlan={selectedPlan}
                  onSelectPlan={handleSelectPlan}
                  onSave={handleSave}
                />
              ) : (
                <AllPermissionsTab
                  permissions={permissions}
                  accountPermissions={accountPermissions}
                  accountPermIdSet={accountPermIdSet}
                  codeToIdMap={codeToIdMap}
                  permIdToCodeMap={permIdToCodeMap}
                  idToNameMap={idToNameMap}
                  idToModuleMap={idToModuleMap}
                  currentPlan={selectedPlan}
                  onToggle={handleTogglePermission}
                  onSave={handleSave}
                />
              )}
            </>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-muted border-2 border-dashed border-border rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Chưa chọn tài khoản</h3>
              <p className="text-muted-foreground mt-2 max-w-xs">
                Chọn một tài khoản từ danh sách bên trái để quản lý gói dịch vụ và quyền truy cập.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================
   TAB 1: GÓI DỊCH VỤ
   ============================ */
function PlanTabView({
  selectedPlan,
  onSelectPlan,
  onSave,
}: {
  selectedPlan: PlanKey;
  onSelectPlan: (plan: PlanKey) => void;
  onSave: () => void;
}) {
  const [selectedCard, setSelectedCard] = useState<CardKey>(selectedPlan);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setSelectedCard(selectedPlan);
  }, [selectedPlan]);

  const handleCardClick = (key: CardKey) => {
    setSelectedCard(key);
    setExpanded(true);
    if (key !== 'ADVANCED') {
      onSelectPlan(key as PlanKey);
    }
  };

  const isPlan = selectedCard !== 'ADVANCED';
  const card = CARD_CONFIG.find((c) => c.key === selectedCard)!;

  return (
    <div className="space-y-5">
      {/* 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {CARD_CONFIG.map((cfg) => {
          const isActive = selectedCard === cfg.key;
          const isCurrentPlan = cfg.isPlan && cfg.key === selectedPlan;
          const c = CARD_COLORS[cfg.key];
          return (
            <button
              key={cfg.key}
              type="button"
              onClick={() => handleCardClick(cfg.key)}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                isActive
                  ? `${c.border} ${c.bg} ring-2 ${c.ring} ring-offset-2 shadow-md`
                  : 'border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm'
              }`}
            >
              {isCurrentPlan && (
                <span className={`absolute -top-2.5 -right-2.5 text-[10px] px-2 py-0.5 rounded-full font-bold ${c.badge} shadow-sm`}>
                  Đang sử dụng
                </span>
              )}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.iconBg} mb-2`}>
                {cfg.key === 'BASIC' && <LayoutDashboard className={`w-4 h-4 ${c.text}`} />}
                {cfg.key === 'STANDARD' && <Building2 className={`w-4 h-4 ${c.text}`} />}
                {cfg.key === 'PREMIUM' && <BadgeCheck className={`w-4 h-4 ${c.text}`} />}
                {cfg.key === 'ADVANCED' && <ShieldAlert className={`w-4 h-4 ${c.text}`} />}
              </div>
              <h3 className={`font-bold text-base ${isActive ? c.text : 'text-foreground'}`}>
                {cfg.label}
              </h3>
              <p className={`text-lg font-bold ${isActive ? c.text : 'text-foreground'} mt-1`}>
                {cfg.count}
              </p>
              <p className={`text-[11px] ${isActive ? c.text : 'text-muted-foreground'} opacity-80`}>
                {cfg.key === 'ADVANCED' ? 'quyền đặc biệt' : 'quyền được cấp'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Detail Accordion */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isPlan ? (
              <BadgeCheck className={`w-5 h-5 ${CARD_COLORS[selectedCard as PlanKey].text}`} />
            ) : (
              <ShieldAlert className="w-5 h-5 text-orange-500" />
            )}
            <span className="font-semibold text-foreground">
              {isPlan ? card.label : 'Quyền quản trị đặc biệt'}
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {card.count} quyền
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
            {isPlan ? (
              <PlanFeaturesDetail planKey={selectedCard as PlanKey} />
            ) : (
              <AdvancedFeaturesDetail />
            )}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
        >
          <Save className="w-4 h-4" />
          Lưu thay đổi
        </button>
      </div>
    </div>
  );
}

function PlanFeaturesDetail({ planKey }: { planKey: PlanKey }) {
  const idx = PLAN_ORDER.indexOf(planKey);
  return (
    <>
      {PLAN_ORDER.map((pKey, i) => {
        const features = getOwnPlanFeatures(pKey);
        if (features.length === 0) return null;
        const isIncluded = i <= idx;
        if (!isIncluded) return null;
        return (
          <div key={pKey}>
            {i > 0 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                Bao gồm toàn bộ {PLAN_LABELS[PLAN_ORDER[i - 1]]}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {features.map((feat) => (
                <span
                  key={feat}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-primary/5 border-primary/20 text-primary"
                >
                  <Plus className="w-3 h-3" />
                  {feat}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function AdvancedFeaturesDetail() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Nhóm quyền quản trị đặc biệt:
      </p>
      <div className="flex flex-wrap gap-2">
        {ADVANCED_FEATURES.map((feat) => (
          <span
            key={feat}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400"
          >
            <ShieldAlert className="w-3 h-3" />
            {feat}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================
   TAB 2: TOÀN BỘ QUYỀN
   ============================ */
function AllPermissionsTab({
  permissions,
  accountPermissions,
  accountPermIdSet,
  codeToIdMap,
  permIdToCodeMap,
  idToNameMap,
  idToModuleMap,
  currentPlan,
  onToggle,
  onSave,
}: {
  permissions: Permission[];
  accountPermissions: AccountPermission[];
  accountPermIdSet: Set<string>;
  codeToIdMap: Map<string, string>;
  permIdToCodeMap: Map<string, string>;
  idToNameMap: Map<string, string>;
  idToModuleMap: Map<string, string>;
  currentPlan: PlanKey;
  onToggle: (permId: string) => void;
  onSave: () => void;
}) {
  const [search, setSearch] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const planPermSet = useMemo(() => {
    return new Set(PLAN_PERMISSIONS[currentPlan] || []);
  }, [currentPlan]);

  const advancedPermSet = useMemo(() => {
    return new Set(ADVANCED_PERMISSIONS);
  }, []);

  const dangerSet = useMemo(() => {
    return new Set(SYSTEM_DANGER_PERMISSIONS);
  }, []);

  const groupedPermissions = useMemo(() => {
    const groups: Array<{
      module: string;
      label: string;
      perms: Array<{ id: string; code: string; name: string }>;
    }> = [];

    for (const group of MODULE_GROUPS) {
      const perms = group.permissions
        .map((code) => {
          const id = codeToIdMap.get(code);
          if (!id) return null;
          return {
            id,
            code,
            name: idToNameMap.get(id) || code,
          };
        })
        .filter(Boolean) as Array<{ id: string; code: string; name: string }>;

      if (perms.length === 0) continue;

      groups.push({
        module: group.module,
        label: group.label,
        perms,
      });
    }

    // Also add any permissions not in MODULE_GROUPS
    const groupedCodes = new Set(
      MODULE_GROUPS.flatMap((g) => g.permissions),
    );
    const orphans = permissions
      .filter((p) => !groupedCodes.has(p.code))
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      }));
    if (orphans.length > 0) {
      groups.push({
        module: 'other',
        label: 'Khác',
        perms: orphans,
      });
    }

    return groups;
  }, [permissions, codeToIdMap, idToNameMap]);

  const searchLower = search.toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!searchLower) return groupedPermissions;
    return groupedPermissions
      .map((g) => ({
        ...g,
        perms: g.perms.filter(
          (p) =>
            p.code.toLowerCase().includes(searchLower) ||
            p.name.toLowerCase().includes(searchLower) ||
            g.label.toLowerCase().includes(searchLower),
        ),
      }))
      .filter((g) => g.perms.length > 0);
  }, [groupedPermissions, searchLower]);

  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  // Expand all modules by default
  useEffect(() => {
    setExpandedModules(new Set(groupedPermissions.map((g) => g.module)));
  }, [groupedPermissions]);

  const totalCount = accountPermissions.filter((ap) => ap.allowed).length;
  const allCount = permissions.length;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2 flex-1">
          <List className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold text-foreground text-sm">Toàn bộ quyền</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {totalCount}/{allCount} quyền
          </span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm permission..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
        >
          <Save className="w-4 h-4" />
          Lưu
        </button>
      </div>

      <div className="p-4 overflow-y-auto max-h-[650px] space-y-3">
        {filteredGroups.map((group) => {
          const isExpanded = expandedModules.has(group.module);
          const checkedCount = group.perms.filter((p) => accountPermIdSet.has(p.id)).length;
          return (
            <div key={group.module} className="rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => toggleModule(group.module)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{group.label}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {checkedCount}/{group.perms.length}
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div className="divide-y divide-border">
                  {group.perms.map((p) => {
                    const isChecked = accountPermIdSet.has(p.id);
                    const isPlanPerm = planPermSet.has(p.code);
                    const isAdvanced = advancedPermSet.has(p.code);
                    const isDanger = dangerSet.has(p.code);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          isPlanPerm && isChecked
                            ? 'bg-primary/[0.03]'
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggle(p.id)}
                            className="w-4 h-4 text-primary rounded border-border bg-input-background focus:ring-primary transition-all"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isPlanPerm && isChecked && (
                              <Unlock className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            )}
                            <span className={`text-sm font-medium ${
                              isChecked ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                              {p.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/70 truncate">{p.name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isDanger && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                              Quyền hệ thống
                            </span>
                          )}
                          {isAdvanced && !isDanger && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                              Nâng cao
                            </span>
                          )}
                          {isPlanPerm && !isAdvanced && !isDanger && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                              Thuộc gói
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
