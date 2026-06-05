import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit3,
  MapPin,
  Phone,
  Plus,
  Save,
  Trash2,
  X,
  XCircle,
  Lock,
} from 'lucide-react';
import { branchApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import type { Branch } from '../types';
import type { BranchPayload } from '../api/services';

type Plan = Branch['plan'];
type SubscriptionStatus = Branch['subscriptionStatus'];

const PLAN_OPTIONS: Array<{ value: Plan; label: string }> = [
  { value: 'BASIC', label: 'Basic' },
  { value: 'PRO', label: 'Pro' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
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

const toPayload = (form: BranchFormState): BranchPayload => ({
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

  const [resetPasswordBranch, setResetPasswordBranch] = useState<Branch | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [forceDeleteBranch, setForceDeleteBranch] = useState<Branch | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [forceDeleting, setForceDeleting] = useState(false);

  const isEditing = Boolean(editingBranchId);
  const isEditModalOpen = Boolean(editingBranchId);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await branchApi.list();
      setBranches(data);
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
      const res = await branchApi.resetManagerPassword(resetPasswordBranch.id);
      setResetPasswordSuccess(
        `Hệ thống đã tự động tạo mật khẩu mới ngẫu nhiên và gửi tới email "${res.accountEmail}" thành công!`
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

    if (!form.name.trim() || !form.address.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('Vui lòng nhập đầy đủ tên chi nhánh, địa chỉ, số điện thoại và email');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      setError(null);
      const payload = toPayload(form);

      if (editingBranchId) {
        const updatedBranch = await branchApi.update(editingBranchId, payload);
        setBranches((current) =>
          current.map((branch) => (branch.id === editingBranchId ? updatedBranch : branch))
        );
      } else {
        const newBranch = await branchApi.create(payload);
        setBranches((current) =>
          [...current, newBranch].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        );
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lý Branch</h1>
              <p className="text-sm text-gray-500 mt-1">Quản lý danh sách chi nhánh, gói và trạng thái hoạt động.</p>
            </div>
          </div>

          {hasPermission('BRANCH_CREATE') && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Thêm chi nhánh
            </button>
          )}
        </div>
      </div>

      {error && !isCreateModalOpen && !isEditModalOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải danh sách chi nhánh...</div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Chưa có chi nhánh nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 font-medium text-gray-700">Tên chi nhánh</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Liên hệ</th>
                  <th className="px-6 py-4 font-medium text-gray-700">Gói</th>
                  <th className="px-6 py-4 font-medium text-gray-700 text-center">Trạng thái</th>
                  <th className="px-6 py-4 font-medium text-gray-700 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{branch.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{branch.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{branch.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex w-max items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {PLAN_OPTIONS.find((plan) => plan.value === branch.plan)?.label ?? branch.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {branch.active ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-300" />
                        )}
                        {(hasPermission('BRANCH_LOCK') && branch.active) || (hasPermission('BRANCH_UNLOCK') && !branch.active) ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(branch)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              branch.active ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                            aria-label={`Đổi trạng thái ${branch.name}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                branch.active ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {hasPermission('BRANCH_UPDATE') && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetPasswordBranch(branch);
                              setNewPassword('');
                              setResetPasswordError(null);
                              setResetPasswordSuccess(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50"
                          >
                            <Lock className="w-4 h-4" />
                            Đặt lại mật khẩu
                          </button>
                        )}
                        {hasPermission('BRANCH_UPDATE') && (
                          <button
                            type="button"
                            onClick={() => handleEdit(branch)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                          >
                            <Edit3 className="w-4 h-4" />
                            Sửa
                          </button>
                        )}
                        {hasPermission('BRANCH_DELETE') && (
                          <button
                            type="button"
                            onClick={() => handleDelete(branch)}
                            disabled={deletingId === branch.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === branch.id ? 'Đang xóa...' : 'Xóa'}
                          </button>
                        )}
                        {hasPermission('BRANCH_FORCE_DELETE') && (
                          <button
                            type="button"
                            onClick={() => { setForceDeleteBranch(branch); setConfirmName(''); }}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                          >
                            Xóa vĩnh viễn
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Thêm chi nhánh mới</h2>
                  <p className="text-sm text-gray-500 mt-1">Tạo branch mới trong modal thêm chi nhánh riêng.</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  Đóng
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Tên chi nhánh</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập tên chi nhánh"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Địa chỉ</span>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập địa chỉ"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Số điện thoại</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập số điện thoại"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Email quản lý</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập email quản lý"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Gói</span>
                  <select
                    value={form.plan}
                    onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as Plan }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Trạng thái hoạt động</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                    disabled={saving}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={form.active ? 'text-green-600 font-medium' : 'text-gray-500 font-medium'}>
                      {form.active ? 'Đang bật' : 'Đang tắt'}
                    </span>
                    <span
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        form.active ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          form.active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Ngày bắt đầu</span>
                  <input
                    type="date"
                    value={form.subscriptionStart}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionStart: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Ngày kết thúc</span>
                  <input
                    type="date"
                    value={form.subscriptionEnd}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionEnd: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving || isSubmittingRef.current}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      'Đang lưu...'
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Thêm chi nhánh
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Cập nhật chi nhánh</h2>
                  <p className="text-sm text-gray-500 mt-1">Chỉnh sửa thông tin branch trong modal cập nhật riêng.</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  Đóng
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Tên chi nhánh</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập tên chi nhánh"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Địa chỉ</span>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập địa chỉ"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Số điện thoại</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập số điện thoại"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Email quản lý</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Nhập email quản lý"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Gói</span>
                  <select
                    value={form.plan}
                    onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value as Plan }))}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan.value} value={plan.value}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Trạng thái hoạt động</span>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, active: !current.active }))}
                    disabled={saving}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={form.active ? 'text-green-600 font-medium' : 'text-gray-500 font-medium'}>
                      {form.active ? 'Đang bật' : 'Đang tắt'}
                    </span>
                    <span
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        form.active ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          form.active ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Ngày bắt đầu</span>
                  <input
                    type="date"
                    value={form.subscriptionStart}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionStart: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Ngày kết thúc</span>
                  <input
                    type="date"
                    value={form.subscriptionEnd}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subscriptionEnd: event.target.value }))
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving || isSubmittingRef.current}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      'Đang lưu...'
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
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
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Đặt lại mật khẩu: {resetPasswordBranch.name}
              </h2>
              <button
                type="button"
                onClick={() => setResetPasswordBranch(null)}
                aria-label="Đóng"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              {resetPasswordError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                  {resetPasswordError}
                </div>
              )}
              {resetPasswordSuccess && (
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 border border-green-100">
                  {resetPasswordSuccess}
                </div>
              )}

              {!resetPasswordSuccess && (
                <>
                  <p className="text-sm text-gray-600">
                    Tài khoản quản lý: <span className="font-semibold">{resetPasswordBranch.account?.email || 'N/A'}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Hệ thống sẽ tự động tạo một mật khẩu mới ngẫu nhiên, gửi qua email cho quản lý chi nhánh, và yêu cầu đổi mật khẩu trong lần đăng nhập kế tiếp.
                  </p>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordBranch(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {resetPasswordSuccess ? 'Đóng' : 'Hủy'}
                </button>
                {!resetPasswordSuccess && (
                  <button
                    type="submit"
                    disabled={resetting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
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
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Xoá vĩnh viễn chi nhánh
              </h2>
              <button
                type="button"
                onClick={() => { setForceDeleteBranch(null); setConfirmName(''); }}
                aria-label="Đóng"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 space-y-2">
                <p className="font-semibold">Cảnh báo: Hành động này KHÔNG THỂ hoàn tác!</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Toàn bộ dữ liệu của chi nhánh <b>"{forceDeleteBranch.name}"</b> sẽ bị xoá vĩnh viễn</li>
                  <li>Bao gồm: đơn hàng, thực đơn, tồn kho, thiết bị POS, tài khoản, báo cáo doanh thu</li>
                  <li>Dữ liệu đã xoá không thể khôi phục</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Nhập đúng tên chi nhánh "<b>{forceDeleteBranch.name}</b>" để xác nhận xoá:
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={forceDeleteBranch.name}
                  className="w-full rounded-lg border border-red-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  autoFocus
                />
                {confirmName && confirmName !== forceDeleteBranch.name && (
                  <p className="text-xs text-red-500">Tên chi nhánh không chính xác</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setForceDeleteBranch(null); setConfirmName(''); }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleForceDelete}
                  disabled={confirmName !== forceDeleteBranch.name || forceDeleting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
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
