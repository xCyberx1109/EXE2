import { useRef, useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { AvailablePanel } from './AvailablePanel';
import { ReservedPanel } from './ReservedPanel';
import { OccupiedPanel } from './OccupiedPanel';
import { EditTablePanel } from './EditTablePanel';
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
  onRefresh?: () => void;
  className?: string;
  layoutMode?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

export function RightPanel({ table, onClose, onSuccess, onRefresh, className, layoutMode, onDirtyChange }: RightPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (table && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [table?.id]);

  if (!table) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {layoutMode ? 'Chỉnh sửa bàn' : 'Chi tiết bàn'}
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
          {layoutMode
            ? 'Nhấp vào bàn trên sơ đồ để chỉnh sửa.'
            : 'Chọn bàn để xem chi tiết và thao tác.'}
        </div>
      </div>
    );
  }

  const orderInfo = table.currentOrder;

  return (
    <div ref={panelRef} className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {layoutMode ? 'Chỉnh sửa bàn' : (table.tableName || table.tableCode)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {table.tableCode} &middot; {TABLE_TYPE_LABEL[table.tableType] || table.tableType}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Intl.NumberFormat('vi-VN').format(table.hourlyRate)} ₫ / giờ
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {layoutMode ? (
          <EditTablePanel table={table} onSuccess={onSuccess} onDirtyChange={onDirtyChange} />
        ) : (
          <>
            {table.status === 'AVAILABLE' && (
              <AvailablePanel table={table} onSuccess={onSuccess} />
            )}
            {table.status === 'RESERVED' && (
              <ReservedPanel table={table} onSuccess={onSuccess} />
            )}
            {(table.status === 'OCCUPIED' || table.status === 'CHECKING_OUT') && (
              <OccupiedPanel table={table} onSuccess={onSuccess} onRefresh={onRefresh} />
            )}
            {table.status === 'CLEANING' && (
              <div className="space-y-4">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Đang vệ sinh
                </span>
                <p className="text-sm text-muted-foreground">
                  Bàn đang được vệ sinh và sẽ sẵn sàng sau.
                </p>
              </div>
            )}
            {table.status === 'DISABLED' && (
              <EnableButton tableId={table.id} onSuccess={onSuccess} />
            )}
          </>
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
        Đã khóa
      </span>
      <p className="text-sm text-muted-foreground">
        Bàn này hiện đang bị khóa.
      </p>
      <Button
        className="w-full"
        onClick={async () => {
          await enableTable.mutateAsync(tableId);
          onSuccess();
        }}
        disabled={enableTable.isPending}
      >
        {enableTable.isPending ? 'Đang mở khóa...' : 'Mở khóa'}
      </Button>
    </div>
  );
}