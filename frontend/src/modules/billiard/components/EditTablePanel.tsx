import { useState, useEffect, useRef } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { toast } from 'sonner';
import { billiardApi } from '@/app/api/services';
import type { BilliardTableWithSession } from '../types';

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
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'CHECKING_OUT', label: 'Checking Out' },
  { value: 'DISABLED', label: 'Disabled' },
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
      toast.error('Table code is required');
      return;
    }
    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1) {
      toast.error('Capacity must be at least 1');
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
        posX: parseFloat(posX) || 0,
        posY: parseFloat(posY) || 0,
        hourlyRate: parseFloat(hourlyRate) || 0,
      });
      toast.success('Table updated');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update table');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="et-tableCode">Table Code</Label>
          <Input id="et-tableCode" value={tableCode} onChange={(e) => setTableCode(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-tableName">Table Name</Label>
          <Input id="et-tableName" value={tableName} onChange={(e) => setTableName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-tableType">Table Type</Label>
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
          <Label htmlFor="et-capacity">Capacity</Label>
          <Input id="et-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-status">Status</Label>
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
          <Label htmlFor="et-posX">Position X</Label>
          <Input id="et-posX" type="number" value={posX} onChange={(e) => setPosX(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-posY">Position Y</Label>
          <Input id="et-posY" type="number" value={posY} onChange={(e) => setPosY(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="et-hourlyRate">Hourly Rate</Label>
          <Input id="et-hourlyRate" type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        </div>
      </div>

      <Button className="w-full" onClick={handleSave} disabled={!computeDirty() || saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
