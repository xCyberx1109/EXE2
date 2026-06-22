import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { PosMachineTemplate } from '@/app/types';

const TEMPLATE_OPTIONS = [
  { value: 'CASHIER', label: 'Thu ngân' },
  { value: 'KITCHEN', label: 'Bếp' },
  { value: 'CASHIER_KITCHEN', label: 'Thu ngân & Bếp' },
  { value: 'BILLIARD', label: 'Bi-a' },
  { value: 'CUSTOM', label: 'Tùy chỉnh' },
];

interface CreatePosMachineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; template: PosMachineTemplate }) => Promise<void>;
}

export function CreatePosMachineModal({ open, onOpenChange, onSubmit }: CreatePosMachineModalProps) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<PosMachineTemplate>('CASHIER');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Vui lòng nhập tên máy POS'); return; }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), template });
      setName('');
      setTemplate('CASHIER');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tạo máy thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo máy POS mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Tên máy</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Máy POS quầy 1"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as PosMachineTemplate)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background"
              disabled={submitting}
            >
              {TEMPLATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Template quyết định nhóm permission tự động gán cho máy POS
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Đang tạo...' : 'Tạo máy'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
