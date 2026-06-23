import { useState } from 'react';
import { X } from 'lucide-react';
import type { PosMachineTemplate } from '../../app/types';

const TEMPLATE_OPTIONS = [
  { value: 'CASHIER', label: 'Thu ngân' },
  { value: 'KITCHEN', label: 'Bếp' },
  { value: 'CASHIER_KITCHEN', label: 'Thu ngân & Bếp' },
  { value: 'BILLIARD', label: 'Bi-a' },
  { value: 'RESTAURANT', label: 'Nhà hàng' },
  { value: 'CUSTOM', label: 'Tùy chỉnh' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; template: PosMachineTemplate }) => void;
}

export function CreatePosMachineModal({ open, onOpenChange, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<PosMachineTemplate>('CASHIER');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), template });
    setName('');
    setTemplate('CASHIER');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Tạo máy POS</h2>
          <button onClick={() => onOpenChange(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Tên máy</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Máy POS quầy 1"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Template</label>
            <select
              value={template}
              onChange={e => setTemplate(e.target.value as PosMachineTemplate)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-input-background"
            >
              {TEMPLATE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Template quyết định module và quyền mặc định của máy POS
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Tạo máy POS
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
