import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Move, Save, X } from 'lucide-react';
import { TableCard } from './TableCard';
import { CreateTableModal } from './CreateTableModal';
import { useUpdateLayout } from '../hooks';
import type { BilliardTableWithSession, SortPriority } from '../types';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/app/context/AuthContext';

const TABLE_DRAG_WIDTH = 160;
const TABLE_DRAG_HEIGHT = 110;

function rectsOverlap(a: { posX: number; posY: number }, b: { posX: number; posY: number }) {
  const aRight = a.posX + TABLE_DRAG_WIDTH;
  const aBottom = a.posY + TABLE_DRAG_HEIGHT;
  const bRight = b.posX + TABLE_DRAG_WIDTH;
  const bBottom = b.posY + TABLE_DRAG_HEIGHT;
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

function getSortPriority(table: BilliardTableWithSession): SortPriority {
  if (table.status === 'OCCUPIED') {
    const endTime = table.currentSession?.expectedEndTime || (table as any).currentOrder?.startTime;
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
  mode: 'BILLIARD' | 'RESTAURANT';
  tables: BilliardTableWithSession[];
  selectedId: string | null;
  onSelect: (table: BilliardTableWithSession) => void;
  onRefresh: () => void;
  layoutMode: boolean;
  onLayoutModeChange: (mode: boolean) => void;
  newOrderTableIds?: Set<string>;
}

export function TableFloor({ mode, tables: rawTables, selectedId, onSelect, onRefresh, layoutMode, onLayoutModeChange, newOrderTableIds }: TableFloorProps) {
  const { hasPermission, isEmployeeMode } = useAuth();
  const tables = Array.isArray(rawTables) ? rawTables : [];
  const [showCreate, setShowCreate] = useState(false);
  const [positions, setPositions] = useState<Record<string, { xPercent: number; yPercent: number }>>({});
  const updateLayout = useUpdateLayout(mode);
  const containerRef = useRef<HTMLDivElement>(null!);
  const [containerSize, setContainerSize] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(getSortPriority(a));
      const pb = PRIORITY_ORDER.indexOf(getSortPriority(b));
      return pa - pb;
    });
  }, [tables]);

  const handleToggleLayout = () => {
    const pos: Record<string, { xPercent: number; yPercent: number }> = {};
    tables.forEach((t) => {
      pos[t.id] = { xPercent: t.xPercent ?? t.posX, yPercent: t.yPercent ?? t.posY };
    });
    setPositions(pos);
    onLayoutModeChange(true);
  };

  const pixelOverlaps = useCallback((posA: { xPercent: number; yPercent: number }, posB: { xPercent: number; yPercent: number }) => {
    const ax = (posA.xPercent / 100) * containerSize.width;
    const ay = (posA.yPercent / 100) * containerSize.height;
    const bx = (posB.xPercent / 100) * containerSize.width;
    const by = (posB.yPercent / 100) * containerSize.height;
    return rectsOverlap({ posX: ax, posY: ay }, { posX: bx, posY: by });
  }, [containerSize]);

  const findOverlappingIds = useCallback((currentPositions: Record<string, { xPercent: number; yPercent: number }>) => {
    const overlapping = new Set<string>();
    const entries = Object.entries(currentPositions);
    for (let i = 0; i < entries.length; i++) {
      const [idA, posA] = entries[i];
      for (let j = i + 1; j < entries.length; j++) {
        const [idB, posB] = entries[j];
        if (pixelOverlaps(posA, posB)) {
          overlapping.add(idA);
          overlapping.add(idB);
        }
      }
    }
    return overlapping;
  }, [pixelOverlaps]);

  const overlappingIds = useMemo(() => findOverlappingIds(positions), [positions, findOverlappingIds]);

  const handleDragStart = useCallback((e: React.MouseEvent, tableId: string) => {
    if (!layoutMode) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = positions[tableId] || { xPercent: 0, yPercent: 0 };

    const handleMouseMove = (ev: MouseEvent) => {
      const dxPx = ev.clientX - startX;
      const dyPx = ev.clientY - startY;
      const dxPercent = (dxPx / containerSize.width) * 100;
      const dyPercent = (dyPx / containerSize.height) * 100;
      const snapPercent = 0.5;
      setPositions((prev) => ({
        ...prev,
        [tableId]: {
          xPercent: Math.max(0, Math.round((startPos.xPercent + dxPercent) / snapPercent) * snapPercent),
          yPercent: Math.max(0, Math.round((startPos.yPercent + dyPercent) / snapPercent) * snapPercent),
        },
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [layoutMode, positions, containerSize]);

  const hasChanges = tables.some((t) => {
    const p = positions[t.id];
    const origPercent = t.xPercent ?? t.posX;
    return p && (Math.abs(p.xPercent - origPercent) > 0.01 || Math.abs(p.yPercent - (t.yPercent ?? t.posY)) > 0.01);
  });

  const hasOverlap = overlappingIds.size > 0;

  const handleSaveLayout = async () => {
    if (hasOverlap) {
      toast.error('Không thể lưu: một số bàn bị chồng lên nhau.');
      return;
    }
    const payload = tables.map((t) => ({
      id: t.id,
      posX: positions[t.id]?.xPercent ?? t.xPercent ?? t.posX,
      posY: positions[t.id]?.yPercent ?? t.yPercent ?? t.posY,
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

  const canEditLayout = !isEmployeeMode && hasPermission(mode === 'BILLIARD' ? 'BILLIARD_TABLE_LAYOUT_EDIT' : 'RESTAURANT_TABLE_LAYOUT_EDIT');
  const canCreate = !isEmployeeMode && hasPermission(mode === 'BILLIARD' ? 'BILLIARD_TABLE_CREATE' : 'RESTAURANT_TABLE_CREATE');

  return (
    <div className="flex flex-col h-full">
        <div className="flex flex-wrap items-center gap-1.5 mb-3 shrink-0">
        <h2 className="text-xs font-semibold text-foreground shrink-0 whitespace-nowrap">
          {layoutMode ? 'Chỉnh sửa bố cục' : 'Sơ đồ bàn'}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          <span className="text-xs text-muted-foreground">{tables.length} bàn</span>
          {!layoutMode && canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              Thêm bàn
            </Button>
          )}
          {!layoutMode && canEditLayout && (
            <Button size="sm" variant="outline" onClick={handleToggleLayout}>
              <Move className="size-3.5" />
              Chỉnh sửa bố cục
            </Button>
          )}
          {layoutMode && (
            <>
              <Button size="sm" variant="outline" onClick={handleCancelLayout}>
                <X className="size-3.5" />
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleSaveLayout}
                disabled={!hasChanges || hasOverlap || updateLayout.isPending}
              >
                <Save className="size-3.5" />
                {updateLayout.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'flex-1 relative overflow-hidden rounded-md border',
          layoutMode ? 'bg-muted/50 border-dashed border-muted-foreground/40' : 'bg-muted/20 border-border',
        )}
      >
        {sortedTables.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            Chưa có bàn nào. Nhấn "Thêm bàn" để tạo.
          </div>
        ) : (
          sortedTables.map((table) => (
            <TableCard
              mode={mode}
              key={table.id}
              table={table}
              selected={selectedId === table.id}
              onSelect={onSelect}
              draggable={layoutMode}
              onDragStart={handleDragStart}
              position={positions[table.id]}
              overlap={overlappingIds.has(table.id)}
              containerSize={containerSize}
              hasNewOrder={newOrderTableIds?.has(table.id) ?? false}
            />
          ))
        )}
      </div>

      {layoutMode && (
        <div className="mt-2 text-xs text-center shrink-0">
          {hasOverlap ? (
            <span className="text-red-500">Một số bàn bị chồng lên nhau. Vui lòng sửa trước khi lưu.</span>
          ) : (
            <span className="text-muted-foreground">Kéo bàn để thay đổi vị trí. Thay đổi sẽ được lưu lên máy chủ.</span>
          )}
        </div>
      )}

      <CreateTableModal
        mode={mode}
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={onRefresh}
        tables={tables}
      />
    </div>
  );
}
