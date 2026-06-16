import { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import type { BilliardTableWithSession } from '../types';
import { cn } from '@/app/components/ui/utils';

const STATUS_STYLES: Record<string, { border: string; bg: string; text: string; label: string }> = {
  AVAILABLE: { border: 'border-green-400 dark:border-green-600', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', label: 'Available' },
  OCCUPIED: { border: 'border-orange-400 dark:border-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', label: 'Occupied' },
  RESERVED: { border: 'border-yellow-400 dark:border-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Reserved' },
  CLEANING: { border: 'border-gray-300 dark:border-gray-600', bg: 'bg-gray-50 dark:bg-gray-900/30', text: 'text-gray-500 dark:text-gray-400', label: 'Cleaning' },
  CHECKING_OUT: { border: 'border-blue-400 dark:border-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', label: 'Checking Out' },
  DISABLED: { border: 'border-gray-300 dark:border-gray-600', bg: 'bg-gray-100 dark:bg-gray-900/50', text: 'text-gray-400 dark:text-gray-500', label: 'Disabled' },
};

function useCountdown(endTime: string | null): { display: string; expired: boolean } {
  const [display, setDisplay] = useState('00:00:00');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endTime) {
      setDisplay('00:00:00');
      setExpired(false);
      return;
    }

    function tick() {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay('00:00:00');
        setExpired(true);
        return;
      }
      setExpired(false);
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setDisplay(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return { display, expired };
}

interface TableCardProps {
  table: BilliardTableWithSession;
  selected: boolean;
  onSelect: (table: BilliardTableWithSession) => void;
  draggable?: boolean;
  onDragStart?: (e: React.MouseEvent, tableId: string) => void;
  position?: { posX: number; posY: number };
}

export function TableCard({ table, selected, onSelect, draggable, onDragStart, position }: TableCardProps) {
  const style = STATUS_STYLES[table.status] || STATUS_STYLES.AVAILABLE;
  const { display: remaining, expired: timeExpired } = useCountdown(
    table.currentSession?.expectedEndTime ?? null
  );
  const isOccupied = table.status === 'OCCUPIED' || table.status === 'CHECKING_OUT';

  const pos = position ?? { posX: table.posX, posY: table.posY };
  const hourlyRate = table.hourlyRate ?? 0;
  const session = table.currentSession;
  const bookedDuration = session?.durationMinutes ?? 0;

  return (
    <div
      data-table-id={table.id}
      onMouseDown={draggable && onDragStart ? (e) => onDragStart(e, table.id) : undefined}
      onClick={() => onSelect(table)}
      style={{
        left: pos.posX,
        top: pos.posY,
        cursor: draggable ? 'grab' : 'pointer',
      }}
      className={cn(
        'absolute w-[180px] h-[120px] rounded-xl border-2 flex flex-col px-2.5 py-2 shadow-sm select-none transition-all hover:shadow-md overflow-hidden',
        style.border,
        style.bg,
        selected && 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg scale-105 z-10',
        table.status === 'DISABLED' && 'opacity-50',
      )}
    >
      <span className={cn(
        'inline-block self-start rounded px-1.5 py-[1px] text-[10px] font-semibold leading-tight',
        style.bg,
        style.text,
      )}>
        {style.label}
      </span>

      <span className={cn('text-sm font-bold leading-tight mt-0.5', style.text)}>
        {table.tableName || table.tableCode}
      </span>

      {isOccupied ? (
        <div className="flex flex-col gap-0.5 mt-1 text-[11px] leading-tight text-foreground">
          <span>{hourlyRate.toLocaleString()} ₫/hour</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{bookedDuration} min</span>
          <div className={cn('flex items-center gap-1 font-medium', timeExpired ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
            {timeExpired ? <AlertCircle className="w-3 h-3 shrink-0" /> : <Clock className="w-3 h-3 shrink-0" />}
            <span>{remaining}</span>
          </div>
        </div>
      ) : (
        <span className="mt-auto text-[11px] leading-tight text-muted-foreground">
          {hourlyRate.toLocaleString()} ₫/hour
        </span>
      )}
    </div>
  );
}
