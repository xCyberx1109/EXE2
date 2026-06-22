import { useState, useEffect, useRef } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { toast } from 'sonner';
import { billiardApi } from '@/app/api/services';
import { useAsyncActionGuard } from '@/shared/hooks/useAsyncActionGuard';
import type { BilliardTableWithSession } from '../types';
import { useBilliardTables, useRestaurantTables, useUpdateRestaurantTable } from '../hooks';

const TABLE_WIDTH_PERCENT = 10;
const TABLE_HEIGHT_PERCENT = 12;

function rectsOverlap(a: { posX: number; posY: number }, b: { posX: number; posY: number }) {
  const aRight = a.posX + TABLE_WIDTH_PERCENT;
  const aBottom = a.posY + TABLE_HEIGHT_PERCENT;
  const bRight = b.posX + TABLE_WIDTH_PERCENT;
  const bBottom = b.posY + TABLE_HEIGHT_PERCENT;
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

interface EditTablePanelProps {
  mode: 'BILLIARD' | 'RESTAURANT';
  table: BilliardTableWithSession;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const TABLE_TYPE_OPTIONS = [
  { value: 'BILLIARD', label: 'Billiard' },
  { value: 'POOL', label: 'Pool' },
  { value: 'SNOOKER', label: 'Snooker' },
  { value: 'VIP', label: 'VIP' },
  { value: 'RESTAURANT', label: 'Nhà hàng' },
];

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Trống' },
  { value: 'OCCUPIED', label: 'Đang phục vụ' },
  { value: 'RESERVED', label: 'Đã đặt' },
  { value: 'CLEANING', label: 'Đang vệ sinh' },
  { value: 'CHECKING_OUT', label: 'Đang thanh toán' },
  { value: 'DISABLED', label: 'Đã khóa' },
];

export function EditTablePanel({ mode, table, onSuccess, onDirtyChange }: EditTablePanelProps) {
  const [tableCode, setTableCode] = useState(table.tableCode);
  const [tableName, setTableName] = useState(table.tableName || '');
  const [tableType, setTableType] = useState(table.tableType);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [status, setStatus] = useState(table.status);
  const [xPercent, setXPercent] = useState(String(table.xPercent ?? table.posX));
  const [hourlyRate, setHourlyRate] = useState(String(table.hourlyRate));
  const [yPercent, setYPercent] = useState(String(table.yPercent ?? table.posY));
  const isRestaurantMode = mode === 'RESTAURANT';
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const { data: billiardTables } = useBilliardTables();
  const { data: restaurantTables } = useRestaurantTables();
  const updateRestaurantTable = useUpdateRestaurantTable();
  const allTables = mode === 'RESTAURANT' ? restaurantTables : billiardTables;

  const currentXPercent = parseFloat(xPercent) || 0;
  const currentYPercent = parseFloat(yPercent) || 0;

  const positionChanged = currentXPercent !== (table.xPercent ?? table.posX) || currentYPercent !== (table.yPercent ?? table.posY);

  const hasOverlap = positionChanged && (allTables ?? []).some(t =>
    t.id !== table.id && rectsOverlap(
      { posX: currentXPercent, posY: currentYPercent },
      { posX: t.xPercent ?? t.posX, posY: t.yPercent ?? t.posY }
    )
  );

  const computeDirty = () =>
    tableCode !== table.tableCode ||
    tableName !== (table.tableName || '') ||
    (!isRestaurantMode && tableType !== table.tableType) ||
    capacity !== String(table.capacity) ||
    (!isRestaurantMode && hourlyRate !== String(table.hourlyRate)) ||
    status !== table.status ||
    xPercent !== String(table.xPercent ?? table.posX) ||
    yPercent !== String(table.yPercent ?? table.posY);

  useEffect(() => {
    setTableCode(table.tableCode);
    setTableName(table.tableName || '');
    setTableType(table.tableType);
    setCapacity(String(table.capacity));
    setHourlyRate(String(table.hourlyRate));
    setStatus(table.status);
    setXPercent(String(table.xPercent ?? table.posX));
    setYPercent(String(table.yPercent ?? table.posY));
  }, [table]);

  useEffect(() => {
    dirtyRef.current = computeDirty();
    onDirtyChange?.(dirtyRef.current);
  });

  const handleSave = useAsyncActionGuard(async () => {
    if (!tableCode.trim()) {
      toast.error('Mã bàn không được để trống');
      return;
    }
    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1) {
      toast.error('Sức chứa tối thiểu là 1');
      return;
    }
    if (hasOverlap) {
      toast.error('Vị trí bị chồng lên với bàn khác');
      return;
    }
    try {
      setSaving(true);
      const body: any = {
        tableCode: tableCode.trim(),
        tableName: tableName.trim() || undefined,
        tableType: isRestaurantMode ? 'RESTAURANT' : tableType,
        capacity: cap,
        status,
        posX: currentXPercent,
        posY: currentYPercent,
      };
      if (!isRestaurantMode) body.hourlyRate = parseFloat(hourlyRate) || 0;
      if (isRestaurantMode) {
        await updateRestaurantTable.mutateAsync({ id: table.id, body });
      } else {
        await billiardApi.updateTable(table.id, body);
      }
      toast.success('Cập nhật bàn thành công');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Cập nhật bàn thất bại');
    } finally {
      setSaving(false);
    }
  }, { delay: 500 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="et-tableCode">Mã bàn</Label>
          <Input id="et-tableCode" value={tableCode} onChange={(e) => setTableCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-tableName">Tên bàn</Label>
          <Input id="et-tableName" value={tableName} onChange={(e) => setTableName(e.target.value)} />
        </div>
        {mode === 'BILLIARD' && (
        <div className="space-y-1.5">
          <Label htmlFor="et-tableType">Loại bàn</Label>
          <Select value={tableType} onValueChange={(v: string) => setTableType(v)}>
            <SelectTrigger id="et-tableType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_TYPE_OPTIONS.filter((o) => o.value !== 'RESTAURANT').map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="et-capacity">Sức chứa</Label>
          <Input id="et-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-status">Trạng thái</Label>
          <Select value={status} onValueChange={(v: string) => setStatus(v)}>
            <SelectTrigger id="et-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-xPercent">Vị trí X (%)</Label>
          <Input id="et-xPercent" type="number" step="0.5" min="0" max="100" value={xPercent} onChange={(e) => setXPercent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-yPercent">Vị trí Y (%)</Label>
          <Input id="et-yPercent" type="number" step="0.5" min="0" max="100" value={yPercent} onChange={(e) => setYPercent(e.target.value)} />
        </div>
        {!isRestaurantMode && (
          <div className="space-y-1.5">
            <Label htmlFor="et-hourlyRate">Giá giờ</Label>
            <Input id="et-hourlyRate" type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
          </div>
        )}
      </div>

      {hasOverlap && (
        <p className="text-xs text-red-500">Vị trí này bị chồng lên với bàn khác.</p>
      )}

      <Button className="w-full" onClick={handleSave.run} disabled={handleSave.isBusy || !computeDirty() || hasOverlap || saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </Button>
    </div>
  );
}
