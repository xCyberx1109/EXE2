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

const TABLE_WIDTH = 180;
const TABLE_HEIGHT = 120;

function rectsOverlap(a: { posX: number; posY: number }, b: { posX: number; posY: number }) {
  const aRight = a.posX + TABLE_WIDTH;
  const aBottom = a.posY + TABLE_HEIGHT;
  const bRight = b.posX + TABLE_WIDTH;
  const bBottom = b.posY + TABLE_HEIGHT;
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

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

  const findOverlappingIds = useCallback((currentPositions: Record<string, { posX: number; posY: number }>) => {
    const overlapping = new Set<string>();
    const entries = Object.entries(currentPositions);
    for (let i = 0; i < entries.length; i++) {
      const [idA, posA] = entries[i];
      for (let j = i + 1; j < entries.length; j++) {
        const [idB, posB] = entries[j];
        if (rectsOverlap(posA, posB)) {
          overlapping.add(idA);
          overlapping.add(idB);
        }
      }
    }
    return overlapping;
  }, []);

  const overlappingIds = useMemo(() => findOverlappingIds(positions), [positions, findOverlappingIds]);

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

  const hasOverlap = overlappingIds.size > 0;

  const handleSaveLayout = async () => {
    if (hasOverlap) {
      toast.error('Không thể lưu: một số bàn bị chồng lên nhau.');
      return;
    }
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

  const canEditLayout = hasPermission('BILLIARD_TABLE_LAYOUT_EDIT');
  const canCreate = hasPermission('BILLIARD_TABLE_CREATE');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {layoutMode ? 'Chỉnh sửa bố cục' : 'Sơ đồ bàn'}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tables.length} bàn</span>
          {!layoutMode && canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Thêm bàn
            </Button>
          )}
          {!layoutMode && canEditLayout && (
            <Button size="sm" variant="outline" onClick={handleToggleLayout}>
              <Move className="w-4 h-4" />
              Chỉnh sửa bố cục
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
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLayout}
                disabled={!hasChanges || hasOverlap || updateLayout.isPending}
              >
                <Save className="w-4 h-4" />
                {updateLayout.isPending ? 'Đang lưu...' : 'Lưu'}
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
        style={{ minHeight: 500, minWidth: 800 }}
      >
        {sortedTables.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Chưa có bàn nào. Nhấn "Thêm bàn" để tạo.
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
              overlap={overlappingIds.has(table.id)}
            />
          ))
        )}
      </div>

      {layoutMode && (
        <div className="mt-2 text-xs text-center">
          {hasOverlap ? (
            <span className="text-red-500">Một số bàn bị chồng lên nhau. Vui lòng sửa trước khi lưu.</span>
          ) : (
            <span className="text-muted-foreground">Kéo bàn để thay đổi vị trí. Thay đổi sẽ được lưu lên máy chủ.</span>
          )}
        </div>
      )}

      <CreateTableModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={onRefresh}
        tables={tables}
      />
    </div>
  );
}