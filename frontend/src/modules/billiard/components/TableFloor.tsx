import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Move, Save, X } from 'lucide-react';
import { TableCard } from './TableCard';
import { CreateTableModal } from './CreateTableModal';
import { useUpdateLayout } from '../hooks';
import type { BilliardTableWithSession, SortPriority } from '../types';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/app/context/AuthContext';

function getSortPriority(table: BilliardTableWithSession): SortPriority {
  if (table.status === 'OCCUPIED') {
    const endTime = table.currentSession?.expectedEndTime;
    if (endTime && new Date(endTime).getTime() - Date.now() <= 15 * 60 * 1000) {
      return 'OCCUPIED_ENDING';
    }
    return 'OCCUPIED';
  }
  if (table.status === 'RESERVED') return 'RESERVED';
  if (table.status === 'AVAILABLE') return 'AVAILABLE';
  if (table.status === 'CLEANING') return 'CLEANING';
  if (table.status === 'CHECKING_OUT') return 'CHECKING_OUT';
  return 'DISABLED';
}

const PRIORITY_ORDER: SortPriority[] = [
  'OCCUPIED_ENDING',
  'OCCUPIED',
  'RESERVED',
  'AVAILABLE',
  'CLEANING',
  'CHECKING_OUT',
  'DISABLED',
];

interface TableFloorProps {
  tables: BilliardTableWithSession[];
  selectedId: string | null;
  onSelect: (table: BilliardTableWithSession) => void;
  onRefresh: () => void;
  layoutMode: boolean;
  onLayoutModeChange: (mode: boolean) => void;
}

export function TableFloor({ tables, selectedId, onSelect, onRefresh, layoutMode, onLayoutModeChange }: TableFloorProps) {
  const { hasPermission } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [positions, setPositions] = useState<Record<string, { posX: number; posY: number }>>({});
  const updateLayout = useUpdateLayout();

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(getSortPriority(a));
      const pb = PRIORITY_ORDER.indexOf(getSortPriority(b));
      return pa - pb;
    });
  }, [tables]);

  const handleToggleLayout = () => {
    const pos: Record<string, { posX: number; posY: number }> = {};
    tables.forEach((t) => { pos[t.id] = { posX: t.posX, posY: t.posY }; });
    setPositions(pos);
    onLayoutModeChange(true);
  };

  const handleDragStart = useCallback((e: React.MouseEvent, tableId: string) => {
    if (!layoutMode) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = positions[tableId] || { posX: 0, posY: 0 };

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPositions((prev) => ({
        ...prev,
        [tableId]: {
          posX: Math.max(0, Math.round((startPos.posX + dx) / 20) * 20),
          posY: Math.max(0, Math.round((startPos.posY + dy) / 20) * 20),
        },
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [layoutMode, positions]);

  const hasChanges = tables.some((t) => {
    const p = positions[t.id];
    return p && (p.posX !== t.posX || p.posY !== t.posY);
  });

  const handleSaveLayout = async () => {
    const payload = tables.map((t) => ({
      id: t.id,
      posX: positions[t.id]?.posX ?? t.posX,
      posY: positions[t.id]?.posY ?? t.posY,
    }));
    try {
      await updateLayout.mutateAsync(payload);
      toast.success('Đã lưu bố cục bàn thành công');
      onLayoutModeChange(false);
      onRefresh();
    } catch {
      toast.error('Lưu bố cục thất bại');
    }
  };

  const handleCancelLayout = () => {
    onLayoutModeChange(false);
    setPositions({});
  };

  const canEditLayout = hasPermission('TABLE_LAYOUT_EDIT');
  const canCreate = hasPermission('TABLE_CREATE');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {layoutMode ? 'Edit Layout' : 'Table Floor'}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tables.length} tables</span>
          {!layoutMode && canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Add Table
            </Button>
          )}
          {!layoutMode && canEditLayout && (
            <Button size="sm" variant="outline" onClick={handleToggleLayout}>
              <Move className="w-4 h-4" />
              Edit Layout
            </Button>
          )}
          {layoutMode && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelLayout}
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLayout}
                disabled={!hasChanges || updateLayout.isPending}
              >
                <Save className="w-4 h-4" />
                {updateLayout.isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex-1 relative overflow-auto rounded-xl border',
          layoutMode ? 'bg-muted/50 border-dashed border-muted-foreground/40' : 'bg-muted/20 border-border',
        )}
        style={{ minHeight: 500 }}
      >
        {sortedTables.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No tables yet. Click "Add Table" to create one.
          </div>
        ) : (
          sortedTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              selected={selectedId === table.id}
              onSelect={onSelect}
              draggable={layoutMode}
              onDragStart={handleDragStart}
              position={positions[table.id]}
            />
          ))
        )}
      </div>

      {layoutMode && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Drag tables to reposition. Changes are saved to the server.
        </div>
      )}

      <CreateTableModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={onRefresh}
      />
    </div>
  );
}
