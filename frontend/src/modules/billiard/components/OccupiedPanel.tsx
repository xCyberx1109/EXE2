import { useState, useEffect } from 'react';
import {
  Clock,
  Timer,
  LogOut,
  Plus,
  Loader2,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useExtendSession, useFinishSession, useTableOrderSummary } from '../hooks';
import { OrderFoodDrinkDrawer } from './OrderFoodDrinkDrawer';
import { printReceipt } from '@/shared/utils/printReceipt';
import { cn } from '@/app/components/ui/utils';
import type { BilliardTableWithSession } from '../types';

function useCountdownTimer(endTime: string | null): { display: string; expired: boolean } {
  const [display, setDisplay] = useState('00:00:00');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endTime) {
      setDisplay('00:00:00');
      setExpired(false);
      return;
    }

    function tick() {
      const remainingMs = new Date(endTime).getTime() - Date.now();
      if (remainingMs <= 0) {
        setDisplay('00:00:00');
        setExpired(true);
        return;
      }
      setExpired(false);
      const totalSec = Math.floor(remainingMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setDisplay(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return { display, expired };
}

const fmt = (n: number) => n.toLocaleString() + ' ₫';

interface OccupiedPanelProps {
  table: BilliardTableWithSession;
  onSuccess: () => void;
  onRefresh?: () => void;
}

export function OccupiedPanel({ table, onSuccess, onRefresh }: OccupiedPanelProps) {
  const session = table.currentSession;
  const [showExtend, setShowExtend] = useState(false);
  const [extendMins, setExtendMins] = useState(30);
  const [customExtend, setCustomExtend] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const extendSession = useExtendSession();
  const finishSession = useFinishSession();

  const { data: orderSummary, isLoading: summaryLoading } = useTableOrderSummary(table.id);

  const orderId = orderSummary?.orderId || null;
  const orderItems = orderSummary?.items || [];
  const foodTotal = orderSummary?.foodTotal || 0;
  const serviceCharge = orderSummary?.serviceCharge || 0;
  const tax = orderSummary?.tax || 0;
  const hasItems = orderItems.length > 0;

  const playingCost = orderSummary?.playingCost ?? session?.tableFee ?? 0;
  const hourlyRate = orderSummary?.hourlyRate ?? table.hourlyRate ?? 0;
  const bookedDuration = session?.durationMinutes ?? 0;

  const { display: remainingDisplay, expired: timeExpired } = useCountdownTimer(
    session?.expectedEndTime ?? null
  );

  const grandTotal = playingCost + foodTotal + serviceCharge + tax;

  const handleExtend = async () => {
    if (!session) return;
    const mins = extendMins === 0 ? parseInt(customExtend, 10) : extendMins;
    if (!mins || mins < 1) return;
    await extendSession.mutateAsync({ sessionId: session.id, additionalMinutes: mins });
    setShowExtend(false);
    onSuccess();
  };

  const handleFinish = async () => {
    await finishSession.mutateAsync(table.id);

    const now = new Date();
    const sessStart = session ? new Date(session.startTime) : now;

    printReceipt({
      invoiceNumber: orderSummary?.orderNumber || table.id,
      checkoutDate: now.toISOString(),
      tableCode: table.tableCode,
      tableType: table.tableType,
      sessionStart: sessStart.toISOString(),
      sessionEnd: now.toISOString(),
      durationMinutes: bookedDuration,
      hourlyRate,
      tableFee: playingCost,
      items: orderItems.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        total: i.lineTotal,
      })),
      foodTotal,
      serviceCharge,
      tax,
      grandTotal,
    });

    onSuccess();
  };

  if (!session) {
    return (
      <div className="space-y-4">
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">
          Occupied
        </span>
        <p className="text-sm text-muted-foreground">No active session data.</p>
      </div>
    );
  }

  const sessStartTime = new Date(session.startTime);

  return (
    <>
      <div className="space-y-4">
        {/* Status & Countdown */}
        <div className="flex items-center justify-between">
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">
            Occupied
          </span>
          <div className={cn('flex items-center gap-1 text-xs font-medium', timeExpired ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
            {timeExpired ? <AlertCircle className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
            {remainingDisplay}
          </div>
        </div>

        {timeExpired && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-2 text-xs text-red-700 dark:text-red-400 text-center font-medium">
            Session Time Expired
          </div>
        )}

        {/* Billiard Playing Info */}
        <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span className="font-medium">{sessStartTime.toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Booked Duration</span>
            <span className="font-medium">{bookedDuration} minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hourly Rate</span>
            <span className="font-medium tabular-nums">{fmt(hourlyRate)}<span className="text-xs text-muted-foreground">/hour</span></span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground font-medium">Playing Cost</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{fmt(playingCost)}</span>
          </div>
        </div>

        {/* ORDER DETAILS SECTION */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order Details
            </span>
            {summaryLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
          </div>
          <div className="p-3">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : !hasItems ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No food/drink ordered yet
              </p>
            ) : (
              <div className="space-y-1.5">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-foreground">
                      <span className="text-muted-foreground mr-1">{item.quantity}x</span>
                      {item.name}
                    </span>
                    <span className="font-medium tabular-nums">
                      {item.lineTotal.toLocaleString()}₫
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TOTALS */}
        <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Playing Time</span>
            <span className="font-medium tabular-nums">{fmt(playingCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Food & Drink</span>
            <span className="font-medium tabular-nums">{fmt(foodTotal)}</span>
          </div>
          {serviceCharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Charge</span>
              <span className="font-medium tabular-nums">{fmt(serviceCharge)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium tabular-nums">{fmt(tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-border pt-2">
            <span>Grand Total</span>
            <span className="text-primary tabular-nums">{fmt(grandTotal)}</span>
          </div>
        </div>

        {!showExtend ? (
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => setDrawerOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Food / Drink
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setShowExtend(true)}>
              <Clock className="w-4 h-4" />
              Extend Session
            </Button>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              onClick={handleFinish}
              disabled={finishSession.isPending}
            >
              {finishSession.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              Checkout &mdash; {fmt(grandTotal)}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Extend Session</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowExtend(false)}>Back</Button>
            </div>

            <div className="flex gap-2">
              {[15, 30, 60].map((m) => (
                <Button
                  key={m}
                  variant={extendMins === m ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setExtendMins(m); setCustomExtend(''); }}
                >
                  +{m}m
                </Button>
              ))}
              <Button
                variant={extendMins === 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setExtendMins(0)}
              >
                Custom
              </Button>
            </div>

            {extendMins === 0 && (
              <div className="space-y-1">
                <Label htmlFor="extendCustom">Additional minutes</Label>
                <Input
                  id="extendCustom"
                  type="number"
                  min={1}
                  placeholder="Enter minutes"
                  value={customExtend}
                  onChange={(e) => setCustomExtend(e.target.value)}
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleExtend}
              disabled={extendSession.isPending || (extendMins === 0 && (!customExtend || parseInt(customExtend) < 1))}
            >
              {extendSession.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Extension
            </Button>
          </div>
        )}
      </div>

      <OrderFoodDrinkDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tableId={table.id}
        tableCode={table.tableCode}
        currentOrderId={orderId}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </>
  );
}
