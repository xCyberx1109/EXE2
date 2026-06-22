import { useState, useEffect } from 'react';
import {
  Clock, Users, ShoppingCart, Plus, LogOut,
  Loader2, ArrowRightLeft, Merge, Split,
  Printer, Ban, Timer, AlertCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';
import {
  useExtendSession, useFinishSession, useTableOrderSummary,
  useRestaurantTableOrder, usePayRestaurantOrder, useUpdateGuestCount, useUpdateOrderNote,
  useTransferTable, useMergeTables, useSplitOrder, useRestaurantTables,
} from '../hooks';
import { OrderDrawer } from './OrderDrawer';
import { printReceipt } from '@/shared/utils/printReceipt';
import { cn } from '@/app/components/ui/utils';
import { useAsyncActionGuard } from '@/shared/hooks/useAsyncActionGuard';
import { useOptimisticOrderEditor } from '@/shared/hooks/useOptimisticOrderEditor';
import { billiardApi } from '@/app/api/services';
import type { BilliardTableWithSession } from '../types';

const fmt = (n: number) => n.toLocaleString() + ' ₫';

function useTimer(endTime: string | null, isCountdown: boolean) {
  const [display, setDisplay] = useState('00:00:00');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endTime) { setDisplay('00:00:00'); setExpired(false); return; }

    function tick() {
      const diff = isCountdown
        ? new Date(endTime).getTime() - Date.now()
        : Date.now() - new Date(endTime).getTime();
      if (diff <= 0) {
        if (isCountdown) { setDisplay('00:00:00'); setExpired(true); return; }
        setDisplay('00:00:00'); setExpired(false); return;
      }
      setExpired(false);
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setDisplay(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, isCountdown]);

  return { display, expired };
}

interface OccupiedPanelProps {
  mode: 'BILLIARD' | 'RESTAURANT';
  table: BilliardTableWithSession;
  onSuccess: () => void;
  onRefresh?: () => void;
  autoOpenDrawer?: boolean;
  onAutoOpenDrawerConsumed?: () => void;
}

export function OccupiedPanel({ mode, table, onSuccess, onRefresh, autoOpenDrawer, onAutoOpenDrawerConsumed }: OccupiedPanelProps) {
  if (mode === 'RESTAURANT') {
    return <RestaurantOccupiedPanel mode={mode} table={table} onSuccess={onSuccess} onRefresh={onRefresh} autoOpenDrawer={autoOpenDrawer} onAutoOpenDrawerConsumed={onAutoOpenDrawerConsumed} />;
  }

  return <BilliardOccupiedPanel table={table} onSuccess={onSuccess} onRefresh={onRefresh} />;
}

