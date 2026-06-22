import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, CalendarClock, Loader2, Ban, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { usePlayNow, useReserve, useDisableTable, useOpenOrder } from '../hooks';
import type { BilliardTableWithSession } from '../types';
import { useAsyncActionGuard } from '@/shared/hooks/useAsyncActionGuard';

const DURATIONS = [30, 60, 90, 120];

interface AvailablePanelProps {
  mode: 'BILLIARD' | 'RESTAURANT';
  table: BilliardTableWithSession;
  onSuccess: () => void;
}

export function AvailablePanel({ mode, table, onSuccess }: AvailablePanelProps) {
  if (mode === 'RESTAURANT') {
    return <RestaurantAvailablePanel table={table} onSuccess={onSuccess} />;
  }
  const [actionMode, setActionMode] = useState<'none' | 'play' | 'reserve'>('none');
  const [customerName, setCustomerName] = useState('');
  const [duration, setDuration] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState('');

  const [custName, setCustName] = useState('');
  const [phone, setPhone] = useState('');
  const [reserveTime, setReserveTime] = useState('');
  const [reserveDuration, setReserveDuration] = useState(60);
  const [reserveCustomDuration, setReserveCustomDuration] = useState('');
  const [note, setNote] = useState('');

  const playNow = usePlayNow();
  const reserve = useReserve();
  const disableTable = useDisableTable();

  const handlePlay = useAsyncActionGuard(async () => {
    const mins = duration === 0 ? parseInt(customDuration, 10) : duration;
    if (!mins || mins < 1) return;
    await playNow.mutateAsync({
      tableId: table.id,
      durationMinutes: mins,
      customerName: customerName.trim() || undefined,
    });
    setActionMode('none');
    setCustomerName('');
    onSuccess();
  }, { delay: 500 });

  const handleReserve = useAsyncActionGuard(async () => {
    if (!custName.trim() || !reserveTime) return;
    const mins = reserveDuration === 0 ? parseInt(reserveCustomDuration, 10) : reserveDuration;
    if (!mins || mins < 1) return;
    await reserve.mutateAsync({
      tableId: table.id,
      customerName: custName.trim(),
      phone: phone.trim() || undefined,
      reservationTime: new Date(reserveTime).toISOString(),
      durationMinutes: mins,
      note: note.trim() || undefined,
    });
    setActionMode('none');
    setCustName('');
    setPhone('');
    setReserveTime('');
    setReserveDuration(60);
    setReserveCustomDuration('');
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
          <span className="font-medium text-green-600 dark:text-green-400">Trống</span> — Bắt đầu phiên chơi hoặc đặt trước bàn này.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button className="w-full" onClick={() => setActionMode('play')}>
            <Play className="w-4 h-4" />
            Chơi ngay
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

  if (actionMode === 'play') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Chơi ngay</h3>
          <Button variant="ghost" size="sm" onClick={() => setActionMode('none')}>Quay lại</Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor="playName">Tên khách hàng</Label>
          <Input
            id="playName"
            placeholder="Nhập tên người chơi"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs text-gray-500">Thời gian</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DURATIONS.map((d) => (
              <Button
                key={d}
                variant={duration === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setDuration(d); setCustomDuration(''); }}
              >
                {d} ph
              </Button>
            ))}
            <Button
              variant={duration === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDuration(0)}
            >
              Tùy chỉnh
            </Button>
          </div>
        </div>

        {duration === 0 && (
          <div className="space-y-1">
            <Label htmlFor="customDur">Phút tùy chỉnh</Label>
            <Input
              id="customDur"
              type="number"
              min={1}
              placeholder="Nhập số phút"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
            />
          </div>
        )}

        <Button
          className="w-full"
          onClick={handlePlay.run}
          disabled={handlePlay.isBusy || playNow.isPending || (duration === 0 && (!customDuration || parseInt(customDuration) < 1))}
        >
          {(handlePlay.isBusy || playNow.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
          Bắt đầu phiên
        </Button>
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
          <Label htmlFor="phone">Điện thoại</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="reserveTime">Thời gian đặt *</Label>
          <Input id="reserveTime" type="datetime-local" value={reserveTime} onChange={(e) => setReserveTime(e.target.value)} />
        </div>

        <div>
          <Label className="text-xs text-gray-500">Thời gian</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DURATIONS.map((d) => (
              <Button
                key={d}
                variant={reserveDuration === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setReserveDuration(d); setReserveCustomDuration(''); }}
              >
                {d} ph
              </Button>
            ))}
            <Button
              variant={reserveDuration === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReserveDuration(0)}
            >
              Tùy chỉnh
            </Button>
          </div>
        </div>

        {reserveDuration === 0 && (
          <div className="space-y-1">
            <Label htmlFor="reserveCustomDur">Phút tùy chỉnh</Label>
            <Input
              id="reserveCustomDur"
              type="number"
              min={1}
              placeholder="Nhập số phút"
              value={reserveCustomDuration}
              onChange={(e) => setReserveCustomDuration(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="note">Ghi chú</Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleReserve.run}
        disabled={handleReserve.isBusy || reserve.isPending || !custName.trim() || !reserveTime || (reserveDuration === 0 && (!reserveCustomDuration || parseInt(reserveCustomDuration) < 1))}
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
