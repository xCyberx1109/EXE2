import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineName: string;
  pin: string;
}

export function PinResultModal({ open, onOpenChange, machineName, pin }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-6 text-center">
        <h2 className="text-lg font-bold mb-2">Máy POS đã được tạo</h2>
        <p className="text-sm text-muted-foreground mb-4">{machineName}</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800 font-medium mb-2">Mã PIN đăng nhập</p>
          <div className="text-3xl font-bold tracking-[0.3em] text-blue-700 font-mono">
            {pin}
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Vui lòng sao chép mã PIN này và chuyển cho nhân viên
          </p>
        </div>

        <button
          onClick={() => onOpenChange(false)}
          className="flex items-center gap-2 mx-auto px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
          Đóng
        </button>
      </div>
    </div>
  );
}