function BilliardOccupiedPanel({ table, onSuccess, onRefresh }: { table: BilliardTableWithSession; onSuccess: () => void; onRefresh?: () => void }) {
  const session = table.currentSession;
  const [showExtend, setShowExtend] = useState(false);
  const [extendMins, setExtendMins] = useState(30);
  const [customExtend, setCustomExtend] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const extendSession = useExtendSession();
  const finishSession = useFinishSession();

  const { data: orderSummary, isLoading: summaryLoading } = useTableOrderSummary(table.id);

  const orderId = orderSummary?.orderId || null;

  const optimisticEditor = useOptimisticOrderEditor({
    orderId,
    queryKey: ['billiard', 'order-summary', table.id],
    onSyncAdd: (oid, item) => billiardApi.addOrderItem(oid, { inventoryId: item.inventoryId!, quantity: item.quantity }),
    onSyncUpdate: (oid, itemId, qty) => billiardApi.updateOrderItem(oid, itemId, { quantity: qty }),
    onSyncRemove: (oid, itemId) => billiardApi.removeOrderItem(oid, itemId),
    debounceMs: 800,
  });

  const orderItems = optimisticEditor.items;
  const foodTotal = optimisticEditor.foodTotal;
  const serviceCharge = orderSummary?.serviceCharge || 0;
  const tax = orderSummary?.tax || 0;
  const hasItems = orderItems.length > 0;

  const playingCost = orderSummary?.playingCost ?? session?.tableFee ?? 0;
  const hourlyRate = orderSummary?.hourlyRate ?? (table as any).hourlyRate ?? 0;
  const bookedDuration = session?.durationMinutes ?? 0;

  const { display: remainingDisplay, expired: timeExpired } = useTimer(session?.expectedEndTime ?? null, true);

  const grandTotal = playingCost + foodTotal + serviceCharge + tax;

  const handleExtend = useAsyncActionGuard(async () => {
    if (!session) return;
    const mins = extendMins === 0 ? parseInt(customExtend, 10) : extendMins;
    if (!mins || mins < 1) return;
    await extendSession.mutateAsync({ sessionId: session.id, additionalMinutes: mins });
    setShowExtend(false);
    onSuccess();
  }, { delay: 500 });

  const handleFinish = useAsyncActionGuard(async () => {
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
  }, { delay: 500 });

  if (!session) {
    return (
      <div className="space-y-4">
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">Đang chơi</span>
        <p className="text-sm text-muted-foreground">Không có phiên chơi nào đang hoạt động.</p>
      </div>
    );
  }

  const sessStartTime = new Date(session.startTime);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">Đang chơi</span>
          <div className={cn('flex items-center gap-1 text-xs font-medium', timeExpired ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
            {timeExpired ? <AlertCircle className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
            {remainingDisplay}
          </div>
        </div>

        {timeExpired && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-2 text-xs text-red-700 dark:text-red-400 text-center font-medium">
            Phiên chơi đã hết giờ
          </div>
        )}

        <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bắt đầu</span>
            <span className="font-medium">{sessStartTime.toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Thời gian đặt</span>
            <span className="font-medium">{bookedDuration} phút</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Giá giờ</span>
            <span className="font-medium tabular-nums">{fmt(hourlyRate)}<span className="text-xs text-muted-foreground">/giờ</span></span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground font-medium">Tiền chơi</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{fmt(playingCost)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết đơn hàng</span>
            {summaryLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
          </div>
          <div className="p-3">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : !hasItems ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa gọi đồ ăn/thức uống</p>
            ) : (
              <div className="space-y-1.5">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-foreground">
                      <span className="text-muted-foreground mr-1">{item.quantity}x</span>
                      {item.name}
                    </span>
                    <span className="font-medium tabular-nums">{item.lineTotal.toLocaleString()}₫</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tiền chơi</span>
            <span className="font-medium tabular-nums">{fmt(playingCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đồ ăn & Thức uống</span>
            <span className="font-medium tabular-nums">{fmt(foodTotal)}</span>
          </div>
          {serviceCharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí dịch vụ</span>
              <span className="font-medium tabular-nums">{fmt(serviceCharge)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thuế</span>
              <span className="font-medium tabular-nums">{fmt(tax)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-border pt-2">
            <span>Tổng cộng</span>
            <span className="text-primary tabular-nums">{fmt(grandTotal)}</span>
          </div>
        </div>

        {!showExtend ? (
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => setDrawerOpen(true)}>
              <Plus className="w-4 h-4" /> Thêm đồ ăn / Thức uống
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setShowExtend(true)}>
              <Clock className="w-4 h-4" /> Gia hạn phiên
            </Button>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleFinish.run} disabled={handleFinish.isBusy || finishSession.isPending}>
              {(handleFinish.isBusy || finishSession.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Thanh toán &mdash; {fmt(grandTotal)}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Gia hạn phiên</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowExtend(false)}>Quay lại</Button>
            </div>
            <div className="flex gap-2">
              {[15, 30, 60].map((m) => (
                <Button key={m} variant={extendMins === m ? 'default' : 'outline'} size="sm" onClick={() => { setExtendMins(m); setCustomExtend(''); }}>+{m}m</Button>
              ))}
              <Button variant={extendMins === 0 ? 'default' : 'outline'} size="sm" onClick={() => setExtendMins(0)}>Tùy chỉnh</Button>
            </div>
            {extendMins === 0 && (
              <div className="space-y-1">
                <Label htmlFor="extendCustom">Số phút thêm</Label>
                <Input id="extendCustom" type="number" min={1} placeholder="Nhập số phút" value={customExtend} onChange={(e) => setCustomExtend(e.target.value)} />
              </div>
            )}
            <Button className="w-full" onClick={handleExtend.run} disabled={handleExtend.isBusy || extendSession.isPending || (extendMins === 0 && (!customExtend || parseInt(customExtend) < 1))}>
              {(handleExtend.isBusy || extendSession.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác nhận gia hạn
            </Button>
          </div>
        )}
      </div>

      <OrderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tableId={table.id}
        tableCode={table.tableCode}
        currentOrderId={orderId}
        mode="BILLIARD"
        onSuccess={() => { if (onRefresh) onRefresh(); }}
        editorProps={{
          items: optimisticEditor.items,
          foodTotal: optimisticEditor.foodTotal,
          isSyncing: optimisticEditor.isSyncing,
          hasPending: optimisticEditor.hasPending,
          addItem: optimisticEditor.addItem,
          changeQuantity: optimisticEditor.changeQuantity,
          removeItem: optimisticEditor.removeItem,
          syncNow: optimisticEditor.syncNow,
        }}
      />
    </>
  );
}

function RestaurantOccupiedPanel({ table, onSuccess, onRefresh, autoOpenDrawer, onAutoOpenDrawerConsumed }: OccupiedPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [targetTableId, setTargetTableId] = useState('');
  const [guestCount, setGuestCount] = useState(String((table.currentOrder as any)?.guestCount || 1));
  const [note, setNote] = useState((table.currentOrder as any)?.note || '');

  const { data: orderData, isLoading } = useRestaurantTableOrder(table.id);
  const { data: allTables } = useRestaurantTables();
  const payOrder = usePayRestaurantOrder();
  const updateGuestCount = useUpdateGuestCount();
  const updateOrderNote = useUpdateOrderNote();
  const transferTable = useTransferTable();
  const mergeTables = useMergeTables();
  const splitOrder = useSplitOrder();

  useEffect(() => {
    if (autoOpenDrawer && !isLoading) {
      setDrawerOpen(true);
      if (onAutoOpenDrawerConsumed) onAutoOpenDrawerConsumed();
    }
  }, [autoOpenDrawer, isLoading]);

  const order = orderData || (table as any).currentOrder;
  const hasItems = (order?.items?.length || 0) > 0;
  const items = order?.items || [];
  const foodTotal = order?.foodTotal || 0;
  const grandTotal = order?.grandTotal || Number((table as any)?.currentOrder?.total || 0);
  const serviceCharge = order?.serviceCharge || 0;
  const tax = order?.tax || 0;
  const discount = order?.discount || 0;
  const total = grandTotal || foodTotal + serviceCharge + tax - discount;

  const availableTables = (allTables || []).filter(t =>
    t.id !== table.id && t.status === 'AVAILABLE' && !(t as any).isMerged
  );

  const occupiedTables = (allTables || []).filter(t =>
    t.id !== table.id && t.status === 'OCCUPIED' && !(t as any).isMerged
  );

  useEffect(() => {
    if ((table as any).currentOrder) {
      setGuestCount(String((table as any).currentOrder.guestCount || 1));
      setNote((table as any).currentOrder.note || '');
    }
  }, [(table as any).currentOrder]);

  const handlePay = useAsyncActionGuard(async (shouldPrint: boolean) => {
    if (!(table as any).currentOrder?.id) return;
    try {
      await payOrder.mutateAsync({
        orderId: (table as any).currentOrder.id,
        paymentMethod,
      });

      toast.success('Thanh toán thành công', {
        description: `${paymentMethod === 'CASH' ? 'Tiền mặt' : paymentMethod === 'CARD' ? 'Thẻ' : 'QR'} • ${fmt(total)}`,
      });

      if (shouldPrint) {
        printReceipt({
          businessName: 'Nhà hàng',
          invoiceNumber: `#${order?.orderNumber || (table as any).currentOrder.orderNumber}`,
          checkoutDate: new Date().toISOString(),
          items: items.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
            total: i.lineTotal,
          })),
          foodTotal,
          serviceCharge: serviceCharge || undefined,
          tax: tax || undefined,
          discount: discount || undefined,
          grandTotal: total,
        });
      }

      setShowPayment(false);
      onSuccess();
    } catch {
      toast.error('Thanh toán thất bại');
    }
  }, { delay: 500 });

  const handleUpdateGuestCount = useAsyncActionGuard(async () => {
    const gc = parseInt(guestCount, 10);
    if (!gc || gc < 1) return;
    try {
      await updateGuestCount.mutateAsync({ tableId: table.id, guestCount: gc });
      toast.success('Cập nhật số khách thành công');
    } catch { toast.error('Cập nhật thất bại'); }
  }, { delay: 300 });

  const handleUpdateNote = useAsyncActionGuard(async () => {
    if (!(table as any).currentOrder?.id) return;
    try {
      await updateOrderNote.mutateAsync({ orderId: (table as any).currentOrder.id, note });
      toast.success('Cập nhật ghi chú thành công');
    } catch { toast.error('Cập nhật thất bại'); }
  }, { delay: 300 });

  const handleTransfer = useAsyncActionGuard(async () => {
    if (!targetTableId) { toast.error('Chọn bàn đích'); return; }
    try {
      await transferTable.mutateAsync({ tableId: table.id, targetTableId });
      toast.success('Chuyển bàn thành công');
      setShowTransfer(false);
      onSuccess();
    } catch { toast.error('Chuyển bàn thất bại'); }
  }, { delay: 500 });

  const handleMerge = useAsyncActionGuard(async () => {
    if (!targetTableId) { toast.error('Chọn bàn đích'); return; }
    try {
      await mergeTables.mutateAsync({ tableId: table.id, targetTableId });
      toast.success('Gộp bàn thành công');
      setShowMerge(false);
      onSuccess();
    } catch { toast.error('Gộp bàn thất bại'); }
  }, { delay: 500 });

  const handleSplit = useAsyncActionGuard(async () => {
    if (!targetTableId) { toast.error('Chọn bàn đích'); return; }
    const itemsToSplit = Object.entries(splitItems)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));
    if (itemsToSplit.length === 0) { toast.error('Chọn món cần tách'); return; }
    try {
      await splitOrder.mutateAsync({ tableId: table.id, targetTableId, items: itemsToSplit });
      toast.success('Tách bàn thành công');
      setShowSplit(false);
      onSuccess();
    } catch { toast.error('Tách bàn thất bại'); }
  }, { delay: 500 });

  const [splitItems, setSplitItems] = useState<Record<string, number>>({});

  useEffect(() => {
    if (order?.items) {
      const itemsMap: Record<string, number> = {};
      order.items.forEach((item: any) => { itemsMap[item.id] = 1; });
      setSplitItems(prev => {
        const merged = { ...itemsMap };
        Object.keys(prev).forEach(k => { if (itemsMap[k] !== undefined) merged[k] = prev[k]; });
        return merged;
      });
    }
  }, [order?.items]);

  return (
    <>
      <div className="space-y-4">
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">Có khách</span>

        <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{(table as any).currentOrder?.guestCount || 1} khách</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label className="text-xs">Số khách</Label>
            <div className="flex gap-1 mt-1">
              <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} className="h-8" />
              <Button size="sm" variant="outline" onClick={handleUpdateGuestCount.run} disabled={handleUpdateGuestCount.isBusy || updateGuestCount.isPending}>Cập nhật</Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết đơn hàng</span>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
          </div>
          <div className="p-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
            ) : !hasItems ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa gọi món</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {items.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-foreground">
                      <span className="text-muted-foreground mr-1">{item.quantity}x</span>
                      {item.name}
                    </span>
                    <span className="font-medium tabular-nums">{item.lineTotal.toLocaleString()}₫</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Món</span><span className="font-medium tabular-nums">{fmt(foodTotal)}</span></div>
          {serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Phí dịch vụ</span><span className="font-medium tabular-nums">{fmt(serviceCharge)}</span></div>}
          {tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Thuế</span><span className="font-medium tabular-nums">{fmt(tax)}</span></div>}
          {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Giảm giá</span><span className="font-medium tabular-nums">-{fmt(discount)}</span></div>}
          <div className="flex justify-between text-base font-bold border-t border-border pt-2">
            <span>Tổng cộng</span>
            <span className="text-primary tabular-nums">{fmt(total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => setDrawerOpen(true)}>
            <Plus className="w-4 h-4" /> Thêm món
          </Button>

          <Button variant="outline" className="w-full justify-start" onClick={() => { setShowTransfer(!showTransfer); setShowMerge(false); setShowSplit(false); }}>
            <ArrowRightLeft className="w-4 h-4" /> Chuyển bàn
          </Button>

          {showTransfer && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Chọn bàn đích</Label>
              <Select value={targetTableId} onValueChange={setTargetTableId}>
                <SelectTrigger><SelectValue placeholder="Chọn bàn trống..." /></SelectTrigger>
                <SelectContent>
                  {availableTables.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.tableName || t.tableCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" onClick={handleTransfer.run} disabled={handleTransfer.isBusy || !targetTableId || transferTable.isPending}>Xác nhận chuyển</Button>
            </div>
          )}

          <Button variant="outline" className="w-full justify-start" onClick={() => { setShowMerge(!showMerge); setShowTransfer(false); setShowSplit(false); }}>
            <Merge className="w-4 h-4" /> Gộp bàn
          </Button>

          {showMerge && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Chọn bàn chính để gộp vào</Label>
              <Select value={targetTableId} onValueChange={setTargetTableId}>
                <SelectTrigger><SelectValue placeholder="Chọn bàn có khách..." /></SelectTrigger>
                <SelectContent>
                  {occupiedTables.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.tableName || t.tableCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" onClick={handleMerge.run} disabled={handleMerge.isBusy || !targetTableId || mergeTables.isPending}>Xác nhận gộp</Button>
            </div>
          )}

          <Button variant="outline" className="w-full justify-start" onClick={() => { setShowSplit(!showSplit); setShowTransfer(false); setShowMerge(false); }}>
            <Split className="w-4 h-4" /> Tách bàn
          </Button>

          {showSplit && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Chọn món cần tách</Label>
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">{item.name}</span>
                  <Input type="number" min={0} max={item.quantity} value={splitItems[item.id] || 0} onChange={(e) => setSplitItems(prev => ({ ...prev, [item.id]: Math.min(parseInt(e.target.value) || 0, item.quantity) }))} className="w-16 h-8 text-center" />
                  <span className="text-xs text-muted-foreground">/ {item.quantity}</span>
                </div>
              ))}
              <div className="pt-2">
                <Label>Chọn bàn đích (trống)</Label>
                <Select value={targetTableId} onValueChange={setTargetTableId}>
                  <SelectTrigger><SelectValue placeholder="Chọn bàn trống..." /></SelectTrigger>
                  <SelectContent>
                    {availableTables.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.tableName || t.tableCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="w-full" onClick={handleSplit.run} disabled={handleSplit.isBusy || !targetTableId || splitOrder.isPending}>Xác nhận tách</Button>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Ghi chú</Label>
            <div className="flex gap-1">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú..." className="h-8 text-sm" />
              <Button size="sm" variant="outline" onClick={handleUpdateNote.run} disabled={handleUpdateNote.isBusy || updateOrderNote.isPending}>Lưu</Button>
            </div>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => { setShowPayment(!showPayment); setShowTransfer(false); setShowMerge(false); setShowSplit(false); }}>
            <LogOut className="w-4 h-4" />
            Thanh toán — {fmt(total)}
          </Button>

          {showPayment && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
              <Label className="text-sm font-semibold">Phương thức thanh toán</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Chọn phương thức" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Tiền mặt</SelectItem>
                  <SelectItem value="CARD">Thẻ / Chuyển khoản</SelectItem>
                  <SelectItem value="QR">QR Code</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1 gap-1.5" onClick={() => handlePay.run(true)} disabled={handlePay.isBusy || !hasItems}>
                  {handlePay.isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Thanh toán & In hóa đơn
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => handlePay.run(false)} disabled={handlePay.isBusy || !hasItems}>
                  {handlePay.isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Không in
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <OrderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tableId={table.id}
        tableName={table.tableName || table.tableCode}
        currentOrderId={(table as any).currentOrder?.id || null}
        mode="RESTAURANT"
        onSuccess={() => { if (onRefresh) onRefresh(); }}
      />
    </>
  );
}
