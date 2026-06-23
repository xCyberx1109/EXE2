import { useAuth } from '../context/AuthContext';
import { LogOut, RefreshCw, Lock, Monitor } from 'lucide-react';
import { queryClient } from '../api/queryClient';
import { toast } from 'sonner';
import { POS_MACHINE_TEMPLATES, PosMachineTemplate } from '../types';

export function PosMachineHeader() {
  const { posMachineInfo, posMachineTemplate, logoutPosMachine } = useAuth();

  if (!posMachineInfo) {
    return (
      <div className="h-14 bg-card border-b border-border flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-muted animate-pulse" />
          <div className="w-32 h-4 rounded bg-muted animate-pulse" />
          <div className="w-24 h-4 rounded bg-muted animate-pulse" />
          <div className="w-20 h-4 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-24 h-8 rounded bg-muted animate-pulse" />
          <div className="w-24 h-8 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    // Invalidate any React Query cache
    queryClient.invalidateQueries();
    
    // Dispatch a custom event for components using standard useEffect fetching
    window.dispatchEvent(new Event('pos-refresh'));
    
    toast.success('Đã làm mới dữ liệu máy POS');
  };

  return (
    <div className="bg-card text-card-foreground border-b border-border shadow-sm px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Monitor className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-sm sm:text-base truncate">
            {posMachineInfo.name}
          </h2>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground whitespace-nowrap overflow-x-auto no-scrollbar">
            <span className="font-medium text-foreground">
              {posMachineTemplate ? POS_MACHINE_TEMPLATES[posMachineTemplate as PosMachineTemplate] || posMachineTemplate : 'Không xác định'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  posMachineInfo.status === 'ACTIVE'
                    ? 'bg-green-500'
                    : posMachineInfo.status === 'LOCKED'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
              />
              {posMachineInfo.status}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm font-medium transition-colors gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm font-medium transition-colors gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            alert("Lock machine feature coming soon");
          }}
        >
          <Lock className="w-4 h-4" />
          <span className="hidden sm:inline">Khóa máy</span>
        </button>
        <button
          type="button"
          onClick={logoutPosMachine}
          className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-3 text-sm font-medium transition-colors gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
