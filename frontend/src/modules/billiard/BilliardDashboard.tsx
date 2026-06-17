import { useState, useCallback, useEffect, useRef } from 'react';
import { TableFloor } from './components/TableFloor';
import { RightPanel } from './components/RightPanel';
import { useBilliardTables } from './hooks';
import type { BilliardTableWithSession } from './types';
import { Loader2, AlertCircle } from 'lucide-react';

export function BilliardDashboard() {
  const { data: tables, isLoading, error, refetch } = useBilliardTables();
  const [selectedTable, setSelectedTable] = useState<BilliardTableWithSession | null>(null);
  const [layoutMode, setLayoutMode] = useState(false);
  const dirtyRef = useRef(false);

  const handleSelect = useCallback((table: BilliardTableWithSession) => {
    if (dirtyRef.current) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Hủy bỏ và chuyển bàn?');
      if (!confirmed) return;
    }
    setSelectedTable(table);
  }, []);

  const selectedIdRef = useRef(selectedTable?.id);
  selectedIdRef.current = selectedTable?.id;

  useEffect(() => {
    if (!selectedIdRef.current || !tables) return;
    const updated = tables.find(t => t.id === selectedIdRef.current);
    if (updated) setSelectedTable(updated);
  }, [tables]);

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
    if (layoutMode) {
      refetch();
      return;
    }
    setSelectedTable(null);
    refetch();
  }, [refetch, layoutMode]);

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
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm text-red-600">Không thể tải danh sách bàn. Vui lòng thử lại.</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-blue-600 hover:underline"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      <div className="flex-1 min-w-0 bg-card rounded-xl border border-border p-4 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableFloor
            tables={tables ?? []}
            selectedId={selectedTable?.id ?? null}
            onSelect={handleSelect}
            onRefresh={handleSuccess}
            layoutMode={layoutMode}
            onLayoutModeChange={handleLayoutModeChange}
          />
        )}
      </div>

      <div className="w-[30%] min-w-[300px] max-w-[420px] bg-card rounded-xl border border-border overflow-hidden">
        <RightPanel
          table={selectedTable}
          onClose={handleClose}
          onSuccess={handlePanelSuccess}
          onRefresh={handleSuccess}
          layoutMode={layoutMode}
          onDirtyChange={(d) => { dirtyRef.current = d; }}
        />
      </div>
    </div>
  );
}
