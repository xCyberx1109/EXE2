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
  Send,
  RefreshCw,
  Ban,
  Hourglass,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { branchApi, invitationApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { Branch, BranchInvitation } from '../types';
import type { BranchPayload, CreateBranchResult } from '../api/services';
import { DataTable, type Column } from '../components/DataTable';

type Plan = Branch['plan'];
type SubscriptionStatus = Branch['subscriptionStatus'];

const PLAN_OPTIONS: Array<{ value: Plan; label: string }> = [
  { value: 'BASIC', label: 'Cơ bản' },
  { value: 'STANDARD', label: 'Chuyên nghiệp' },
  { value: 'PREMIUM', label: 'Doanh nghiệp' },
];

type BranchFormState = {
  plan: Plan;
  active: boolean;
  email: string;
};

const createDefaultForm = (): BranchFormState => ({
  plan: 'BASIC',
  active: true,
  email: '',
});

export function BranchManagement() {
  const { hasPermission } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [invitations, setInvitations] = useState<BranchInvitation[]>([]);
  const [activeTab, setActiveTab] = useState<'branches' | 'invitations'>('branches');
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

  const isEditing = Boolean(editingBranchId);
  const isEditModalOpen = Boolean(editingBranchId);

  const fetchBranches = async () => {
    try {
      setError(null);
      const data = await branchApi.list();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách chi nhánh');
    }
  };

  const fetchInvitations = async () => {
    try {
      setError(null);
      const data = await invitationApi.list();
      setInvitations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách lời mời');
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchBranches(), fetchInvitations()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
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
  };

  const handleOpenCreateModal = () => {
    setError(null);
    setEditingBranchId(null);
    setForm(createDefaultForm());
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmittingRef.current) return;
    if (saving) return;

    if (!form.email.trim()) {
      setError('Vui lòng nhập email quản lý');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      setError(null);

      if (editingBranchId) {
        const payload: any = { email: form.email.trim(), name: '' };
        if (form.plan) payload.name = form.plan;
        const updatedBranch = await branchApi.update(editingBranchId, payload);
        setBranches((current) =>
          current.map((branch) => (branch.id === editingBranchId ? updatedBranch : branch))
        );
      } else {
        await invitationApi.create({
          email: form.email.trim(),
          plan: form.plan,
        });
        toast.success('Đã gửi email mời tạo chi nhánh.');
        await fetchInvitations();
      }

      resetForm();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gửi lời mời');
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
      plan: branch.plan,
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

  const handleResendInvitation = async (invitation: BranchInvitation) => {
    try {
      setError(null);
      await invitationApi.resend(invitation.id);
      toast.success('Đã gửi lại email mời.');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gửi lại lời mời');
    }
  };

  const handleCancelInvitation = async (invitation: BranchInvitation) => {
    if (!window.confirm(`Bạn có chắc muốn hủy lời mời tới "${invitation.email}"?`)) return;
    try {
      setError(null);
      await invitationApi.cancel(invitation.id);
      setInvitations((current) =>
        current.map((inv) => (inv.id === invitation.id ? { ...inv, status: 'CANCELLED' as const } : inv))
      );
      toast.success('Đã hủy lời mời.');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi hủy lời mời');
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

  const statusBadge = (invitation: BranchInvitation) => {
    switch (invitation.status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
            <Hourglass className="size-3" />
            Đã gửi lời mời
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-3" />
            Đã hoàn tất
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400">
            <AlertTriangle className="size-3" />
            Hết hạn
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-muted-foreground">
            <Ban className="size-3" />
            Đã hủy
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="bg-card rounded-md border border-border p-3 flex-shrink-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center">
              <Building2 className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Quản lý chi nhánh</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Quản lý danh sách chi nhánh, lời mời và trạng thái hoạt động.</p>
            </div>
          </div>

          {hasPermission('BRANCH_CREATE') && activeTab === 'branches' && (
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

        <div className="flex gap-4 mt-3 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`pb-2 text-xs font-medium transition-colors relative ${
              activeTab === 'branches'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Chi nhánh
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`pb-2 text-xs font-medium transition-colors relative ${
              activeTab === 'invitations'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Lời mời
            {invitations.filter((i) => i.status === 'PENDING').length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {invitations.filter((i) => i.status === 'PENDING').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && !isCreateModalOpen && !isEditModalOpen && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex-shrink-0">{error}</div>
      )}

      {activeTab === 'branches' && (
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
      )}

      {activeTab === 'invitations' && (
        <div className="bg-card rounded-md border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Đang tải...</div>
            ) : invitations.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Chưa có lời mời nào.</div>
            ) : (
              invitations.map((invitation) => (
                <div key={invitation.id} className="p-3 flex items-center justify-between gap-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{invitation.email}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {invitation.packageName} &middot; {new Date(invitation.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(invitation)}
                    {invitation.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleResendInvitation(invitation)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-accent"
                          title="Gửi lại lời mời"
                        >
                          <RefreshCw className="size-3" />
                          Gửi lại
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelInvitation(invitation)}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10"
                          title="Hủy lời mời"
                        >
                          <Ban className="size-3" />
                          Hủy
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-card shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Thêm chi nhánh mới</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Gửi lời mời tạo chi nhánh qua email.</p>
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

              <div className={`space-y-3 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-foreground">Gói</span>
                    <select
                      value={form.plan}
                      onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as Plan }))}
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
                    <span className="text-xs font-medium text-foreground">Trạng thái</span>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                      disabled={saving}
                      className="flex w-full items-center justify-between rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className={form.active ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground font-medium'}>
                        {form.active ? 'Hoạt động' : 'Không hoạt động'}
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

                </div>

                <button
                  type="submit"
                  disabled={saving || isSubmittingRef.current}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    'Đang gửi...'
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      Gửi lời mời
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-card shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
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

              <div className={`space-y-3 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-foreground">Gói</span>
                    <select
                      value={form.plan}
                      onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as Plan }))}
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
                    <span className="text-xs font-medium text-foreground">Trạng thái</span>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                      disabled={saving}
                      className="flex w-full items-center justify-between rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className={form.active ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground font-medium'}>
                        {form.active ? 'Hoạt động' : 'Không hoạt động'}
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

                </div>

                <button
                  type="submit"
                  disabled={saving || isSubmittingRef.current}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
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
