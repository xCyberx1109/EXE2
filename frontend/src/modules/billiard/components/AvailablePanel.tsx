import { useState, useEffect, useRef } from 'react';
import { Play, CalendarClock, Loader2, Ban, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { usePlayNow, useReserve, useDisableTable, useOpenOrder } from '../hooks';
import type { BilliardTableWithSession } from '../types';
import { useAsyncActionGuard } from '@/shared/hooks/useAsyncActionGuard';

interface AvailablePanelProps {
  mode: 'BILLIARD' | 'RESTAURANT';
  table: BilliardTableWithSession;
  onSuccess: () => void;
}

export function AvailablePanel({ mode, table, onSuccess }: AvailablePanelProps) {
  if (mode === 'RESTAURANT') {
    return <RestaurantAvailablePanel table={table} onSuccess={onSuccess} />;
  }
  const [actionMode, setActionMode] = useState<'none' | 'reserve'>('none');

  const [custName, setCustName] = useState('');
  const [phone, setPhone] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [note, setNote] = useState('');

  const playNow = usePlayNow();
  const reserve = useReserve();
  const disableTable = useDisableTable();

  const handlePlay = useAsyncActionGuard(async () => {
    await playNow.mutateAsync({ tableId: table.id, durationMinutes: 60 });
    onSuccess();
  }, { delay: 500 });

  const handleReserve = useAsyncActionGuard(async () => {
    if (!custName.trim() || !reservationDate) return;
    await reserve.mutateAsync({
      tableId: table.id,
      customerName: custName.trim(),
      phone: phone.trim() || undefined,
      reservationDate,
      note: note.trim() || undefined,
    });
    setActionMode('none');
    setCustName('');
    setPhone('');
    setReservationDate('');
    setNote('');
    onSuccess();
  }, { delay: 500 });

  const disableTableAction = useAsyncActionGuard(async () => {
    await disableTable.mutateAsync(table.id);
    onSuccess();
  }, { delay: 500 });

  if (actionMode === 'none') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-green-600 dark:text-green-400">Trống</span> — Bắt đầu chơi hoặc đặt trước bàn này.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button className="w-full" onClick={handlePlay.run} disabled={handlePlay.isBusy || playNow.isPending}>
            {(handlePlay.isBusy || playNow.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Bắt đầu chơi
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setActionMode('reserve')}>
            <CalendarClock className="w-4 h-4" />
            Đặt trước
          </Button>
        </div>
        <div className="pt-2 border-t border-border">
          <Button
            variant="destructive"
            className="w-full"
            onClick={disableTableAction.run}
            disabled={disableTableAction.isBusy || disableTable.isPending}
          >
            {(disableTableAction.isBusy || disableTable.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Khóa bàn
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Đặt trước bàn</h3>
        <Button variant="ghost" size="sm" onClick={() => setActionMode('none')}>Quay lại</Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="custName">Tên khách hàng *</Label>
          <Input id="custName" value={custName} onChange={(e) => setCustName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="reservationDate">Ngày đặt *</Label>
          <Input id="reservationDate" type="date" value={reservationDate} onChange={(e) => setReservationDate(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="note">Ghi chú</Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleReserve.run}
        disabled={handleReserve.isBusy || reserve.isPending || !custName.trim() || !reservationDate}
      >
        {(handleReserve.isBusy || reserve.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
        Xác nhận đặt trước
      </Button>
    </div>
  );
}

function RestaurantAvailablePanel({ table, onSuccess }: { table: BilliardTableWithSession; onSuccess: () => void }) {
  const openOrder = useOpenOrder();
  const [hasError, setHasError] = useState(false);
  const calledRef = useRef(false);

  const handleOpen = useAsyncActionGuard(async () => {
    setHasError(false);
    try {
      await openOrder.mutateAsync({ tableId: table.id, guestCount: 1 });
      onSuccess();
    } catch {
      setHasError(true);
    }
  }, { delay: 0 });

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    handleOpen.run();
  }, []);

  if (hasError) {
    return (
      <div className="text-center space-y-3 py-8">
        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto" />
        <p className="text-sm text-red-600">Không thể mở bàn. Vui lòng thử lại.</p>
        <Button variant="outline" size="sm" onClick={handleOpen.run} disabled={handleOpen.isBusy}>
          {handleOpen.isBusy && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Thử lại
        </Button>
      </div>
    );
  }

  const isLoading = handleOpen.isBusy || openOrder.isPending;

  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center space-y-3">
        {isLoading && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />}
        <p className="text-sm text-muted-foreground">Đang mở bàn...</p>
      </div>
    </div>
  );
}
