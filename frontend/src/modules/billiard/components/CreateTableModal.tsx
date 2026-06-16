import { useState } from 'react';
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

interface CreateTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateTableModal({ open, onOpenChange, onSuccess }: CreateTableModalProps) {
  const [tableName, setTableName] = useState('');
  const [tableCode, setTableCode] = useState('');
  const [tableType, setTableType] = useState<'POOL' | 'SNOOKER' | 'VIP'>('POOL');
  const [hourlyRate, setHourlyRate] = useState('');
  const createTable = useCreateTable();

  const handleSubmit = async () => {
    if (!tableCode.trim()) return;
    await createTable.mutateAsync({
      tableCode: tableCode.trim(),
      tableName: tableName.trim() || undefined,
      tableType,
      hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
    });
    setTableName('');
    setTableCode('');
    setTableType('POOL');
    setHourlyRate('');
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Billiard Table</DialogTitle>
          <DialogDescription>Create a new billiard table on the floor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tableCode">Table Code *</Label>
            <Input
              id="tableCode"
              placeholder="e.g. B01"
              value={tableCode}
              onChange={(e) => setTableCode(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              placeholder="e.g. Pool Table 1"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hourlyRate">Hourly Rate</Label>
            <Input
              id="hourlyRate"
              type="number"
              placeholder="80000"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableType">Table Type</Label>
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
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!tableCode.trim() || createTable.isPending}>
            {createTable.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
