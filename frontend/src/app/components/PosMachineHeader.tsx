import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { LogOut, Clock } from 'lucide-react';
import { POS_MACHINE_TEMPLATES } from '../types';

const MODULE_LABELS: Record<string, string> = {
  ORDER: 'Thu ngân',
  ORDER_DISPATCH: 'Điều phối đơn hàng',
  ORDER_QUEUE: 'Hàng chờ',
  BILLIARD: 'Bi-a',
};

const PATH_MODULE_MAP: Record<string, string> = {
  '/app/pos-system': 'Thu ngân',
  '/app/order-queue': 'Điều phối đơn hàng',
  '/app/billiard': 'Quản lý Billiard',
};

function CurrentTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatted = time.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return <span className="tabular-nums">{formatted}</span>;
}

export function PosMachineHeader() {
  const location = useLocation();
  const { posMachineInfo, posMachineTemplate, posMachineModule, logoutPosMachine } = useAuth();

  const machineName = posMachineInfo?.name ?? '';
  const templateLabel = posMachineTemplate ? (POS_MACHINE_TEMPLATES[posMachineTemplate] ?? posMachineTemplate) : '';
  const moduleLabel = PATH_MODULE_MAP[location.pathname] || (posMachineModule ? (MODULE_LABELS[posMachineModule] ?? posMachineModule) : '');

  const handleLogout = () => {
    logoutPosMachine();
    window.location.href = '/pos-machine/login';
  };

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0 select-none">
      <div className="flex items-center gap-3 text-sm min-w-0">
        <span className="font-semibold text-foreground truncate">{machineName}</span>
        {templateLabel && (
          <>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground shrink-0">{templateLabel}</span>
          </>
        )}
        {moduleLabel && (
          <>
            <span className="text-muted-foreground">|</span>
            <span className="shrink-0">{moduleLabel}</span>
          </>
        )}
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <CurrentTime />
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors touch-manipulation shrink-0"
      >
        <LogOut className="w-4 h-4" />
        Đăng xuất
      </button>
    </header>
  );
}
