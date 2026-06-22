import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import { Card } from '../../app/components/ui/card';
import { apiFetch } from '../../app/api/client';
import { CircleDot, Clock, Play } from 'lucide-react';

interface BilliardTableItem {
  id: string;
  tableCode: string;
  tableName: string;
  status: string;
  currentSession?: {
    id: string;
    startTime: string;
    elapsedMinutes: number;
    totalCost: number;
  };
}

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('fnb_pos_machine_token')}`,
  'Content-Type': 'application/json',
});

export function PosBilliardPage() {
  const { hasPermission } = useAuth();
  const [tables, setTables] = useState<BilliardTableItem[]>([]);

  const fetchTables = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/billiard/tables', { auth: false, headers: authHeaders() } as any);
      setTables(Array.isArray(res) ? res : res?.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchTables(); const id = setInterval(fetchTables, 10000); return () => clearInterval(id); }, [fetchTables]);

  if (!hasPermission('BILLIARD_TABLE_VIEW')) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Bạn không có quyền xem bàn bi-a</div>;
  }

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center gap-2">
        <CircleDot className="w-6 h-6 text-muted-foreground" />
        <h2 className="text-xl font-bold text-foreground">Bi-a</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tables.map((table) => (
          <Card key={table.id} className={`p-4 border-l-4 ${table.status === 'AVAILABLE' ? 'border-l-green-400' : 'border-l-red-400'}`}>
            <div className="text-center">
              <CircleDot className={`w-8 h-8 mx-auto mb-2 ${table.status === 'AVAILABLE' ? 'text-green-500' : 'text-red-500'}`} />
              <div className="text-lg font-bold">{table.tableName || `Bàn ${table.tableCode}`}</div>
              <div className="text-sm text-muted-foreground">Bàn {table.tableCode}</div>
              <div className={`text-xs mt-1 font-medium ${table.status === 'AVAILABLE' ? 'text-green-600' : 'text-red-600'}`}>
                {table.status === 'AVAILABLE' ? 'Trống' : 'Đang chơi'}
              </div>
              {table.currentSession && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {Math.floor(table.currentSession.elapsedMinutes / 60)}h{table.currentSession.elapsedMinutes % 60}m
                </div>
              )}
            </div>
          </Card>
        ))}
        {tables.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <CircleDot className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Không có bàn bi-a nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
