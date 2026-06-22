import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { AvailablePanel } from './AvailablePanel';
import { ReservedPanel } from './ReservedPanel';
import { OccupiedPanel } from './OccupiedPanel';
import { EditTablePanel } from './EditTablePanel';
import { useEnableTable } from '../hooks';
import type { BilliardTableWithSession } from '../types';
import { cn } from '@/app/components/ui/utils';

const TABLE_TYPE_LABEL: Record<string, string> = {
  BILLIARD: 'Billiard',
  POOL: 'Pool',
  SNOOKER: 'Snooker',
  VIP: 'VIP',
  RESTAURANT: 'Nhà hàng',
};

interface RightPanelProps {
  mode: 'BILLIARD' | 'RESTAURANT';
  table: BilliardTableWithSession | null;
  onClose: () => void;
  onSuccess: () => void;
  onOrderCreated?: () => void;
  autoOpenDrawer?: boolean;
  onAutoOpenDrawerConsumed?: () => void;
  onRefresh?: () => void;
  className?: string;
  layoutMode?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

export function RightPanel({
  mode, table, onClose, onSuccess, onOrderCreated, autoOpenDrawer,
  onAutoOpenDrawerConsumed, onRefresh, className, layoutMode, onDirtyChange,
}: RightPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (table && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [table?.id]);

  const isRestaurant = mode === 'RESTAURANT';
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

  return (
    <div ref={panelRef} className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {layoutMode ? 'Chỉnh sửa bàn' : (table.tableName || table.tableCode)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {table.tableCode} &middot; {mode === 'RESTAURANT' ? 'Nhà hàng' : 'Billiard'}
          </p>
          {!isRestaurant && (
            <p className="text-xs text-muted-foreground">
              {new Intl.NumberFormat('vi-VN').format((table as any).hourlyRate)} ₫ / giờ
            </p>
          )}
          {isRestaurant && (table as any).capacity && (
            <p className="text-xs text-muted-foreground">
              {(table as any).capacity} chỗ
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {layoutMode ? (
          <EditTablePanel mode={mode} table={table} onSuccess={onSuccess} onDirtyChange={onDirtyChange} />
        ) : (
          <>
            {table.status === 'AVAILABLE' && !(table as any).isMerged && (
              <AvailablePanel mode={mode} table={table} onSuccess={isRestaurant ? (onOrderCreated || onSuccess) : onSuccess} />
            )}
            {table.status === 'RESERVED' && (
              isRestaurant ? (
                <div className="space-y-4">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">Đã đặt</span>
                  <p className="text-sm text-muted-foreground">Bàn này đã được đặt trước.</p>
                </div>
              ) : (
                <ReservedPanel table={table} onSuccess={onSuccess} />
              )
            )}
            {(table.status === 'OCCUPIED' || table.status === 'CHECKING_OUT') && (
              <OccupiedPanel
                mode={mode}
                table={table}
                onSuccess={onSuccess}
                onRefresh={onRefresh}
                autoOpenDrawer={autoOpenDrawer}
                onAutoOpenDrawerConsumed={onAutoOpenDrawerConsumed}
              />
            )}
            {table.status === 'AVAILABLE' && (table as any).isMerged && (
              <div className="space-y-4">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400">Đã gộp</span>
                <p className="text-sm text-muted-foreground">Bàn này đã được gộp vào bàn khác.</p>
              </div>
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
