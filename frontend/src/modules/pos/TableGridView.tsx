import { useState } from 'react';
import { useTablesPos, useCheckInTableMutation } from '../../app/api/hooks';
import { useAsyncActionGuard } from '../../shared/hooks/useAsyncActionGuard';
import type { TableItem } from '../../app/types';
import { TableOrderDialog } from './TableOrderDialog';

const STATUS_STYLES: Record<string, { bg: string; border: string; label: string; icon: string }> = {
  AVAILABLE: { bg: 'bg-green-50', border: 'border-green-300', label: 'Trống', icon: '○' },
  OCCUPIED: { bg: 'bg-red-50', border: 'border-red-300', label: 'Có khách', icon: '●' },
  RESERVED: { bg: 'bg-yellow-50', border: 'border-yellow-300', label: 'Đặt trước', icon: '◎' },
  CLEANING: { bg: 'bg-gray-100', border: 'border-gray-300', label: 'Đang dọn', icon: '〜' },
  CHECKING_OUT: { bg: 'bg-blue-50', border: 'border-blue-300', label: 'Đang TT', icon: '◉' },
  DISABLED: { bg: 'bg-gray-50', border: 'border-gray-200', label: 'Tạm ngưng', icon: '✕' },
};

interface Props {
  onTableSelect?: (table: TableItem) => void;
}

export function TableGridView({ onTableSelect }: Props) {
  const { data: tables = [], isLoading, error: queryError, refetch } = useTablesPos();
  const checkInMutation = useCheckInTableMutation();
  const [orderTable, setOrderTable] = useState<TableItem | null>(null);

  const guardCheckIn = useAsyncActionGuard(async (table: TableItem) => {
    if (window.confirm(`Check-in bàn ${table.tableCode}?`)) {
      await checkInMutation.mutateAsync(table.id);
    }
  }, { delay: 500 });

  const handleClick = (table: TableItem) => {
    if (onTableSelect) {
      onTableSelect(table);
      return;
    }

    switch (table.status) {
      case 'AVAILABLE':
      case 'OCCUPIED':
      case 'CHECKING_OUT':
        setOrderTable(table);
        break;
      case 'RESERVED':
        guardCheckIn.run(table);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        Đang tải sơ đồ bàn...
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
        <span className="text-red-400">⚠️ {queryError instanceof Error ? queryError.message : 'Không thể tải danh sách bàn'}</span>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        Chưa có bàn nào. Vui lòng thêm bàn trong phần quản lý.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {tables.map((table) => {
          const style = STATUS_STYLES[table.status] || STATUS_STYLES.DISABLED;
          const isDisabled = table.status === 'DISABLED';

          return (
            <button
              key={table.id}
              onClick={() => handleClick(table)}
              disabled={isDisabled}
              className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                ${style.bg} ${style.border}
                ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg active:scale-95 cursor-pointer'}
              `}
            >
              <span className="text-2xl font-bold text-gray-800">{table.tableCode}</span>
              {table.tableName && (
                <span className="text-xs text-gray-500 mt-0.5">{table.tableName}</span>
              )}
              <span className={`text-xs font-medium mt-2 px-2 py-0.5 rounded-full
                ${table.status === 'AVAILABLE' ? 'text-green-700 bg-green-200' : ''}
                ${table.status === 'OCCUPIED' ? 'text-red-700 bg-red-200' : ''}
                ${table.status === 'RESERVED' ? 'text-yellow-700 bg-yellow-200' : ''}
                ${table.status === 'CLEANING' ? 'text-gray-600 bg-gray-200' : ''}
                ${table.status === 'CHECKING_OUT' ? 'text-blue-700 bg-blue-200' : ''}
                ${table.status === 'DISABLED' ? 'text-gray-400 bg-gray-200' : ''}
              `}>
                {style.label}
              </span>
              {table.currentOrder && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  <div className="font-semibold">
                    {table.currentOrder.itemCount} món
                  </div>
                  {table.currentOrder.total > 0 && (
                    <div className="text-blue-600 font-medium">
                      {table.currentOrder.total.toLocaleString()}₫
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {orderTable && (
        <TableOrderDialog
          table={orderTable}
          onClose={() => setOrderTable(null)}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}
