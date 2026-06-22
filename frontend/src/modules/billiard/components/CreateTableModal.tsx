import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useCreateRestaurantTable, useCreateTable } from '../hooks';
import { useAsyncActionGuard } from '@/shared/hooks/useAsyncActionGuard';
import { Loader2 } from 'lucide-react';
import type { BilliardTableWithSession } from '../types';

const TABLE_WIDTH_PERCENT = 10;
const TABLE_HEIGHT_PERCENT = 12;

function rectsOverlap(a: { posX: number; posY: number }, b: { posX: number; posY: number }) {
  const aRight = a.posX + TABLE_WIDTH_PERCENT;
  const aBottom = a.posY + TABLE_HEIGHT_PERCENT;
  const bRight = b.posX + TABLE_WIDTH_PERCENT;
  const bBottom = b.posY + TABLE_HEIGHT_PERCENT;
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

function findEmptySpot(existingTables: BilliardTableWithSession[]): { posX: number; posY: number } {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const posX = 1 + col * (TABLE_WIDTH_PERCENT + 2);
      const posY = 1 + row * (TABLE_HEIGHT_PERCENT + 2);
      const overlap = existingTables.find(t => rectsOverlap({ posX, posY }, { posX: t.xPercent ?? t.posX, posY: t.yPercent ?? t.posY }));
      if (!overlap) return { posX, posY };
    }
  }
  return { posX: 1, posY: 1 };
}

const TABLE_TYPE_OPTIONS = [
  { value: 'BILLIARD', label: 'Billiard' },
  { value: 'POOL', label: 'Pool' },
  { value: 'SNOOKER', label: 'Snooker' },
  { value: 'VIP', label: 'VIP' },
  { value: 'RESTAURANT', label: 'Nhà hàng' },
];

interface CreateTableModalProps {
  mode: 'BILLIARD' | 'RESTAURANT';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  tables: BilliardTableWithSession[];
}

export function CreateTableModal({ mode, open, onOpenChange, onSuccess, tables }: CreateTableModalProps) {
  const [tableName, setTableName] = useState('');
  const [tableCode, setTableCode] = useState('');
  const [tableType, setTableType] = useState(mode === 'RESTAURANT' ? 'RESTAURANT' : 'POOL');
  const [hourlyRate, setHourlyRate] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [xPercent, setXPercent] = useState('');
  const [yPercent, setYPercent] = useState('');
  const createTable = useCreateTable();
  const createRestaurantTable = useCreateRestaurantTable();

  const isRestaurantMode = mode === 'RESTAURANT';

  const autoPos = useMemo(() => findEmptySpot(tables), [tables]);

  const currentXPercent = xPercent !== '' ? Number(xPercent) : autoPos.posX;
  const currentYPercent = yPercent !== '' ? Number(yPercent) : autoPos.posY;

  const hasOverlap = tables.some(t =>
    rectsOverlap({ posX: currentXPercent, posY: currentYPercent }, { posX: t.xPercent ?? t.posX, posY: t.yPercent ?? t.posY })
  );

  const handleSubmit = useAsyncActionGuard(async () => {
    if (!tableCode.trim()) return;
    const body: any = {
      tableCode: tableCode.trim(),
      tableName: tableName.trim() || undefined,
      tableType: isRestaurantMode ? 'RESTAURANT' : tableType,
      capacity: parseInt(capacity, 10) || 4,
      posX: currentXPercent,
      posY: currentYPercent,
    };
    if (!isRestaurantMode) body.hourlyRate = hourlyRate ? Number(hourlyRate) : undefined;
    if (isRestaurantMode) {
      await createRestaurantTable.mutateAsync(body);
    } else {
      await createTable.mutateAsync(body);
    }
    setTableName('');
    setTableCode('');
    setTableType(mode === 'RESTAURANT' ? 'RESTAURANT' : 'POOL');
    setHourlyRate('');
    setCapacity('4');
    setXPercent('');
    setYPercent('');
    onOpenChange(false);
    onSuccess();
  }, { delay: 500 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm bàn mới</DialogTitle>
          <DialogDescription>Tạo bàn mới trên sơ đồ.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tableCode">Mã bàn *</Label>
            <Input id="tableCode" placeholder="VD: B01" value={tableCode} onChange={(e) => setTableCode(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableName">Tên bàn</Label>
            <Input id="tableName" placeholder="VD: Bàn Pool 1" value={tableName} onChange={(e) => setTableName(e.target.value)} />
          </div>

          {mode === 'BILLIARD' && (
          <div className="space-y-2">
            <Label htmlFor="tableType">Loại bàn</Label>
            <Select value={tableType} onValueChange={(v: string) => setTableType(v)}>
              <SelectTrigger id="tableType"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TABLE_TYPE_OPTIONS.filter(o => o.value !== 'RESTAURANT').map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="xPercent">Vị trí X (%)</Label>
              <Input id="xPercent" type="number" step="0.5" min="0" max="100" placeholder={`Auto: ${autoPos.posX}%`} value={xPercent} onChange={(e) => setXPercent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yPercent">Vị trí Y (%)</Label>
              <Input id="yPercent" type="number" step="0.5" min="0" max="100" placeholder={`Auto: ${autoPos.posY}%`} value={yPercent} onChange={(e) => setYPercent(e.target.value)} />
            </div>
          </div>

          {hasOverlap && <p className="text-xs text-red-500">Vị trí này bị chồng lên với bàn khác.</p>}

          {!isRestaurantMode && (
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Giá giờ</Label>
              <Input id="hourlyRate" type="number" placeholder="80000" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="capacity">Sức chứa</Label>
            <Input id="capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit.run} disabled={handleSubmit.isBusy || !tableCode.trim() || hasOverlap || createTable.isPending || createRestaurantTable.isPending}>
            {(handleSubmit.isBusy || createTable.isPending || createRestaurantTable.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
            Tạo bàn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
