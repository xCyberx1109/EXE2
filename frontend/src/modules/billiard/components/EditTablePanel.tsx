import { useState, useEffect, useRef } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { toast } from 'sonner';
import { billiardApi } from '@/app/api/services';
import type { BilliardTableWithSession } from '../types';
import { useBilliardTables } from '../hooks';

const TABLE_WIDTH = 180;
const TABLE_HEIGHT = 120;

function rectsOverlap(a: { posX: number; posY: number }, b: { posX: number; posY: number }) {
  const aRight = a.posX + TABLE_WIDTH;
  const aBottom = a.posY + TABLE_HEIGHT;
  const bRight = b.posX + TABLE_WIDTH;
  const bBottom = b.posY + TABLE_HEIGHT;
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

interface EditTablePanelProps {
  table: BilliardTableWithSession;
  onSuccess: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const TABLE_TYPE_OPTIONS = [
  { value: 'POOL', label: 'Pool' },
  { value: 'SNOOKER', label: 'Snooker' },
  { value: 'VIP', label: 'VIP' },
];

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Trống' },
  { value: 'OCCUPIED', label: 'Đang chơi' },
  { value: 'RESERVED', label: 'Đã đặt' },
  { value: 'CLEANING', label: 'Đang vệ sinh' },
  { value: 'CHECKING_OUT', label: 'Đang thanh toán' },
  { value: 'DISABLED', label: 'Đã khóa' },
];

export function EditTablePanel({ table, onSuccess, onDirtyChange }: EditTablePanelProps) {
  const [tableCode, setTableCode] = useState(table.tableCode);
  const [tableName, setTableName] = useState(table.tableName || '');
  const [tableType, setTableType] = useState(table.tableType);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [status, setStatus] = useState(table.status);
  const [posX, setPosX] = useState(String(table.posX));
  const [hourlyRate, setHourlyRate] = useState(String(table.hourlyRate));
  const [posY, setPosY] = useState(String(table.posY));
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);

  const { data: allTables } = useBilliardTables();

  const currentPosX = parseFloat(posX) || 0;
  const currentPosY = parseFloat(posY) || 0;

  const positionChanged = currentPosX !== table.posX || currentPosY !== table.posY;

  const hasOverlap = positionChanged && (allTables ?? []).some(t =>
    t.id !== table.id && rectsOverlap({ posX: currentPosX, posY: currentPosY }, { posX: t.posX, posY: t.posY })
  );

  const computeDirty = () =>
    tableCode !== table.tableCode ||
    tableName !== (table.tableName || '') ||
    tableType !== table.tableType ||
    capacity !== String(table.capacity) ||
    hourlyRate !== String(table.hourlyRate) ||
    status !== table.status ||
    posX !== String(table.posX) ||
    posY !== String(table.posY);

  useEffect(() => {
    setTableCode(table.tableCode);
    setTableName(table.tableName || '');
    setTableType(table.tableType);
    setCapacity(String(table.capacity));
    setHourlyRate(String(table.hourlyRate));
    setStatus(table.status);
    setPosX(String(table.posX));
    setPosY(String(table.posY));
  }, [table]);

  useEffect(() => {
    dirtyRef.current = computeDirty();
    onDirtyChange?.(dirtyRef.current);
  });

  const handleSave = async () => {
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
      await billiardApi.updateTable(table.id, {
        tableCode: tableCode.trim(),
        tableName: tableName.trim() || undefined,
        tableType,
        capacity: cap,
        status,
        posX: currentPosX,
        posY: currentPosY,
        hourlyRate: parseFloat(hourlyRate) || 0,
      });
      toast.success('Cập nhật bàn thành công');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Cập nhật bàn thất bại');
    } finally {
      setSaving(false);
    }
  };

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
        <div className="space-y-1.5">
          <Label htmlFor="et-tableType">Loại bàn</Label>
          <Select value={tableType} onValueChange={(v: 'POOL' | 'SNOOKER' | 'VIP') => setTableType(v)}>
            <SelectTrigger id="et-tableType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          <Label htmlFor="et-posX">Vị trí X</Label>
          <Input id="et-posX" type="number" value={posX} onChange={(e) => setPosX(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-posY">Vị trí Y</Label>
          <Input id="et-posY" type="number" value={posY} onChange={(e) => setPosY(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-hourlyRate">Giá giờ</Label>
          <Input id="et-hourlyRate" type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        </div>
      </div>

      {hasOverlap && (
        <p className="text-xs text-red-500">Vị trí này bị chồng lên với bàn khác.</p>
      )}

      <Button className="w-full" onClick={handleSave} disabled={!computeDirty() || hasOverlap || saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </Button>
    </div>
  );
}