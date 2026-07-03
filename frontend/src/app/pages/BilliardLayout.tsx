import { useEffect, useState, useCallback, useRef } from 'react';
import { Grid3X3, Save } from 'lucide-react';
import { billiardApi, type BilliardTableWithSession } from '../api/services';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'border-green-400 bg-green-50 text-green-800',
  OCCUPIED: 'border-orange-400 bg-orange-50 text-orange-800',
  RESERVED: 'border-yellow-400 bg-yellow-50 text-yellow-800',
  CLEANING: 'border-gray-300 bg-gray-50 text-gray-500',
  CHECKING_OUT: 'border-blue-400 bg-blue-50 text-blue-800',
  DISABLED: 'border-gray-300 bg-gray-100 text-gray-400',
};

export function BilliardLayout() {
  const { hasPermission } = useAuth();
  const [tables, setTables] = useState<BilliardTableWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { xPercent: number; yPercent: number }>>({});
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
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

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await billiardApi.listTables();
      const tableList = Array.isArray(data) ? data : [];
      setTables(tableList);
      const pos: Record<string, { xPercent: number; yPercent: number }> = {};
      tableList.forEach((t) => {
        pos[t.id] = { xPercent: t.xPercent ?? t.posX, yPercent: t.yPercent ?? t.posY };
      });
      setPositions(pos);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải sơ đồ bàn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    if (!hasPermission('BILLIARD_TABLE_LAYOUT_EDIT')) return;
    e.preventDefault();
    setDraggingId(tableId);
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
      setDraggingId(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [hasPermission, positions, containerSize]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = tables.map((t) => ({
        id: t.id,
        posX: positions[t.id]?.xPercent ?? t.xPercent ?? t.posX,
        posY: positions[t.id]?.yPercent ?? t.yPercent ?? t.posY,
      }));
      await billiardApi.updateLayout(payload);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu sơ đồ');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = tables.some((t) => {
    const p = positions[t.id];
    const origPercent = t.xPercent ?? t.posX;
    return p && (Math.abs(p.xPercent - origPercent) > 0.01 || Math.abs(p.yPercent - (t.yPercent ?? t.posY)) > 0.01);
  });

  return (
    <div className="space-y-2">
      <div className="bg-white dark:bg-card rounded-md border border-border p-3 sm:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center shrink-0">
              <Grid3X3 className="size-4 sm:size-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">Sơ đồ bàn bi-a</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Kéo thả để sắp xếp vị trí bàn.</p>
            </div>
          </div>
          {hasPermission('BILLIARD_TABLE_LAYOUT_EDIT') && hasChanges && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 py-1.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 text-xs"
            >
              <Save className="size-3.5" />
              {saving ? 'Đang lưu...' : 'Lưu sơ đồ'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs text-red-600">{error}</div>
      )}

      <div className="bg-white dark:bg-card rounded-md border border-border p-3 sm:p-4">
        {loading ? (
          <div className="p-3 text-center text-muted-foreground">Đang tải sơ đồ...</div>
        ) : tables.length === 0 ? (
          <div className="p-3 text-center text-muted-foreground">Chưa có bàn nào.</div>
        ) : (
          <div ref={containerRef} className="relative w-full overflow-hidden" style={{ minHeight: '40vh' }}>
            {tables.map((table) => {
              const p = positions[table.id] || { xPercent: table.xPercent ?? table.posX, yPercent: table.yPercent ?? table.posY };
              const isDragging = draggingId === table.id;
              return (
                <div
                  key={table.id}
                  onMouseDown={(e) => handleMouseDown(e, table.id)}
                  style={{
                    left: `${p.xPercent}%`,
                    top: `${p.yPercent}%`,
                    width: 'clamp(60px, 5vw, 80px)',
                    height: 'clamp(60px, 5vw, 80px)',
                    cursor: hasPermission('BILLIARD_TABLE_LAYOUT_EDIT') ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  }}
                  className={`absolute rounded-md border-2 flex flex-col items-center justify-center shadow-sm select-none transition-shadow text-[clamp(9px,0.7vw,12px)] ${
                    STATUS_COLORS[table.status] || 'border-gray-300 bg-gray-50'
                  } ${isDragging ? 'shadow-lg z-10' : 'z-0'}`}
                >
                  <span className="font-bold leading-tight">{table.tableCode}</span>
                  <span className="mt-0.5 opacity-75 truncate max-w-full px-1">{table.tableName || ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
