import { useEffect, useState, useCallback } from 'react';
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
  const [positions, setPositions] = useState<Record<string, { posX: number; posY: number }>>({});
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const fetchTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await billiardApi.listTables();
      setTables(data);
      const pos: Record<string, { posX: number; posY: number }> = {};
      data.forEach((t) => { pos[t.id] = { posX: t.posX, posY: t.posY }; });
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
    if (!hasPermission('TABLE_LAYOUT_EDIT')) return;
    e.preventDefault();
    setDraggingId(tableId);
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
      setDraggingId(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [hasPermission, positions]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = tables.map((t) => ({
        id: t.id,
        posX: positions[t.id]?.posX ?? t.posX,
        posY: positions[t.id]?.posY ?? t.posY,
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
    return p && (p.posX !== t.posX || p.posY !== t.posY);
  });

  const minX = Math.min(...tables.map((t) => (positions[t.id]?.posX ?? t.posX) - 40));
  const minY = Math.min(...tables.map((t) => (positions[t.id]?.posY ?? t.posY) - 40));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Grid3X3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sơ đồ bàn bi-a</h1>
              <p className="text-sm text-gray-500 mt-1">Kéo thả để sắp xếp vị trí bàn.</p>
            </div>
          </div>
          {hasPermission('TABLE_LAYOUT_EDIT') && hasChanges && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu sơ đồ'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải sơ đồ...</div>
        ) : tables.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Chưa có bàn nào.</div>
        ) : (
          <div className="relative w-full overflow-auto" style={{ minHeight: 500 }}>
            <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
              {tables.map((table) => {
                const p = positions[table.id] || { posX: table.posX, posY: table.posY };
                return (
                  <line
                    key={`line-${table.id}`}
                    x1={p.posX + 40}
                    y1={p.posY + 40}
                    x2={p.posX + 40}
                    y2={p.posY + 40}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
            {tables.map((table) => {
              const p = positions[table.id] || { posX: table.posX, posY: table.posY };
              const isDragging = draggingId === table.id;
              return (
                <div
                  key={table.id}
                  onMouseDown={(e) => handleMouseDown(e, table.id)}
                  style={{
                    left: p.posX,
                    top: p.posY,
                    width: 80,
                    height: 80,
                    cursor: hasPermission('TABLE_LAYOUT_EDIT') ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  }}
                  className={`absolute rounded-xl border-2 flex flex-col items-center justify-center shadow-sm select-none transition-shadow ${
                    STATUS_COLORS[table.status] || 'border-gray-300 bg-gray-50'
                  } ${isDragging ? 'shadow-lg z-10' : 'z-0'}`}
                >
                  <span className="text-xs font-bold leading-tight">{table.tableCode}</span>
                  <span className="text-[10px] mt-0.5 opacity-75">{table.tableName || ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
