import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  Copy,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Trash2,
  X,
  XCircle,
  Lock,
  Shield,
  Check,
} from 'lucide-react';
import { branchApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { Branch } from '../types';
import type { BranchPayload, CreateBranchResult } from '../api/services';
import { PLAN_PERMISSIONS, MODULE_GROUPS, getPlanPermissionCount, isAdvancedPermission } from '../../constants/planPermissions';
import type { PlanKey } from '../../constants/planPermissions';
import { DataTable, type Column } from '../components/DataTable';

type Plan = Branch['plan'];
type SubscriptionStatus = Branch['subscriptionStatus'];

const PLAN_OPTIONS: Array<{ value: Plan; label: string }> = [
  { value: 'BASIC', label: 'Cơ bản' },
  { value: 'STANDARD', label: 'Chuyên nghiệp' },
  { value: 'PREMIUM', label: 'Doanh nghiệp' },
];

type BranchFormState = {
  name: string;
  address: string;
  phone: string;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStart: string;
  subscriptionEnd: string;
  active: boolean;
  email: string;
};

const today = new Date().toISOString().slice(0, 10);

const createDefaultForm = (): BranchFormState => ({
  name: '',
  address: '',
  phone: '',
  plan: 'BASIC',
  subscriptionStatus: 'ACTIVE',
  subscriptionStart: today,
  subscriptionEnd: today,
  active: true,
  email: '',
});

const toDateInputValue = (value?: string) => {
  if (!value) return today;
  return new Date(value).toISOString().slice(0, 10);
};

const toPayload = (form: BranchFormState, permissions: string[]): BranchPayload => ({
  name: form.name.trim(),
  address: form.address.trim(),
  phone: form.phone.trim(),
  plan: form.plan,
  subscriptionStatus: form.subscriptionStatus,
  subscriptionStart: form.subscriptionStart,
  subscriptionEnd: form.subscriptionEnd,
  active: form.active,
  email: form.email.trim(),
  fullName: '',
  permissions,
});

export function BranchManagement() {
  const { hasPermission } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchFormState>(createDefaultForm);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [resetPasswordBranch, setResetPasswordBranch] = useState<Branch | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);
  const [resetPasswordInviteLink, setResetPasswordInviteLink] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [forceDeleteBranch, setForceDeleteBranch] = useState<Branch | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [forceDeleting, setForceDeleting] = useState(false);

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(() => [...PLAN_PERMISSIONS['BASIC']]);

  const handlePlanChange = useCallback((plan: Plan) => {
    setForm((current) => ({ ...current, plan }));
    const planPerms = PLAN_PERMISSIONS[plan as PlanKey] || [];
    setSelectedPermissions((prev) => {
      const merged = new Set([...prev, ...planPerms]);
      return Array.from(merged);
    });
  }, []);

  const togglePermission = useCallback((code: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(code)) return prev.filter((p) => p !== code);
      return [...prev, code];
    });
  }, []);

  const isEditing = Boolean(editingBranchId);
  const isEditModalOpen = Boolean(editingBranchId);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await branchApi.list();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách chi nhánh');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleResetPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetPasswordBranch) return;

    try {
      setResetting(true);
      setResetPasswordError(null);
      setResetPasswordSuccess(null);
      setResetPasswordInviteLink(null);
      const res = await branchApi.resetManagerPassword(resetPasswordBranch.id);
      if (res.inviteLink) {
        setResetPasswordInviteLink(res.inviteLink);
      }
      setResetPasswordSuccess(
        `Đã tạo link đặt lại mật khẩu cho "${res.accountFullName}" thành công!`
      );
    } catch (err: any) {
      setResetPasswordError(err.message || 'Lỗi khi đặt lại mật khẩu');
    } finally {
      setResetting(false);
    }
  };

  const resetForm = () => {
    setIsCreateModalOpen(false);
    setEditingBranchId(null);
    setForm(createDefaultForm());
    setSelectedPermissions([...PLAN_PERMISSIONS['BASIC']]);
  };

  const handleOpenCreateModal = () => {
    setError(null);
    setEditingBranchId(null);
    setForm(createDefaultForm());
    setSelectedPermissions([...PLAN_PERMISSIONS['BASIC']]);
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmittingRef.current) return;
    if (saving) return;

    if (!form.name.trim() || !form.address.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('Vui lòng nhập đầy đủ tên chi nhánh, địa chỉ, số điện thoại và email');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      setError(null);
      const payload = toPayload(form, selectedPermissions);

      if (editingBranchId) {
        const updatedBranch = await branchApi.update(editingBranchId, payload);
        setBranches((current) =>
          current.map((branch) => (branch.id === editingBranchId ? updatedBranch : branch))
        );
      } else {
        const result = await branchApi.create(payload);
        const data = await branchApi.list();
        setBranches(Array.isArray(data) ? data : []);
        toast.success(`Đã gửi thông tin đăng nhập đến email ${result.email}`);
      }

      resetForm();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu chi nhánh');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const handleEdit = (branch: Branch) => {
    setIsCreateModalOpen(false);
    setEditingBranchId(branch.id);
    setError(null);
    setForm({
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      plan: branch.plan,
      subscriptionStatus: branch.subscriptionStatus,
      subscriptionStart: toDateInputValue(branch.subscriptionStart),
      subscriptionEnd: toDateInputValue(branch.subscriptionEnd),
      active: branch.active,
      email: branch.account?.email ?? '',
    });
  };

  const handleDelete = async (branch: Branch) => {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa chi nhánh "${branch.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(branch.id);
      setError(null);
      await branchApi.delete(branch.id);
      setBranches((current) => current.filter((item) => item.id !== branch.id));

      if (editingBranchId === branch.id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa chi nhánh');
    } finally {
      setDeletingId(null);
    }
  };

  const handleForceDelete = async () => {
    if (!forceDeleteBranch || confirmName !== forceDeleteBranch.name) {
      setError('Tên chi nhánh không chính xác');
      return;
    }
    const branchName = forceDeleteBranch.name;
    try {
      setForceDeleting(true);
      setError(null);
      const result = await branchApi.forceDelete(forceDeleteBranch.id);
      setBranches((current) => current.filter((item) => item.id !== forceDeleteBranch.id));
      setForceDeleteBranch(null);
      setConfirmName('');
      alert(`Đã xoá vĩnh viễn chi nhánh "${branchName}"`);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xoá vĩnh viễn chi nhánh');
    } finally {
      setForceDeleting(false);
    }
  };

  const handleToggleStatus = async (branch: Branch) => {
    try {
      setError(null);
      const result = branch.active
        ? await branchApi.lock(branch.id)
        : await branchApi.unlock(branch.id);

      setBranches((current) =>
        current.map((item) => (item.id === branch.id ? { ...item, active: result.active } : item))
      );

      if (editingBranchId === branch.id) {
        setForm((current) => ({ ...current, active: result.active }));
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật trạng thái chi nhánh');
    }
  };

  const columns: Column<Branch>[] = [
    { key: 'name', header: 'Tên chi nhánh', render: (branch) => <div className="font-semibold text-foreground">{branch.name}</div> },
    { key: 'contact', header: 'Liên hệ', render: (branch) => (
      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3 text-muted-foreground" />
          <span>{branch.address}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone className="size-3 text-muted-foreground" />
          <span>{branch.phone}</span>
        </div>
      </div>
    )},
    { key: 'plan', header: 'Gói', render: (branch) => (
      <span className="inline-flex w-max items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400">
        {PLAN_OPTIONS.find((plan) => plan.value === branch.plan)?.label ?? branch.plan}
      </span>
    )},
    { key: 'status', header: 'Trạng thái', className: 'text-center', render: (branch) => (
      <div className="flex items-center justify-center gap-1.5">
        {branch.active ? (
          <CheckCircle2 className="size-4 text-green-500 dark:text-green-400" />
        ) : (
          <XCircle className="size-4 text-muted-foreground" />
        )}
        {(hasPermission('BRANCH_LOCK') && branch.active) || (hasPermission('BRANCH_UNLOCK') && !branch.active) ? (
          <button
            type="button"
            onClick={() => handleToggleStatus(branch)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              branch.active ? 'bg-primary' : 'bg-input'
            }`}
            aria-label={`Đổi trạng thái ${branch.name}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${
                branch.active ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        ) : null}
      </div>
    )},
    { key: 'actions', header: 'Thao tác', className: 'text-right', render: (branch) => (
      <div className="flex justify-end gap-1.5">
        {hasPermission('BRANCH_UPDATE') && (
          <button
            type="button"
            onClick={() => {
              setResetPasswordBranch(branch);
              setNewPassword('');
              setResetPasswordError(null);
              setResetPasswordSuccess(null);
            }}
            className="inline-flex items-center gap-0.5 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:bg-accent"
          >
            <Lock className="size-3" />
            Đặt lại mật khẩu
          </button>
        )}
        {hasPermission('BRANCH_UPDATE') && (
          <button
            type="button"
            onClick={() => handleEdit(branch)}
            className="inline-flex items-center gap-0.5 rounded-md border border-input px-2 py-1 text-[10px] font-medium text-primary hover:bg-accent"
          >
            <Edit3 className="size-3" />
            Sửa
          </button>
        )}
        {hasPermission('BRANCH_DELETE') && (
          <button
            type="button"
            onClick={() => handleDelete(branch)}
            disabled={deletingId === branch.id}
            className="inline-flex items-center gap-0.5 rounded-md border border-destructive/30 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="size-3" />
            {deletingId === branch.id ? 'Đang xóa...' : 'Xóa'}
          </button>
        )}
        {hasPermission('BRANCH_FORCE_DELETE') && (
          <button
            type="button"
            onClick={() => { setForceDeleteBranch(branch); setConfirmName(''); }}
            className="inline-flex items-center gap-0.5 rounded-md border border-destructive/50 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10"
          >
            Xóa vĩnh viễn
          </button>
        )}
      </div>
    )},
  ];

  const paginatedBranches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return branches.slice(start, start + pageSize);
  }, [branches, page, pageSize]);

  const pagination = useMemo(() => branches.length > pageSize ? {
    page,
    total: branches.length,
    totalPages: Math.ceil(branches.length / pageSize),
    limit: pageSize,
  } : undefined, [branches, page, pageSize]);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-card rounded-md border border-border p-3 flex-shrink-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center">
              <Building2 className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Quản lý chi nhánh</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Quản lý danh sách chi nhánh, gói và trạng thái hoạt động.</p>
            </div>
          </div>

          {hasPermission('BRANCH_CREATE') && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3" />
              Thêm chi nhánh
            </button>
          )}
        </div>
      </div>

      {error && !isCreateModalOpen && !isEditModalOpen && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex-shrink-0">{error}</div>
      )}

      <DataTable
        columns={columns}
        data={branches}
        keyExtractor={(branch) => branch.id}
        loading={loading}
        emptyMessage="Chưa có chi nhánh nào."
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-lg bg-card shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Thêm chi nhánh mới</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Tạo chi nhánh mới.</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="size-3.5" />
                  Đóng
                </button>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Tên chi nhánh</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập tên chi nhánh"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Địa chỉ</span>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập địa chỉ"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Số điện thoại</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập số điện thoại"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Email quản lý</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập email quản lý"
                    required
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Gói</span>
                  <select
                    value={form.plan}
                    onChange={(event) => handlePlanChange(event.target.value as Plan)}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Trạng thái hoạt động</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                    disabled={saving}
                    className="flex w-full items-center justify-between rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={form.active ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground font-medium'}>
                      {form.active ? 'Đang bật' : 'Đang tắt'}
                    </span>
                    <span
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        form.active ? 'bg-primary' : 'bg-input'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${
                          form.active ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Ngày bắt đầu</span>
                  <input
                    type="date"
                    value={form.subscriptionStart}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionStart: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Ngày kết thúc</span>
                  <input
                    type="date"
                    value={form.subscriptionEnd}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionEnd: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving || isSubmittingRef.current}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      'Đang lưu...'
                    ) : (
                      <>
                        <Plus className="size-3" />
                        Thêm chi nhánh
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!editingBranchId && (
                <div className={`space-y-2 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="size-4 text-primary" />
                      <h3 className="text-xs font-semibold text-foreground">Phân quyền theo gói</h3>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5 mb-2">
                      <Check className="size-3 text-primary" />
                      <span className="text-xs font-medium text-foreground">
                        {getPlanPermissionCount(form.plan as PlanKey)} quyền được cấp bởi gói {PLAN_OPTIONS.find((p) => p.value === form.plan)?.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
                      {(() => {
                        const planPerms = new Set(PLAN_PERMISSIONS[form.plan as PlanKey] || []);
                        return MODULE_GROUPS.flatMap((group) => {
                          const groupPerms = group.permissions.filter((p) => selectedPermissions.includes(p) || planPerms.has(p));
                          if (groupPerms.length === 0) return [];
                          const block = (
                            <div key={group.module} className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                              <div className="space-y-0.5">
                                {group.permissions.map((code) => {
                                  const isPlanPerm = planPerms.has(code);
                                  const isSelected = selectedPermissions.includes(code);
                                  const isAdvanced = isAdvancedPermission(code);
                                  if (!isPlanPerm && !isSelected && !isAdvanced) return null;
                                  return (
                                    <label
                                      key={code}
                                      className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm cursor-pointer text-xs transition-colors ${
                                        isPlanPerm
                                          ? 'bg-primary/5 text-foreground'
                                          : isSelected
                                          ? 'bg-accent text-foreground'
                                          : 'text-muted-foreground hover:bg-accent/50'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isPlanPerm || isSelected}
                                        disabled={isPlanPerm}
                                        onChange={() => togglePermission(code)}
                                        className="rounded border-input text-primary focus:ring-primary/20 disabled:opacity-60 size-3"
                                      />
                                      <span className="flex-1 text-[10px]">{code}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                          return [block];
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-lg bg-card shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Cập nhật chi nhánh</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Chỉnh sửa thông tin chi nhánh.</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="size-3.5" />
                  Đóng
                </button>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Tên chi nhánh</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập tên chi nhánh"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Địa chỉ</span>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập địa chỉ"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Số điện thoại</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập số điện thoại"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Email quản lý</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                    placeholder="Nhập email quản lý"
                    required
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Gói</span>
                  <select
                    value={form.plan}
                    onChange={(event) => handlePlanChange(event.target.value as Plan)}
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Trạng thái hoạt động</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                    disabled={saving}
                    className="flex w-full items-center justify-between rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={form.active ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground font-medium'}>
                      {form.active ? 'Đang bật' : 'Đang tắt'}
                    </span>
                    <span
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        form.active ? 'bg-primary' : 'bg-input'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-card shadow transition-transform ${
                          form.active ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Ngày bắt đầu</span>
                  <input
                    type="date"
                    value={form.subscriptionStart}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionStart: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-foreground">Ngày kết thúc</span>
                  <input
                    type="date"
                    value={form.subscriptionEnd}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionEnd: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:cursor-not-allowed"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving || isSubmittingRef.current}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      'Đang lưu...'
                    ) : (
                      <>
                        <Save className="size-3.5" />
                        Lưu thay đổi
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetPasswordBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <h2 className="text-sm font-semibold text-foreground">
                Đặt lại mật khẩu: {resetPasswordBranch.name}
              </h2>
              <button
                type="button"
                onClick={() => { setResetPasswordBranch(null); setResetPasswordInviteLink(null); }}
                aria-label="Đóng"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-3 space-y-2">
              {resetPasswordError && (
                <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive border border-destructive/20">
                  {resetPasswordError}
                </div>
              )}
              {resetPasswordSuccess && (
                <div className="rounded-md bg-green-500/10 p-2 text-xs text-green-600 dark:text-green-400 border border-green-500/20">
                  {resetPasswordSuccess}
                </div>
              )}

              {!resetPasswordSuccess && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Tài khoản quản lý: <span className="font-semibold text-foreground">{resetPasswordBranch.account?.email || 'N/A'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hệ thống sẽ tạo link đặt lại mật khẩu, gửi cho quản lý chi nhánh để tự đặt mật khẩu mới.
                  </p>
                </>
              )}

              {resetPasswordInviteLink && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Link đặt lại mật khẩu</p>
                    <input
                      type="text"
                      readOnly
                      value={resetPasswordInviteLink}
                      className="w-full rounded-md border border-input bg-input-background px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(resetPasswordInviteLink);
                        setResetPasswordSuccess(`Đã sao chép link đặt lại mật khẩu!`);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <Copy className="size-3.5" />
                      Copy Link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const email = resetPasswordBranch.account?.email || '';
                        const subject = encodeURIComponent('Đặt lại mật khẩu tài khoản');
                        const body = encodeURIComponent(
                          `Xin chào,\n\nLink đặt lại mật khẩu cho tài khoản "${resetPasswordBranch.name}":\n${resetPasswordInviteLink}\n\nLink có hiệu lực trong 24 giờ.`
                        );
                        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`, '_blank');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Mail className="size-3.5" />
                      Gửi qua Gmail
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => { setResetPasswordBranch(null); setResetPasswordInviteLink(null); }}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {resetPasswordSuccess ? 'Đóng' : 'Hủy'}
                </button>
                {!resetPasswordSuccess && (
                  <button
                    type="submit"
                    disabled={resetting}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 dark:bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {resetting ? 'Đang cập nhật...' : 'Xác nhận'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {forceDeleteBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <h2 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                <Trash2 className="size-4" />
                Xoá vĩnh viễn chi nhánh
              </h2>
              <button
                type="button"
                onClick={() => { setForceDeleteBranch(null); setConfirmName(''); }}
                aria-label="Đóng"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3 space-y-2">
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive space-y-1.5">
                <p className="font-semibold">Cảnh báo: Hành động này KHÔNG THỂ hoàn tác!</p>
                <ul className="list-disc pl-3 space-y-0.5">
                  <li>Toàn bộ dữ liệu của chi nhánh <b>"{forceDeleteBranch.name}"</b> sẽ bị xoá vĩnh viễn</li>
                  <li>Bao gồm: đơn hàng, thực đơn, tồn kho, thiết bị POS, tài khoản, báo cáo doanh thu</li>
                  <li>Dữ liệu đã xoá không thể khôi phục</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Nhập đúng tên chi nhánh "<b className="text-destructive">{forceDeleteBranch.name}</b>" để xác nhận xoá:
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={forceDeleteBranch.name}
                  className="w-full rounded-md border border-destructive/30 bg-input-background px-2 py-1.5 text-xs focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20"
                  autoFocus
                />
                {confirmName && confirmName !== forceDeleteBranch.name && (
                  <p className="text-[10px] text-destructive">Tên chi nhánh không chính xác</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => { setForceDeleteBranch(null); setConfirmName(''); }}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleForceDelete}
                  disabled={confirmName !== forceDeleteBranch.name || forceDeleting}
                  className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {forceDeleting ? 'Đang xoá...' : 'Xác nhận xoá vĩnh viễn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
