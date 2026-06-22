import { useState, useEffect, useCallback } from 'react';
import { Card } from '../../app/components/ui/card';
import { useAuth } from '../../app/context/AuthContext';
import type { TableItem } from '../../app/types';
import { tableApi } from '../../app/api/services';

export function PosTablesPage() {
  const { hasPermission } = useAuth();
  const [tables, setTables] = useState<TableItem[]>([]);

  const fetchTables = useCallback(async () => {
    try { setTables(await tableApi.listPos()); } catch {}
  }, []);

  useEffect(() => { fetchTables(); const id = setInterval(fetchTables, 10000); return () => clearInterval(id); }, [fetchTables]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 border-green-300';
      case 'OCCUPIED': return 'bg-red-100 text-red-800 border-red-300';
      case 'RESERVED': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'CHECKING_OUT': return 'bg-accent text-primary border-primary/30';
      default: return 'bg-muted text-gray-800 border-input';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'Trống';
      case 'OCCUPIED': return 'Có khách';
      case 'RESERVED': return 'Đã đặt';
      case 'CHECKING_OUT': return 'Đang TT';
      default: return status;
    }
  };

  return (
    <div className="h-full space-y-4">
      <h2 className="text-xl font-bold text-foreground">Quản lý bàn</h2>
      <Card className="p-4">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {tables.map((table) => (
            <div key={table.id}
              className={`p-4 rounded-lg border-2 text-center ${getStatusStyle(table.status)}`}>
              <div className="text-lg font-bold">Bàn {table.tableCode}</div>
              <div className="text-xs mt-1">{getStatusText(table.status)}</div>
              {table.currentOrder && (
                <div className="text-xs font-semibold mt-2">
                  {table.currentOrder.total.toLocaleString()} ₫
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
