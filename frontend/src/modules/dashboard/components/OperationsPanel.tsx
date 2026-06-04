import { Link } from 'react-router';
import { SectionHeader, SkeletonCard } from './shared';
import { TableOccupancyMap } from './TableOccupancyMap';
import { OrderStatusFeed } from './OrderStatusFeed';
import type { OperationsData } from '../types';

export function OperationsPanel({ data, loading }: { data: OperationsData | null; loading?: boolean }) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-32 mb-6" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-10 h-10 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-32 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <SectionHeader title="Vận hành sảnh" actionLabel="Quản lý bàn" actionHref="/app/tables" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableOccupancyMap
          tables={data.tablesList}
          total={data.tables.total}
          occupied={data.tables.occupied}
          available={data.tables.available}
        />
        <OrderStatusFeed
          orderStatus={data.orderStatus}
          avgPrepTime={data.avgPrepTime}
          overdueOrders={data.overdueOrders}
        />
      </div>
    </div>
  );
}
