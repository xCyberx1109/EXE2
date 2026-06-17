import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useCreateTable } from '../hooks';
import { Loader2 } from 'lucide-react';
import type { BilliardTableWithSession } from '../types';

const TABLE_WIDTH = 180;
const TABLE_HEIGHT = 120;

function rectsOverlap(a: { posX: number; posY: number; width?: number; height?: number }, b: { posX: number; posY: number; width?: number; height?: number }) {
  const aRight = a.posX + (a.width ?? TABLE_WIDTH);
  const aBottom = a.posY + (a.height ?? TABLE_HEIGHT);
  const bRight = b.posX + (b.width ?? TABLE_WIDTH);
  const bBottom = b.posY + (b.height ?? TABLE_HEIGHT);
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

function findEmptySpot(existingTables: BilliardTableWithSession[]): { posX: number; posY: number } {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const posX = col * (TABLE_WIDTH + 20);
      const posY = row * (TABLE_HEIGHT + 20);
      const overlap = existingTables.find(t => rectsOverlap({ posX, posY }, { posX: t.posX, posY: t.posY }));
      if (!overlap) {
        return { posX, posY };
      }
    }
  }
  return { posX: 0, posY: 0 };
}

interface CreateTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  tables: BilliardTableWithSession[];
}

export function CreateTableModal({ open, onOpenChange, onSuccess, tables }: CreateTableModalProps) {
  const [tableName, setTableName] = useState('');
  const [tableCode, setTableCode] = useState('');
  const [tableType, setTableType] = useState<'POOL' | 'SNOOKER' | 'VIP'>('POOL');
  const [hourlyRate, setHourlyRate] = useState('');
  const [posX, setPosX] = useState('');
  const [posY, setPosY] = useState('');
  const createTable = useCreateTable();

  const autoPos = useMemo(() => findEmptySpot(tables), [tables]);

  const currentPosX = posX !== '' ? Number(posX) : autoPos.posX;
  const currentPosY = posY !== '' ? Number(posY) : autoPos.posY;

  const hasOverlap = tables.some(t =>
    rectsOverlap({ posX: currentPosX, posY: currentPosY }, { posX: t.posX, posY: t.posY })
  );

  const handleSubmit = async () => {
    if (!tableCode.trim()) return;
    await createTable.mutateAsync({
      tableCode: tableCode.trim(),
      tableName: tableName.trim() || undefined,
      tableType,
      capacity: 4,
      posX: currentPosX,
      posY: currentPosY,
      hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
    });
    setTableName('');
    setTableCode('');
    setTableType('POOL');
    setHourlyRate('');
    setPosX('');
    setPosY('');
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm bàn bi-a</DialogTitle>
          <DialogDescription>Tạo bàn bi-a mới trên sơ đồ.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tableCode">Mã bàn *</Label>
            <Input
              id="tableCode"
              placeholder="VD: B01"
              value={tableCode}
              onChange={(e) => setTableCode(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableName">Tên bàn</Label>
            <Input
              id="tableName"
              placeholder="VD: Bàn Pool 1"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="posX">Vị trí X</Label>
              <Input
                id="posX"
                type="number"
                placeholder={`Auto: ${autoPos.posX}`}
                value={posX}
                onChange={(e) => setPosX(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posY">Vị trí Y</Label>
              <Input
                id="posY"
                type="number"
                placeholder={`Auto: ${autoPos.posY}`}
                value={posY}
                onChange={(e) => setPosY(e.target.value)}
              />
            </div>
          </div>

          {hasOverlap && (
            <p className="text-xs text-red-500">Vị trí này bị chồng lên với bàn khác.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="hourlyRate">Giá giờ</Label>
            <Input
              id="hourlyRate"
              type="number"
              placeholder="80000"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableType">Loại bàn</Label>
            <Select value={tableType} onValueChange={(v: 'POOL' | 'SNOOKER' | 'VIP') => setTableType(v)}>
              <SelectTrigger id="tableType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POOL">Pool</SelectItem>
                <SelectItem value="SNOOKER">Snooker</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={!tableCode.trim() || hasOverlap || createTable.isPending}>
            {createTable.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Tạo bàn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}