import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { AvailablePanel } from './AvailablePanel';
import { ReservedPanel } from './ReservedPanel';
import { OccupiedPanel } from './OccupiedPanel';
import { useEnableTable } from '../hooks';
import type { BilliardTableWithSession } from '../types';
import { cn } from '@/app/components/ui/utils';

const TABLE_TYPE_LABEL: Record<string, string> = {
  POOL: 'Pool',
  SNOOKER: 'Snooker',
  VIP: 'VIP',
};

interface RightPanelProps {
  table: BilliardTableWithSession | null;
  onClose: () => void;
  onSuccess: () => void;
  className?: string;
}

export function RightPanel({ table, onClose, onSuccess, className }: RightPanelProps) {
  if (!table) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Table Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
          Select a table to view details and take actions.
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{table.tableName || table.tableCode}</h2>
          <p className="text-xs text-muted-foreground">
            {table.tableCode} &middot; {TABLE_TYPE_LABEL[table.tableType] || table.tableType}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {table.status === 'AVAILABLE' && (
          <AvailablePanel table={table} onSuccess={onSuccess} />
        )}
        {table.status === 'RESERVED' && (
          <ReservedPanel table={table} onSuccess={onSuccess} />
        )}
        {(table.status === 'OCCUPIED' || table.status === 'CHECKING_OUT') && (
          <OccupiedPanel table={table} onSuccess={onSuccess} />
        )}
        {table.status === 'CLEANING' && (
          <div className="space-y-4">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              Cleaning
            </span>
            <p className="text-sm text-muted-foreground">
              This table is being cleaned and will be available soon.
            </p>
          </div>
        )}
        {table.status === 'DISABLED' && (
          <EnableButton tableId={table.id} onSuccess={onSuccess} />
        )}
      </div>
    </div>
  );
}

function EnableButton({ tableId, onSuccess }: { tableId: string; onSuccess: () => void }) {
  const enableTable = useEnableTable();

  return (
    <div className="space-y-4">
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
        Disabled
      </span>
      <p className="text-sm text-muted-foreground">
        This table is currently disabled.
      </p>
      <Button
        className="w-full"
        onClick={async () => {
          await enableTable.mutateAsync(tableId);
          onSuccess();
        }}
        disabled={enableTable.isPending}
      >
        {enableTable.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Available
      </Button>
    </div>
  );
}
