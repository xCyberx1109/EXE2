import { TableIcon } from 'lucide-react';
import { EmptyState } from './shared';

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 border-green-300 text-green-700',
  OCCUPIED: 'bg-red-100 border-red-300 text-red-700',
  RESERVED: 'bg-yellow-100 border-yellow-300 text-yellow-700',
  CLEANING: 'bg-blue-100 border-blue-300 text-blue-700',
  CHECKING_OUT: 'bg-purple-100 border-purple-300 text-purple-700',
  DISABLED: 'bg-gray-100 border-gray-300 text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Trống',
  OCCUPIED: 'Có khách',
  RESERVED: 'Đặt trước',
  CLEANING: 'Đang dọn',
  CHECKING_OUT: 'Thanh toán',
  DISABLED: 'Đóng',
};

export function TableOccupancyMap({
  tables, total, occupied, available,
}: {
  tables: { id: string; tableCode: string; status: string }[];
  total: number; occupied: number; available: number;
}) {
  const safeTables = Array.isArray(tables) ? tables : [];

  if (safeTables.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Sơ đồ bàn</h3>
        <EmptyState message="Chưa có dữ liệu bàn" icon={TableIcon} />
      </div>
    );
  }

  const occPct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Sơ đồ bàn ({total})</h3>
        <span className="text-xs text-gray-500">{occupied}/{total} • {occPct}%</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {safeTables.slice(0, 16).map((table) => (
          <div
            key={table.id}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xs font-bold cursor-default transition-colors ${STATUS_COLORS[table.status] || STATUS_COLORS.AVAILABLE}`}
            title={`${table.tableCode}: ${STATUS_LABELS[table.status] || table.status}`}
          >
            {table.tableCode}
          </div>
        ))}
        {safeTables.length > 16 && (
          <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400 font-bold">
            +{safeTables.length - 16}
          </div>
        )}
      </div>
      <div className="flex gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-400" /> Trống ({available})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" /> Có khách ({occupied})</span>
      </div>
    </div>
  );
}
