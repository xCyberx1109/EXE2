import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Copy, Check, Smartphone } from 'lucide-react';

interface PinResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineName: string;
  pin: string;
}

export function PinResultModal({ open, onOpenChange, machineName, pin }: PinResultModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = pin;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Mã PIN máy POS</DialogTitle>

        <div className="text-center space-y-6 py-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-7 h-7 text-primary" />
          </div>

          <div className="space-y-1">
            <p className="text-lg font-semibold">{machineName}</p>
            <p className="text-xs text-muted-foreground">Mã PIN đăng nhập</p>
          </div>

          <div className="bg-muted rounded-xl px-6 py-5 border-2 border-primary/20">
            <div className="text-5xl font-bold tracking-[0.25em] text-foreground font-mono select-all">
              {pin}
            </div>
          </div>

          <Button onClick={handleCopy} className="w-full gap-2 h-11 text-base" variant="outline">
            {copied ? (
              <><Check className="w-5 h-5 text-green-500" />Đã sao chép</>
            ) : (
              <><Copy className="w-5 h-5" />Sao chép mã PIN</>
            )}
          </Button>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              PIN chỉ hiển thị một lần duy nhất. Vui lòng sao chép và gửi cho nhân viên trước khi đóng.
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
