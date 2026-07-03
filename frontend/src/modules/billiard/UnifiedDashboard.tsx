import { useState, useCallback, useEffect, useRef } from 'react';
import { TableFloor } from './components/TableFloor';
import { RightPanel } from './components/RightPanel';
import { useBilliardTables, useRestaurantTables } from './hooks';
import type { BilliardTableWithSession } from './types';
import { Loader2, AlertCircle } from 'lucide-react';

interface UnifiedDashboardProps {
  mode: 'BILLIARD' | 'RESTAURANT';
}

export function UnifiedDashboard({
  mode,
  autoOpenDrawer = false,
  onAutoOpenDrawerConsumed,
  onOrderCreated,
}: UnifiedDashboardProps & {
  autoOpenDrawer?: boolean;
  onAutoOpenDrawerConsumed?: () => void;
  onOrderCreated?: () => void;
}) {
  const billiardQuery = useBilliardTables(mode === 'BILLIARD');
  const restaurantQuery = useRestaurantTables(mode === 'RESTAURANT');

  const isLoading = mode === 'BILLIARD' ? billiardQuery.isLoading : restaurantQuery.isLoading;
  const error = mode === 'BILLIARD' ? billiardQuery.error : restaurantQuery.error;
  const refetch = mode === 'BILLIARD' ? billiardQuery.refetch : restaurantQuery.refetch;

  const tables: BilliardTableWithSession[] = mode === 'BILLIARD'
    ? (billiardQuery.data ?? [])
    : (restaurantQuery.data ?? []) as unknown as BilliardTableWithSession[];

  const [selectedTable, setSelectedTable] = useState<BilliardTableWithSession | null>(null);
  const [layoutMode, setLayoutMode] = useState(false);
  const dirtyRef = useRef(false);

  const handleSelect = useCallback((table: BilliardTableWithSession) => {
    if (dirtyRef.current) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Hủy bỏ và chuyển bàn?');
      if (!confirmed) return;
    }
    setSelectedTable(table);
    if (mode === 'RESTAURANT' && table.status === 'AVAILABLE' && !(table as any).isMerged) {
      onAutoOpenDrawerConsumed?.();
    }
  }, [mode, onAutoOpenDrawerConsumed]);

  const selectedIdRef = useRef(selectedTable?.id);
  selectedIdRef.current = selectedTable?.id;

  useEffect(() => {
    if (!selectedIdRef.current || !tables) return;
    const updated = tables.find(t => t.id === selectedIdRef.current);
    if (updated) setSelectedTable(updated);
  }, [tables]);

  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener('pos-refresh', handleRefresh);
    return () => window.removeEventListener('pos-refresh', handleRefresh);
  }, [refetch]);

  const handleClose = useCallback(() => {
    if (layoutMode && dirtyRef.current) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Hủy bỏ?');
      if (!confirmed) return;
    }
    dirtyRef.current = false;
    setSelectedTable(null);
  }, [layoutMode]);

  const handleSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePanelSuccess = useCallback(() => {
    if (layoutMode) { refetch(); return; }
    setSelectedTable(null);
    refetch();
  }, [refetch, layoutMode]);

  const handleOrderCreatedCallback = useCallback(() => {
    refetch();
    onOrderCreated?.();
  }, [refetch, onOrderCreated]);

  const handleLayoutModeChange = useCallback((mode: boolean) => {
    if (!mode && dirtyRef.current) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Hủy bỏ và thoát chế độ chỉnh sửa?');
      if (!confirmed) return;
    }
    setLayoutMode(mode);
    if (!mode) {
      dirtyRef.current = false;
      setSelectedTable(null);
    }
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
          <p className="text-xs text-red-600">Không thể tải danh sách bàn. Vui lòng thử lại.</p>
          <button onClick={() => refetch()} className="text-xs text-blue-600 hover:underline">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-4 min-h-0">
      <div className="flex-1 min-w-0 bg-card rounded-md border border-border p-3 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableFloor
            mode={mode}
            tables={tables ?? []}
            selectedId={selectedTable?.id ?? null}
            onSelect={handleSelect}
            onRefresh={handleSuccess}
            layoutMode={layoutMode}
            onLayoutModeChange={handleLayoutModeChange}
          />
        )}
      </div>

      <div className="w-60 lg:w-72 2xl:w-[380px] shrink-0 bg-card rounded-md border border-border h-full min-h-0 flex flex-col overflow-hidden">
        <RightPanel
          mode={mode}
          table={selectedTable}
          onClose={handleClose}
          onSuccess={handlePanelSuccess}
          onOrderCreated={handleOrderCreatedCallback}
          autoOpenDrawer={autoOpenDrawer}
          onAutoOpenDrawerConsumed={onAutoOpenDrawerConsumed || (() => { })}
          onRefresh={handleSuccess}
          layoutMode={layoutMode}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
        />
      </div>
    </div>
  );
}
