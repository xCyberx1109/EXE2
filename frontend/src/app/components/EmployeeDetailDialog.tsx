import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Loader2, X } from 'lucide-react';
import { useEmployee, useEmployeeLogs } from '../api/hooks';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from './ui/table';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext,
} from './ui/pagination';
import type { Employee, ActivityLogEntry } from '../types';

interface Props {
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_LABELS: Record<string, string> = {
  POS_EMPLOYEE_LOGIN: 'Đăng nhập POS',
  DEVICE_LOGIN: 'Đăng nhập thiết bị',
  DEVICE_LOGOUT: 'Đăng xuất thiết bị',
  EMPLOYEE_DELETED: 'Xóa nhân viên',
  EMPLOYEE_PIN_RESET: 'Đặt lại mã PIN',
  ORDER_CREATED: 'Tạo đơn hàng',
  ORDER_UPDATED: 'Cập nhật đơn hàng',
  ORDER_PAID: 'Thanh toán đơn hàng',
  ORDER_CANCELLED: 'Hủy đơn hàng',
  ORDER_DELETED: 'Xóa đơn hàng',
  ORDER_KITCHEN_STATUS: 'Cập nhật trạng thái bếp',
  INVENTORY_CREATED: 'Thêm nguyên liệu',
  INVENTORY_UPDATED: 'Cập nhật nguyên liệu',
  INVENTORY_DELETED: 'Xóa nguyên liệu',
  INVENTORY_STOCK_IN: 'Nhập kho',
  INVENTORY_STOCK_OUT: 'Xuất kho',
  STAFF_LOGIN_PIN: 'Đăng nhập (PIN)',
  STAFF_LOGOUT: 'Đăng xuất',
  SHIFT_OPENED: 'Mở ca',
  SHIFT_CLOSED: 'Đóng ca',
};

const MODULE_LABELS: Record<string, string> = {
  POS_MACHINE: 'Máy POS',
  UNIFIED_AUTH: 'Xác thực',
  POS_ORDER: 'Đơn hàng',
  INVENTORY: 'Kho',
  EMPLOYEE: 'Nhân viên',
  STAFF_AUTH: 'Đăng nhập',
  SHIFTS: 'Ca làm việc',
};

function formatTime(dateStr: string) {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: vi });
  } catch {
    return dateStr;
  }
}

function getEntityInfo(log: ActivityLogEntry) {
  const d = log.details;
  if (!d) return null;
  if (d.orderId) return { type: 'ORDER', id: String(d.orderNumber || d.orderId) };
  if (d.ingredientId) return { type: 'INGREDIENT', id: String(d.name || d.ingredientId) };
  if (d.employeeId) return { type: 'EMPLOYEE', id: String(d.employeeCode || d.employeeId) };
  if (d.machineId) return { type: 'POS_DEVICE', id: String(d.machineName || d.machineId) };
  if (d.shiftId) return { type: 'SHIFT', id: String(d.shiftId) };
  return null;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
      <span className="text-gray-500 dark:text-gray-400 text-xs">{label}</span>
      <span className="text-xs font-medium">{value || '—'}</span>
    </div>
  );
}

export default function EmployeeDetailDialog({ employeeId, open, onOpenChange }: Props) {
  const { data: emp, isLoading: empLoading } = useEmployee(employeeId);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const logParams = {
    page,
    limit: 15,
    ...(actionFilter && { action: actionFilter }),
    ...(moduleFilter && { module: moduleFilter }),
  };

  const { data: logsData, isLoading: logsLoading } = useEmployeeLogs(employeeId, logParams);

  const filteredLogs = logsData?.data ?? [];
  const pagination = logsData?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const handleReset = () => {
    setActionFilter('');
    setModuleFilter('');
    setPage(1);
  };

  const hasFilters = actionFilter || moduleFilter;

  const employee = emp as Employee | undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleReset(); } onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{employee?.fullName || 'Nhân viên'}</DialogTitle>
          <DialogDescription>Mã NV: {employee?.employeeCode}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mb-4">
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="logs">Nhật ký</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 overflow-y-auto">
            {empLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : employee ? (
              <div className="space-y-1">
                <InfoRow label="Họ tên" value={employee.fullName} />
                <InfoRow label="Mã nhân viên" value={employee.employeeCode} />
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Số điện thoại" value={employee.phone} />
                <InfoRow label="Trạng thái" value={employee.status === 'ACTIVE' ? 'Đang hoạt động' : employee.status === 'INACTIVE' ? 'Ngưng hoạt động' : 'Tạm khóa'} />
                <InfoRow label="Ngày tạo" value={employee.createdAt ? formatTime(employee.createdAt) : null} />
                <InfoRow label="Lần đăng nhập cuối" value={employee.lastLoginAt ? formatTime(employee.lastLoginAt) : 'Chưa đăng nhập'} />
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">Không tìm thấy thông tin nhân viên</p>
            )}
          </TabsContent>

          <TabsContent value="logs" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 mb-4 shrink-0">
              <Select value={actionFilter || 'all'} onValueChange={(v) => { setActionFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Hành động" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={moduleFilter || 'all'} onValueChange={(v) => { setModuleFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {Object.entries(MODULE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-9">
                  <X className="h-4 w-4 mr-1" /> Xóa lọc
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {logsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-xs">Chưa có hoạt động nào</p>
                  <p className="text-xs mt-1">Nhân viên này chưa có nhật ký hoạt động.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Thời gian</TableHead>
                      <TableHead className="w-[160px]">Hành động</TableHead>
                      <TableHead className="w-[100px]">Module</TableHead>
                      <TableHead className="w-[140px]">Đối tượng</TableHead>
                      <TableHead>Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const entity = getEntityInfo(log);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTime(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium">{ACTION_LABELS[log.action] || log.action}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {MODULE_LABELS[log.module] || log.module}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {entity ? (
                              <span className="font-mono">{entity.type}: {entity.id}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {log.details ? (
                              <details className="text-[10px] text-gray-400">
                                <summary className="cursor-pointer hover:text-gray-600">Xem</summary>
                                <pre className="mt-1 p-1.5 bg-gray-50 dark:bg-gray-900 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-[120px] overflow-y-auto">
                                  {JSON.stringify(log.details, null, 1)}
                                </pre>
                              </details>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {pagination && totalPages > 1 && (
              <div className="shrink-0 pt-4 border-t border-gray-100 dark:border-gray-800">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink isActive={p === page} onClick={() => setPage(p)}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
