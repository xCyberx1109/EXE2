import { useState, useEffect } from 'react';
import {
  Users, ShoppingCart, Plus, LogOut,
  Loader2, ArrowRightLeft, Merge, Split,
  Printer, Ban, Timer,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/app/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';
import {
  useFinishSession, useTableOrderSummary,
  useRestaurantTableOrder, usePayRestaurantOrder, useUpdateGuestCount, useUpdateOrderNote,
  useTransferTable, useMergeTables, useSplitOrder, useRestaurantTables,
} from '../hooks';
import { OrderDrawer } from './OrderDrawer';
import { printReceipt } from '@/shared/utils/printReceipt';
import { cn } from '@/app/components/ui/utils';
import { useAsyncActionGuard, useConcurrentGuard } from '@/shared/hooks/useAsyncActionGuard';
import { formatTime } from '@/shared/utils/date';
import { useOptimisticOrderEditor } from '@/shared/hooks/useOptimisticOrderEditor';
import { billiardApi } from '@/app/api/services';
import type { BilliardTableWithSession } from '../types';

const fmt = (n: number) => n.toLocaleString() + ' ₫';

function useCountUpTimer(startTime: string | null, frozenSeconds?: number): { display: string; elapsedSeconds: number } {
  const [display, setDisplay] = useState('00:00:00');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startTime) { setDisplay('00:00:00'); setElapsedSeconds(0); return; }

    const start = new Date(startTime).getTime();
    if (isNaN(start)) { setDisplay('00:00:00'); setElapsedSeconds(0); return; }

    if (frozenSeconds !== undefined) {
      const fSec = Math.max(0, frozenSeconds);
      const hh = Math.floor(fSec / 3600);
      const mm = Math.floor((fSec % 3600) / 60);
      const ss = fSec % 60;
      setDisplay(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);
      setElapsedSeconds(fSec);
      return;
    }

    function tick() {
      const eMs = Date.now() - start;
      const tSec = Math.max(0, Math.floor(eMs / 1000));
      const hh = Math.floor(tSec / 3600);
      const mm = Math.floor((tSec % 3600) / 60);
      const ss = tSec % 60;
      setDisplay(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);
      setElapsedSeconds(tSec);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => { clearInterval(interval); };
  }, [startTime, frozenSeconds]);

  return { display, elapsedSeconds };
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [checkoutSnapshot, setCheckoutSnapshot] = useState<{
    endTime: Date;
    elapsedSeconds: number;
    playAmount: number;
    foodTotal: number;
    serviceCharge: number;
    tax: number;
    grandTotal: number;
  } | null>(null);

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

  const hourlyRate = orderSummary?.hourlyRate ?? (table as any).hourlyRate ?? 0;
  const isPlaying = session?.status === 'PLAYING';

  const { display: remainingDisplay, elapsedSeconds } = useCountUpTimer(session?.startTime ?? null, checkoutSnapshot?.elapsedSeconds);
  const playAmount = isPlaying && hourlyRate > 0 ? Math.round((hourlyRate / 3600) * elapsedSeconds) : 0;

  const grandTotal = playAmount + foodTotal + serviceCharge + tax;

  const handleFinish = useConcurrentGuard(async () => {
    const snap = checkoutSnapshot;
    if (!snap) return;

    try {
      await finishSession.mutateAsync(table.id);

      const durMinutes = Math.floor(snap.elapsedSeconds / 60);
      const durSeconds = snap.elapsedSeconds % 60;

      const allItems = [
        {
          name: `Tiền giờ chơi<br/><span style="font-size:10px">${durMinutes} phút ${durSeconds} giây</span>`,
          quantity: 1,
          unitPrice: snap.playAmount,
          total: snap.playAmount,
        },
        ...orderItems.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          total: i.lineTotal,
        })),
      ];
      const itemsTotal = allItems.reduce((s, i) => s + i.total, 0);

      printReceipt({
        invoiceNumber: orderSummary?.orderNumber || table.id,
        checkoutDate: snap.endTime.toISOString(),
        items: allItems,
        foodTotal: itemsTotal,
        serviceCharge: snap.serviceCharge,
        tax: snap.tax,
        grandTotal: snap.grandTotal,
      });

      setCheckoutSnapshot(null);
      setShowFinishConfirm(false);
      onSuccess();
    } catch {
      toast.error('Thanh toán thất bại');
    }
  });

  if (!session) {
    return (
      <div className="space-y-1.5">
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">Đang chơi</span>
        <p className="text-xs text-muted-foreground">Không có phiên chơi nào đang hoạt động.</p>
      </div>
    );
  }

  const sessStartTime = session.startTime ? new Date(session.startTime) : null;

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">
            Đang chơi
          </span>
          {isPlaying && (
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Timer className="size-2.5" />
              {remainingDisplay}
            </div>
          )}
        </div>

        <div className="rounded-md bg-muted/30 p-2 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bắt đầu</span>
            <span className="font-medium">{formatTime(session.startTime) || '--:--'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Giá giờ</span>
            <span className="font-medium tabular-nums">{fmt(hourlyRate)}<span className="text-xs text-muted-foreground">/giờ</span></span>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground font-medium">Tiền chơi</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{fmt(playAmount)}</span>
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <div className="bg-muted/50 px-2 py-1.5 border-b border-border flex items-center gap-1.5">
            <ShoppingCart className="size-3 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết đơn hàng</span>
            {summaryLoading && <Loader2 className="size-2.5 animate-spin ml-auto" />}
          </div>
          <div className="p-2">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="size-3.5 animate-spin text-muted-foreground" /></div>
            ) : !hasItems ? (
              <p className="text-xs text-muted-foreground text-center py-4">Chưa gọi đồ ăn/thức uống</p>
            ) : (
              <div className="space-y-1.5">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
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

          <div className="rounded-md bg-muted/30 p-2 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tiền chơi</span>
            <span className="font-medium tabular-nums">{fmt(playAmount)}</span>
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
          <div className="flex justify-between text-xs font-bold border-t border-border pt-2">
            <span>Tổng cộng</span>
            <span className="text-primary tabular-nums">{fmt(grandTotal)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
            <Button variant="outline" className="w-full justify-start" onClick={() => setDrawerOpen(true)}>
              <Plus className="size-3.5" /> Thêm đồ ăn / Thức uống
            </Button>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => { setCheckoutSnapshot({ endTime: new Date(), elapsedSeconds, playAmount, foodTotal, serviceCharge, tax, grandTotal }); setShowFinishConfirm(true); }} disabled={!session || !!checkoutSnapshot || handleFinish.isBusy || finishSession.isPending}>
              {(handleFinish.isBusy || finishSession.isPending) ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
              Thanh toán &mdash; {fmt(grandTotal)}
            </Button>
          </div>
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

      <Dialog open={showFinishConfirm} onOpenChange={(open) => { if (!open) { setShowFinishConfirm(false); setCheckoutSnapshot(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center text-base uppercase tracking-wider">Thanh toán bàn</DialogTitle>
            <DialogDescription className="text-center">
              Bàn <strong>{table.tableName || table.tableCode}</strong>
            </DialogDescription>
          </DialogHeader>

          {checkoutSnapshot && (() => {
            const snap = checkoutSnapshot;
            const startDate = session?.startTime ? new Date(session.startTime) : new Date();
            const endDate = snap.endTime;
            const durMinutes = Math.floor(snap.elapsedSeconds / 60);
            const durSeconds = snap.elapsedSeconds % 60;
            return (
              <div className="space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5 bg-muted/30 rounded-md p-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Bắt đầu</span>
                    <p className="font-medium tabular-nums">{formatTime(startDate)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Kết thúc</span>
                    <p className="font-medium tabular-nums">{formatTime(endDate)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-muted/30 rounded-md px-2 py-1.5">
                  <span className="text-muted-foreground">Thời lượng</span>
                  <span className="font-semibold tabular-nums">{durMinutes} phút {durSeconds} giây</span>
                </div>

                <div className="border-t border-border pt-2 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tiền giờ chơi</span>
                    <span className="font-medium tabular-nums">{fmt(snap.playAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đồ ăn & Thức uống</span>
                    <span className="font-medium tabular-nums">{fmt(snap.foodTotal)}</span>
                  </div>
                  {snap.serviceCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phí dịch vụ</span>
                      <span className="font-medium tabular-nums">{fmt(snap.serviceCharge)}</span>
                    </div>
                  )}
                  {snap.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thuế</span>
                      <span className="font-medium tabular-nums">{fmt(snap.tax)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-xs font-bold border-t-2 border-dashed border-border pt-2">
                  <span>Tổng cộng</span>
                  <span className="text-blue-600 dark:text-blue-400 tabular-nums">{fmt(snap.grandTotal)}</span>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFinishConfirm(false); setCheckoutSnapshot(null); }}>Hủy</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleFinish.run} disabled={handleFinish.isBusy}>
              {handleFinish.isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
              Xác nhận thanh toán
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      {/* ── Layout: flex column, fill height của wrapper ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ── STICKY TOP: trạng thái + thông tin nhanh ── */}
        <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400">Có khách</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{(table as any).currentOrder?.guestCount || 1} khách</span>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE BODY: chi tiết đơn + thao tác ── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Số khách */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <Label className="text-xs">Số khách</Label>
              <div className="flex gap-1 mt-1">
                <Input type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} className="h-7" />
                <Button size="sm" variant="outline" onClick={handleUpdateGuestCount.run} disabled={handleUpdateGuestCount.isBusy || updateGuestCount.isPending}>Cập nhật</Button>
              </div>
            </div>
          </div>

          {/* Chi tiết đơn hàng */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="bg-muted/50 px-2 py-1.5 border-b border-border flex items-center gap-1.5">
              <ShoppingCart className="size-3 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết đơn hàng</span>
              {isLoading && <Loader2 className="size-2.5 animate-spin ml-auto" />}
            </div>
            <div className="p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="size-3.5 animate-spin" /></div>
              ) : !hasItems ? (
                <p className="text-xs text-muted-foreground text-center py-4">Chưa gọi món</p>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto -mr-1 pr-1">
                  <div className="space-y-1.5">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-foreground">
                          <span className="text-muted-foreground mr-1">{item.quantity}x</span>
                          {item.name}
                        </span>
                        <span className="font-medium tabular-nums">{item.lineTotal.toLocaleString()}₫</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tóm tắt giá */}
        <div className="rounded-md bg-muted/30 p-2 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Món</span><span className="font-medium tabular-nums">{fmt(foodTotal)}</span></div>
            {serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Phí dịch vụ</span><span className="font-medium tabular-nums">{fmt(serviceCharge)}</span></div>}
            {tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Thuế</span><span className="font-medium tabular-nums">{fmt(tax)}</span></div>}
            {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Giảm giá</span><span className="font-medium tabular-nums">-{fmt(discount)}</span></div>}
          </div>

          {/* Thêm món */}
          <Button variant="outline" className="w-full justify-start" onClick={() => setDrawerOpen(true)}>
            <Plus className="size-3.5" /> Thêm món
          </Button>

      
        
          {/* Ghi chú */}
          <div className="space-y-1">
            <Label className="text-xs">Ghi chú</Label>
            <div className="flex gap-1">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú..." className="h-7 text-xs" />
              <Button size="sm" variant="outline" onClick={handleUpdateNote.run} disabled={handleUpdateNote.isBusy || updateOrderNote.isPending}>Lưu</Button>
            </div>
          </div>

          {/* Phương thức thanh toán — chỉ hiện khi mở panel */}
          {showPayment && (
            <div className="space-y-1.5 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3">
              <Label className="text-xs font-semibold">Phương thức thanh toán</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Chọn phương thức" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Tiền mặt</SelectItem>
                  <SelectItem value="CARD">Thẻ / Chuyển khoản</SelectItem>
                  <SelectItem value="QR">QR Code</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1.5 pt-1">
                <Button className="flex-1 gap-1.5" onClick={() => handlePay.run(true)} disabled={handlePay.isBusy || !hasItems}>
                  {handlePay.isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
                  In hóa đơn
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => handlePay.run(false)} disabled={handlePay.isBusy || !hasItems}>
                  {handlePay.isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
                  Không in
                </Button>
              </div>
            </div>
          )}

          {/* Padding đáy để nội dung không bị footer che */}
          <div className="h-2" />
        </div>

        {/* ── STICKY FOOTER: tổng tiền + nút thanh toán ── */}
        <div className="shrink-0 border-t border-border bg-card px-3 py-3 space-y-1.5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span>Tổng cộng</span>
            <span className="text-primary tabular-nums">{fmt(total)}</span>
          </div>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => { setShowPayment(!showPayment); setShowTransfer(false); setShowMerge(false); setShowSplit(false); }}
          >
            <LogOut className="size-3.5" />
            {showPayment ? 'Đóng thanh toán' : `Thanh toán — ${fmt(total)}`}
          </Button>
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