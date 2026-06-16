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
  const [display, setDisplay] = useState('00:00');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endTime) {
      setDisplay('00:00');
      setExpired(false);
      return;
    }

    function tick() {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setDisplay('00:00');
        setExpired(true);
        return;
      }
      setExpired(false);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setDisplay(`${mins}:${secs.toString().padStart(2, '0')}`);
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
        'absolute w-[140px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-3 shadow-sm select-none transition-all hover:shadow-md',
        style.border,
        style.bg,
        selected && 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg scale-105 z-10',
      )}
    >
      <span className={cn('text-sm font-bold', style.text)}>{table.tableName || table.tableCode}</span>
      <span className={cn('text-[10px] uppercase tracking-wider', style.text)}>
        {style.label}
      </span>
      {isOccupied && (
        <div className={cn('flex items-center gap-1 text-xs font-medium', timeExpired ? 'text-red-600 dark:text-red-400' : style.text)}>
          {timeExpired ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {remaining}
        </div>
      )}
      {isOccupied && (
        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
          {(table.currentSession?.tableFee ?? 0).toLocaleString()}₫
        </span>
      )}
      {table.currentReservation && table.status === 'RESERVED' && (
        <span className="text-[10px] text-muted-foreground truncate max-w-full">
          {table.currentReservation.customerName}
        </span>
      )}
      <span className="text-[9px] text-muted-foreground uppercase">{table.tableType}</span>
    </div>
  );
}
