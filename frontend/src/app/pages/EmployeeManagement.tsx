import { useState, useRef } from 'react';
import {
  Plus, Search, Loader2, Trash2, Edit3, Copy, Check, Printer, RotateCcw, Eye,
} from 'lucide-react';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { useAuth } from '../context/AuthContext';
import {
  useEmployeeList, useCreateEmployeeMutation,
  useUpdateEmployeeMutation, useDeleteEmployeeMutation, useResetPinMutation,
  useRoleList,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { DataTable, type Column } from '../components/DataTable';
import { posMachineApi } from '../api/posServices';
import EmployeeDetailDialog from '../components/EmployeeDetailDialog';
import type { Employee, EmployeeFormData, EmployeeCreateResponse, PosMachine } from '../types';

const emptyForm = (): EmployeeFormData => ({
  employeeCode: '',
  fullName: '',
  phone: '',
  email: '',
  pinCode: '',
  status: 'ACTIVE',
  roleId: '',
  assignedMachineIds: [],
});

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngưng hoạt động' },
  { value: 'SUSPENDED', label: 'Đã khóa' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-300',
  INACTIVE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  SUSPENDED: 'bg-red-100 text-red-800 border-red-300',
};

export function EmployeeManagement() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('STAFF_CREATE');
  const canUpdate = hasPermission('STAFF_UPDATE');
  const canDelete = hasPermission('STAFF_DELETE');
  const canResetPin = hasPermission('STAFF_RESET_PIN');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(search, 300);

  const { data: employeesData, isLoading } = useEmployeeList({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });
  const { data: roles = [] } = useRoleList();

  const employees = employeesData?.data ?? [];
  const pagination = employeesData?.pagination;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value === 'all' ? '' : value);
    setPage(1);
  };

  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const deleteMutation = useDeleteEmployeeMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [machines, setMachines] = useState<PosMachine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(false);

  const [pinModalData, setPinModalData] = useState<{ employeeName: string; employeeCode: string; pin: string } | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [resetPinResult, setResetPinResult] = useState<{ employeeId: string; generatedPin: string } | null>(null);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const resetPinMutation = useResetPinMutation();
  const printRef = useRef<HTMLDivElement>(null);

  const isEditing = !!editing;

  const resetForm = () => {
    setForm(emptyForm());
    setFormError(null);
    setEditing(null);
  };

  const copyPin = async (pin: string) => {
    try {
      await navigator.clipboard.writeText(pin);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = pin;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    }
  };

  const printPin = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>PIN nhân viên</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;">
          <h2>PIN đăng nhập POS</h2>
          <p style="font-size:18px;margin:8px 0;">Nhân viên: ${pinModalData?.employeeName}</p>
          <p style="font-size:14px;color:#666;margin:4px 0;">Mã: ${pinModalData?.employeeCode}</p>
          <div style="font-size:48px;letter-spacing:8px;margin:24px 0;font-weight:bold;">${pinModalData?.pin}</div>
          <p style="color:#999;font-size:12px;">Vui lòng giữ PIN bí mật</p>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const openCreate = async () => {
    resetForm();
    setLoadingMachines(true);
    setDialogOpen(true);
    try {
      const data = await posMachineApi.list();
      setMachines(data);
    } catch {
      setMachines([]);
    } finally {
      setLoadingMachines(false);
    }
  };

  const openEdit = async (emp: Employee) => {
    setEditing(emp);
    setForm({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      phone: emp.phone || '',
      email: emp.email || '',
      pinCode: '',
      status: emp.status,
      roleId: emp.roleId || '',
      assignedMachineIds: [...emp.assignedMachineIds],
    });
    setFormError(null);

    setLoadingMachines(true);
    setDialogOpen(true);
    try {
      const data = await posMachineApi.list();
      setMachines(data);
    } catch {
      setMachines([]);
    } finally {
      setLoadingMachines(false);
    }
  };

  const handleToggleMachine = (machineId: string) => {
    setForm((prev) => {
      const exists = prev.assignedMachineIds.includes(machineId);
      return {
        ...prev,
        assignedMachineIds: exists
          ? prev.assignedMachineIds.filter((id) => id !== machineId)
          : [...prev.assignedMachineIds, machineId],
      };
    });
  };

  const handleSave = async () => {
    setFormError(null);

    if (!form.employeeCode.trim()) { setFormError('Vui lòng nhập mã nhân viên'); return; }
    if (!form.fullName.trim()) { setFormError('Vui lòng nhập họ tên'); return; }
    if (isEditing && form.pinCode && form.pinCode.length !== 6) {
      setFormError('Mã PIN phải có 6 chữ số');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        const body: Record<string, unknown> = { ...form };
        if (!body.pinCode) delete body.pinCode;
        await updateMutation.mutateAsync({ id: editing.id, ...body } as any);
        setDialogOpen(false);
        resetForm();
      } else {
        const createPayload = { ...form };
        delete createPayload.pinCode;
        const result = await createMutation.mutateAsync(createPayload) as EmployeeCreateResponse;
        setDialogOpen(false);
        resetForm();
        if (result.generatedPin) {
          setPinModalData({
            employeeName: result.employee.fullName,
            employeeCode: result.employee.employeeCode,
            pin: result.generatedPin,
          });
          setPinCopied(false);
        }
      }
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

  const tablePagination = pagination ? { page, totalPages: pagination.totalPages, total: pagination.total, limit: pageSize } : undefined;

  const columns: Column<Employee>[] = [
    {
      key: 'employeeCode',
      header: 'Mã NV',
      render: (item) => <span className="font-mono text-xs">{item.employeeCode}</span>,
    },
    {
      key: 'fullName',
      header: 'Họ tên',
      render: (item) => <span className="font-medium">{item.fullName}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell text-muted-foreground',
      render: (item) => <>{item.email || '—'}</>,
    },
    {
      key: 'phone',
      header: 'Điện thoại',
      headerClassName: 'hidden sm:table-cell',
      className: 'hidden sm:table-cell text-muted-foreground',
      render: (item) => <>{item.phone || '—'}</>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (item) => (
        <Badge variant="outline" className={STATUS_COLORS[item.status]}>
          {STATUS_OPTIONS.find((o) => o.value === item.status)?.label || item.status}
        </Badge>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      headerClassName: 'hidden md:table-cell',
      className: 'hidden md:table-cell',
      render: (item) => item.roleName
        ? <Badge variant="secondary">{item.roleName}</Badge>
        : <span className="text-muted-foreground text-xs">Chưa gán</span>,
    },
    {
      key: 'machines',
      header: 'Máy POS',
      headerClassName: 'hidden lg:table-cell',
      className: 'hidden lg:table-cell',
      render: (item) => (
        <span className="text-muted-foreground text-xs">{item.assignedMachineIds.length} máy</span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setDetailEmployeeId(item.id)} title="Xem chi tiết">
            <Eye className="w-4 h-4" />
          </Button>
          {canResetPin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const result = await resetPinMutation.mutateAsync(item.id);
                  setPinModalData({
                    employeeName: item.fullName,
                    employeeCode: item.employeeCode,
                    pin: result.generatedPin,
                  });
                  setResetPinResult(result);
                  setPinCopied(false);
                } catch { /* ignore */ }
              }}
              title="Đặt lại mã PIN"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          {canUpdate && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
              <Edit3 className="w-4 h-4" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quản lý nhân viên</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quản lý nhân viên và phân quyền sử dụng máy POS
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Thêm nhân viên
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm nhân viên..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tất cả trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={employees} keyExtractor={(item) => item.id} loading={isLoading} emptyMessage="Chưa có nhân viên nào" pagination={tablePagination} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Sửa nhân viên' : 'Thêm nhân viên'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Cập nhật thông tin và phân quyền máy POS' : 'Nhập thông tin và phân quyền máy POS'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mã nhân viên</label>
                <Input
                  value={form.employeeCode}
                  onChange={(e) => setForm((p) => ({ ...p, employeeCode: e.target.value }))}
                  placeholder="VD: EMP-004"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Họ tên</label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Điện thoại</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0901234567"
                />
              </div>
            </div>

            {isEditing && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Mã PIN <span className="text-muted-foreground font-normal">(để trống nếu không đổi)</span>
                </label>
                <Input
                  type="password"
                  value={form.pinCode}
                  onChange={(e) => setForm((p) => ({ ...p, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="6 chữ số"
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Trạng thái</label>
                <Select
                  value={form.status}
                  onValueChange={(v: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => setForm((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Vai trò</label>
                <Select
                  value={form.roleId || 'none'}
                  onValueChange={(v) => setForm((p) => ({ ...p, roleId: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chưa gán vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Chưa gán</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Máy POS được phép sử dụng</label>
              <p className="text-xs text-muted-foreground">Chọn máy POS nhân viên được phép đăng nhập</p>
              {loadingMachines ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách máy POS...
                </div>
              ) : machines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Chưa có máy POS nào</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {machines.map((machine) => (
                    <label
                      key={machine.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        form.assignedMachineIds.includes(machine.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.assignedMachineIds.includes(machine.id)}
                        onChange={() => handleToggleMachine(machine.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{machine.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{machine.template}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {formError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Đang lưu...</> : (isEditing ? 'Cập nhật' : 'Thêm nhân viên')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Success Modal */}
      <Dialog
        open={!!pinModalData}
        onOpenChange={(open) => {
          if (!open) {
            setPinModalData(null);
            setResetPinResult(null);
            setPinCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              {resetPinResult ? 'Đặt lại PIN thành công' : 'Tạo nhân viên thành công'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {resetPinResult
                ? `PIN mới cho nhân viên ${pinModalData?.employeeName}`
                : `PIN đăng nhập POS cho ${pinModalData?.employeeName} (${pinModalData?.employeeCode})`
              }
            </DialogDescription>
          </DialogHeader>

          <div ref={printRef} className="flex flex-col items-center py-6 space-y-4">
            <div className="text-sm text-muted-foreground">Mã PIN đăng nhập POS</div>
            <div className="text-5xl font-mono font-bold tracking-[0.3em] text-primary select-all">
              {pinModalData?.pin}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => copyPin(pinModalData?.pin || '')}>
              {pinCopied ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
              {pinCopied ? 'Đã sao chép' : 'Sao chép PIN'}
            </Button>
            <Button variant="outline" onClick={printPin}>
              <Printer className="w-4 h-4 mr-1" /> In phiếu
            </Button>
            <Button onClick={() => { setPinModalData(null); setResetPinResult(null); setPinCopied(false); }}>
              Đóng
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-3">
            PIN chỉ hiển thị một lần duy nhất. Vui lòng sao chép hoặc ghi lại.
          </p>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa nhân viên <strong>{deleteTarget?.fullName}</strong> (mã: {deleteTarget?.employeeCode})?
              <br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Đang xóa...</> : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail + Logs Dialog */}
      <EmployeeDetailDialog
        employeeId={detailEmployeeId ?? ''}
        open={detailEmployeeId !== null}
        onOpenChange={(open) => { if (!open) setDetailEmployeeId(null); }}
      />
    </div>
  );
}
