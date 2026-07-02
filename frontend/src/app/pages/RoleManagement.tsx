import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Shield, Trash2, Edit3, KeyRound, ChevronDown, ChevronUp, Loader2, Save,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  useRoleList, useCreateRoleMutation, useUpdateRoleMutation,
  useDeleteRoleMutation, useRole, useSetRolePermissionsMutation,
} from '../api/hooks';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { DataTable, type Column } from '../components/DataTable';
import type { Role } from '../types';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

interface RoleForm {
  name: string;
  description: string;
}

const emptyForm = (): RoleForm => ({ name: '', description: '' });

function groupByModule(permissions: Permission[]) {
  const map = new Map<string, Permission[]>();
  for (const p of permissions) {
    if (!map.has(p.module)) map.set(p.module, []);
    map.get(p.module)!.push(p);
  }
  return Array.from(map.entries())
    .map(([module, perms]) => ({ module, perms }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

export function RoleManagement() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('ROLE_MANAGE');

  const [search, setSearch] = useState('');

  const { data: roles = [], isLoading } = useRoleList();
  const createMutation = useCreateRoleMutation();
  const updateMutation = useUpdateRoleMutation();
  const deleteMutation = useDeleteRoleMutation();
  const setPermissionsMutation = useSetRolePermissionsMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [permissionRoleId, setPermissionRoleId] = useState<string | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [savingPermissions, setSavingPermissions] = useState(false);

  const { data: roleDetail } = useRole(permissionRoleId);

  const filteredRoles = useMemo(
    () => roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [roles, search],
  );

  const isEditing = !!editing;

  const resetForm = () => {
    setForm(emptyForm());
    setFormError(null);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setForm({ name: role.name, description: role.description || '' });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Vui lòng nhập tên vai trò'); return; }

    setSaving(true);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: editing.id, name: form.name, description: form.description });
      } else {
        await createMutation.mutateAsync({ name: form.name, description: form.description });
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      setFormError(err?.message || 'Xóa thất bại');
    } finally {
      setDeleting(false);
    }
  };

  const openPermissions = async (role: Role) => {
    setPermissionRoleId(role.id);
    setLoadingPermissions(true);
    try {
      const perms = await api.get<Permission[]>('/rbac/permissions');
      setAllPermissions(perms || []);
      setExpandedModules(new Set());
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    if (roleDetail) {
      setSelectedPermIds(new Set(roleDetail.permissionIds));
    }
  }, [roleDetail]);

  const togglePermission = (id: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module); else next.add(module);
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionRoleId) return;
    setSavingPermissions(true);
    try {
      await setPermissionsMutation.mutateAsync({ id: permissionRoleId, permissionIds: [...selectedPermIds] });
      setPermissionRoleId(null);
    } catch (err: any) {
      alert(err?.message || 'Lưu quyền thất bại');
    } finally {
      setSavingPermissions(false);
    }
  };

  const permissionGroups = useMemo(() => groupByModule(allPermissions), [allPermissions]);

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Tên vai trò',
      render: (role) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{role.name}</span>
          {role.isSystem && <Badge variant="secondary" className="text-[10px]">Mẫu</Badge>}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      className: 'text-muted-foreground max-w-[280px] truncate',
      render: (role) => role.description || '—',
    },
    {
      key: 'employeeCount',
      header: 'Số nhân viên',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (role) => <Badge variant="outline">{role.employeeCount}</Badge>,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (role) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openPermissions(role)} title="Quản lý quyền">
            <KeyRound className="w-4 h-4" />
          </Button>
          {canManage && (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(role)} title="Sửa">
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(role)}
                disabled={role.employeeCount > 0}
                title={role.employeeCount > 0 ? 'Không thể xóa vai trò đang có nhân viên' : 'Xóa'}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quản lý vai trò</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gán bộ quyền tái sử dụng cho nhân viên đăng nhập PIN trên máy POS
            </p>
          </div>
        </div>
        {canManage && (
          <Button variant="default" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Thêm vai trò
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-4 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm theo tên vai trò..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable columns={columns} data={filteredRoles} keyExtractor={(role) => role.id} loading={isLoading} emptyMessage="Chưa có vai trò nào." />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Cập nhật vai trò' : 'Thêm vai trò'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Chỉnh sửa thông tin vai trò' : 'Tạo vai trò mới, sau đó gán quyền và gán cho nhân viên'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tên vai trò *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Thu ngân, Bếp, Quản lý ca"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả ngắn về vai trò này"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Hủy
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Tạo vai trò'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Permissions Dialog */}
      <Dialog open={!!permissionRoleId} onOpenChange={(open) => { if (!open) setPermissionRoleId(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quyền của vai trò "{roleDetail?.name}"</DialogTitle>
            <DialogDescription>
              Nhân viên gán vai trò này sẽ có quyền hiệu lực = giao giữa các quyền được chọn ở đây và quyền theo loại máy POS họ đăng nhập vào.
            </DialogDescription>
          </DialogHeader>

          {loadingPermissions ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải danh sách quyền...
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {permissionGroups.map((group) => {
                const isExpanded = expandedModules.has(group.module);
                const checkedCount = group.perms.filter((p) => selectedPermIds.has(p.id)).length;
                return (
                  <div key={group.module} className="rounded-xl border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleModule(group.module)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-sm font-semibold text-foreground capitalize">{group.module}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {checkedCount}/{group.perms.length}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="divide-y divide-border">
                        {group.perms.map((p) => (
                          <label key={p.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedPermIds.has(p.id)}
                              onChange={() => togglePermission(p.id)}
                              className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{p.code}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.name}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPermissionRoleId(null)}>
              Hủy
            </Button>
            <Button type="button" onClick={handleSavePermissions} disabled={savingPermissions || loadingPermissions}>
              {savingPermissions ? 'Đang lưu...' : <><Save className="w-4 h-4 mr-1" /> Lưu quyền</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa vai trò</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa vai trò <strong>{deleteTarget?.name}</strong>? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
