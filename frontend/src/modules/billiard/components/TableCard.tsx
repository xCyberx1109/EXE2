import { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import type { BilliardTableWithSession } from '../types';
import { cn } from '@/app/components/ui/utils';

const STATUS_STYLES: Record<string, { border: string; bg: string; text: string; label: string }> = {
  AVAILABLE: { border: 'border-green-400 dark:border-green-600', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', label: 'Trống' },
  OCCUPIED: { border: 'border-orange-400 dark:border-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', label: 'Có khách' },
  RESERVED: { border: 'border-yellow-400 dark:border-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Đã đặt' },
  CLEANING: { border: 'border-gray-300 dark:border-gray-600', bg: 'bg-gray-50 dark:bg-gray-900/30', text: 'text-gray-500 dark:text-gray-400', label: 'Đang vệ sinh' },
  CHECKING_OUT: { border: 'border-blue-400 dark:border-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', label: 'Đang thanh toán' },
  DISABLED: { border: 'border-gray-300 dark:border-gray-600', bg: 'bg-gray-100 dark:bg-gray-900/50', text: 'text-gray-400 dark:text-gray-500', label: 'Đã khóa' },
};

function useTimer(endTime: string | null, isCountdown: boolean): { display: string; expired: boolean } {
  const [display, setDisplay] = useState('00:00:00');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endTime) { setDisplay('00:00:00'); setExpired(false); return; }

    function tick() {
      const diff = isCountdown
        ? new Date(endTime).getTime() - Date.now()
        : Date.now() - new Date(endTime).getTime();
      if (diff <= 0) {
        if (isCountdown) { setDisplay('00:00:00'); setExpired(true); return; }
        setDisplay('00:00:00'); setExpired(false); return;
      }
      setExpired(false);
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setDisplay(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, isCountdown]);

  return { display, expired };
}

interface TableCardProps {
  mode: 'BILLIARD' | 'RESTAURANT';
  table: BilliardTableWithSession;
  selected: boolean;
  onSelect: (table: BilliardTableWithSession) => void;
  draggable?: boolean;
  onDragStart?: (e: React.MouseEvent, tableId: string) => void;
  position?: { xPercent: number; yPercent: number };
  overlap?: boolean;
  containerSize?: { width: number; height: number };
}

export function TableCard({ mode, table, selected, onSelect, draggable, onDragStart, position, overlap }: TableCardProps) {
  const isRestaurant = mode === 'RESTAURANT';
  const style = STATUS_STYLES[table.status] || STATUS_STYLES.AVAILABLE;
  const isOccupied = table.status === 'OCCUPIED' || table.status === 'CHECKING_OUT';

  const endTime = isRestaurant ? null : table.currentSession?.expectedEndTime ?? null;

  const { display: remaining, expired: timeExpired } = useTimer(endTime, true);

  const xPercent = position?.xPercent ?? table.xPercent ?? table.posX;
  const yPercent = position?.yPercent ?? table.yPercent ?? table.posY;

  const hourlyRate = (table as any).hourlyRate ?? 0;
  const capacity = table.capacity ?? 0;

  return (
    <div
      data-table-id={table.id}
      onMouseDown={draggable && onDragStart ? (e) => onDragStart(e, table.id) : undefined}
      onClick={() => onSelect(table)}
      style={{
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        cursor: draggable ? 'grab' : 'pointer',
      }}
      className={cn(
        'absolute rounded-xl border-2 flex flex-col px-2.5 py-2 shadow-sm select-none transition-all hover:shadow-md overflow-hidden',
        'w-[clamp(120px,10vw,180px)] h-[clamp(80px,8vw,140px)]',
        'text-[clamp(11px,0.9vw,14px)]',
        overlap ? 'border-red-500 ring-2 ring-red-400' : style.border,
        overlap ? 'bg-red-50 dark:bg-red-950/30' : style.bg,
        selected && 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg z-10 scale-105',
        table.status === 'DISABLED' && 'opacity-50',
      )}
    >
      <span className={cn(
        'inline-block self-start rounded px-1.5 py-[1px] text-[clamp(9px,0.7vw,11px)] font-semibold leading-tight',
        overlap ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : cn(style.bg, style.text),
      )}>
        {overlap ? 'CHỒNG LẤN' : style.label}
      </span>

      <span className={cn(
        'font-bold leading-tight mt-0.5 text-[clamp(11px,0.9vw,14px)]',
        overlap ? 'text-red-700 dark:text-red-400' : style.text,
      )}>
        {table.tableName || table.tableCode}
      </span>

      {isRestaurant ? (
        <div className="flex flex-col gap-0.5 mt-1 text-[clamp(9px,0.7vw,11px)] leading-tight text-foreground">
          {isOccupied ? (
            <>
              <span className="text-muted-foreground truncate">{capacity} chỗ</span>
              <span className="text-muted-foreground truncate">{(table as any).currentOrder?.guestCount || 1} khách</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">
                {Number((table as any).currentOrder?.foodTotal ?? (table as any).currentOrder?.total ?? 0).toLocaleString()} ₫
              </span>
            </>
          ) : (
            <span className="mt-auto text-[clamp(9px,0.7vw,11px)] leading-tight text-muted-foreground truncate">
              {capacity} chỗ
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 mt-1 text-[clamp(9px,0.7vw,11px)] leading-tight text-foreground">
          {isOccupied ? (
            <>
              <span className="truncate">{hourlyRate.toLocaleString()} ₫/giờ</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">{table.currentSession?.durationMinutes ?? 0} ph</span>
              <div className={cn('flex items-center gap-1 font-medium', timeExpired ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                {timeExpired ? <AlertCircle className="w-[clamp(10px,0.8vw,14px)] h-[clamp(10px,0.8vw,14px)] shrink-0" /> : <Clock className="w-[clamp(10px,0.8vw,14px)] h-[clamp(10px,0.8vw,14px)] shrink-0" />}
                <span>{remaining}</span>
              </div>
            </>
          ) : (
            <span className="mt-auto text-[clamp(9px,0.7vw,11px)] leading-tight text-muted-foreground truncate">
              {hourlyRate.toLocaleString()} ₫/giờ &middot; {capacity} chỗ
            </span>
          )}
        </div>
      )}
    </div>
  );
}
