import { useState } from 'react';
import { Play, CalendarClock, Loader2, Ban } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { usePlayNow, useReserve, useDisableTable } from '../hooks';
import type { BilliardTableWithSession } from '../types';

const DURATIONS = [30, 60, 90, 120];

interface AvailablePanelProps {
  table: BilliardTableWithSession;
  onSuccess: () => void;
}

export function AvailablePanel({ table, onSuccess }: AvailablePanelProps) {
  const [mode, setMode] = useState<'none' | 'play' | 'reserve'>('none');
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

  const handlePlay = async () => {
    const mins = duration === 0 ? parseInt(customDuration, 10) : duration;
    if (!mins || mins < 1) return;
    await playNow.mutateAsync({
      tableId: table.id,
      body: { durationMinutes: mins, customerName: customerName.trim() || undefined },
    });
    setMode('none');
    setCustomerName('');
    onSuccess();
  };

  const handleReserve = async () => {
    if (!custName.trim() || !reserveTime) return;
    const mins = reserveDuration === 0 ? parseInt(reserveCustomDuration, 10) : reserveDuration;
    if (!mins || mins < 1) return;
    await reserve.mutateAsync({
      tableId: table.id,
      body: {
        customerName: custName.trim(),
        phone: phone.trim() || undefined,
        reservationTime: new Date(reserveTime).toISOString(),
        durationMinutes: mins,
        note: note.trim() || undefined,
      },
    });
    setMode('none');
    setCustName('');
    setPhone('');
    setReserveTime('');
    setReserveDuration(60);
    setReserveCustomDuration('');
    setNote('');
    onSuccess();
  };

  if (mode === 'none') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-green-600 dark:text-green-400">Available</span> — Start a session or reserve this table.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button className="w-full" onClick={() => setMode('play')}>
            <Play className="w-4 h-4" />
            Play Now
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setMode('reserve')}>
            <CalendarClock className="w-4 h-4" />
            Reserve
          </Button>
        </div>
        <div className="pt-2 border-t border-border">
          <Button
            variant="destructive"
            className="w-full"
            onClick={async () => {
              await disableTable.mutateAsync(table.id);
              onSuccess();
            }}
            disabled={disableTable.isPending}
          >
            {disableTable.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Disable
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'play') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Play Now</h3>
          <Button variant="ghost" size="sm" onClick={() => setMode('none')}>Back</Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor="playName">Customer Name</Label>
          <Input
            id="playName"
            placeholder="Enter player name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs text-gray-500">Duration</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DURATIONS.map((d) => (
              <Button
                key={d}
                variant={duration === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setDuration(d); setCustomDuration(''); }}
              >
                {d} min
              </Button>
            ))}
            <Button
              variant={duration === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDuration(0)}
            >
              Custom
            </Button>
          </div>
        </div>

        {duration === 0 && (
          <div className="space-y-1">
            <Label htmlFor="customDur">Custom minutes</Label>
            <Input
              id="customDur"
              type="number"
              min={1}
              placeholder="Enter minutes"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
            />
          </div>
        )}

        <Button
          className="w-full"
          onClick={handlePlay}
          disabled={playNow.isPending || (duration === 0 && (!customDuration || parseInt(customDuration) < 1))}
        >
          {playNow.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Start Session
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Reserve Table</h3>
        <Button variant="ghost" size="sm" onClick={() => setMode('none')}>Back</Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="custName">Customer Name *</Label>
          <Input id="custName" value={custName} onChange={(e) => setCustName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="reserveTime">Reservation Time *</Label>
          <Input id="reserveTime" type="datetime-local" value={reserveTime} onChange={(e) => setReserveTime(e.target.value)} />
        </div>

        <div>
          <Label className="text-xs text-gray-500">Duration</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DURATIONS.map((d) => (
              <Button
                key={d}
                variant={reserveDuration === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setReserveDuration(d); setReserveCustomDuration(''); }}
              >
                {d} min
              </Button>
            ))}
            <Button
              variant={reserveDuration === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReserveDuration(0)}
            >
              Custom
            </Button>
          </div>
        </div>

        {reserveDuration === 0 && (
          <div className="space-y-1">
            <Label htmlFor="reserveCustomDur">Custom minutes</Label>
            <Input
              id="reserveCustomDur"
              type="number"
              min={1}
              placeholder="Enter minutes"
              value={reserveCustomDuration}
              onChange={(e) => setReserveCustomDuration(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="note">Note</Label>
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleReserve}
        disabled={reserve.isPending || !custName.trim() || !reserveTime || (reserveDuration === 0 && (!reserveCustomDuration || parseInt(reserveCustomDuration) < 1))}
      >
        {reserve.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Confirm Reservation
      </Button>
    </div>
  );
}
