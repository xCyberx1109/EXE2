import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Plus, Minus, Search, ShoppingCart, Trash2, Loader2, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useInventoryItems } from '@/app/api/hooks';
import { billiardApi } from '@/app/api/services';
import { useQueryClient } from '@tanstack/react-query';
import { useAddOrderItem, useUpdateOrderItem, useRemoveOrderItem, useTableOrderSummary } from '../hooks';
import type { BilliardOrderSummary } from '@/app/api/services';
import type { InventoryItem } from '@/app/types';

interface OrderFoodDrinkDrawerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  tableCode?: string;
  currentOrderId: string | null;
  onSuccess: () => void;
}

interface DisplayItem {
  ingredientId: string;
  ingredientName: string;
  stockQty: number;
  unit: string;
  price: number;
  available: boolean;
}

export function OrderFoodDrinkDrawer({ open, onClose, tableId, tableCode, currentOrderId, onSuccess }: OrderFoodDrinkDrawerProps) {
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: inventoryItems = [], isLoading: itemsLoading } = useInventoryItems();
  const { data: orderSummary, isLoading: summaryLoading } = useTableOrderSummary(tableId);
  const addOrderItem = useAddOrderItem();
  const updateOrderItem = useUpdateOrderItem();
  const removeOrderItem = useRemoveOrderItem();
  const queryClient = useQueryClient();

  const pendingRef = useRef<Map<string, number>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const orderIdRef = useRef<string | null>(null);

  const orderId = currentOrderId || orderSummary?.orderId || null;
  orderIdRef.current = orderId;

  useEffect(() => {
    if (!open) { setSearch(''); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    for (const inv of inventoryItems) map.set(inv.id, inv);
    return map;
  }, [inventoryItems]);

  const displayItems: DisplayItem[] = useMemo(() => {
    return inventoryItems
      .map((inv) => ({
        ingredientId: inv.id,
        ingredientName: inv.name,
        stockQty: Number(inv.quantity ?? 0),
        unit: inv.unit || 'pc',
        price: Number(inv.price),
        available: inv.available !== false,
      }))
      .sort((a, b) => {
        if (a.stockQty > 0 !== b.stockQty > 0) return a.stockQty > 0 ? -1 : 1;
        return a.ingredientName.localeCompare(b.ingredientName);
      });
  }, [inventoryItems]);

  const filteredItems = useMemo(() => {
    if (!search) return displayItems;
    const q = search.toLowerCase();
    return displayItems.filter((item) => item.ingredientName.toLowerCase().includes(q));
  }, [displayItems, search]);

  const flushPending = useCallback(async () => {
    if (pendingRef.current.size === 0) return;

    const changes = Array.from(pendingRef.current.entries()).map(([inventoryId, quantity]) => ({
      inventoryId,
      quantity,
    }));
    pendingRef.current.clear();

    const oid = orderIdRef.current;
    if (!oid) {
      console.warn('[Batch] No order ID, cannot flush');
      setIsSyncing(false);
      return;
    }

    console.log('[Batch] Sending payload:', JSON.stringify({ items: changes }));

    try {
      const result = await billiardApi.batchAddOrderItems(oid, { items: changes });
      console.log('[Batch] Success:', result);
      queryClient.setQueryData<BilliardOrderSummary>(['billiard', 'orderSummary', tableId], result);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err: any) {
      console.error(
        '[Batch] Failed to add items — orderId:', oid,
        'payload:', JSON.stringify({ items: changes }),
        'error:', err?.response?.data || err?.message || err,
      );
      queryClient.invalidateQueries({ queryKey: ['billiard', 'orderSummary', tableId] });
    } finally {
      setIsSyncing(false);
    }
  }, [tableId, queryClient]);

  const handleCardClick = useCallback((inventoryId: string) => {
    const oid = orderIdRef.current;
    if (!oid) return;

    const inv = inventoryMap.get(inventoryId);
    if (!inv) return;

    queryClient.setQueryData<BilliardOrderSummary>(
      ['billiard', 'orderSummary', tableId],
      (old) => {
        if (!old) return old;
        const items = [...old.items];
        const existingIdx = items.findIndex(i => i.inventoryId === inventoryId);

        if (existingIdx >= 0) {
          const item = items[existingIdx];
          items[existingIdx] = {
            ...item,
            quantity: item.quantity + 1,
            lineTotal: (item.quantity + 1) * item.price,
          };
        } else {
          items.push({
            id: `opt-${inventoryId}`,
            menuItemId: null,
            inventoryId,
            name: inv.name,
            price: inv.price,
            quantity: 1,
            lineTotal: inv.price,
          });
        }

        const foodTotal = items.reduce((s, i) => s + i.lineTotal, 0);
        return {
          ...old,
          items,
          foodTotal,
          grandTotal: old.tableFee + foodTotal + old.serviceCharge + old.tax,
        };
      },
    );

    pendingRef.current.set(inventoryId, (pendingRef.current.get(inventoryId) || 0) + 1);
    setIsSyncing(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flushPending, 600);
  }, [tableId, queryClient, inventoryMap, flushPending]);

  const handleUpdateQty = useCallback(async (itemId: string, menuItemId: string, currentQty: number, delta: number) => {
    const oid = orderIdRef.current;
    if (!oid) return;
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      try { await removeOrderItem.mutateAsync({ orderId: oid, itemId, tableId }); }
      catch (err) { console.error('[OrderFoodDrinkDrawer] Remove item error:', err); }
    } else {
      try { await updateOrderItem.mutateAsync({ orderId: oid, itemId, quantity: newQty, tableId }); }
      catch (err) { console.error('[OrderFoodDrinkDrawer] Update qty error:', err); }
    }
  }, [tableId, updateOrderItem, removeOrderItem]);

  const handleRemoveItem = useCallback(async (itemId: string) => {
    const oid = orderIdRef.current;
    if (!oid) return;
    try { await removeOrderItem.mutateAsync({ orderId: oid, itemId, tableId }); }
    catch (err) { console.error('[OrderFoodDrinkDrawer] Remove item error:', err); }
  }, [tableId, removeOrderItem]);

  const isPending = addOrderItem.isPending || updateOrderItem.isPending || removeOrderItem.isPending;

  const cartItems = orderSummary?.items || [];
  const foodTotal = orderSummary?.foodTotal || 0;
  const tableFee = orderSummary?.tableFee || 0;
  const serviceCharge = orderSummary?.serviceCharge || 0;
  const tax = orderSummary?.tax || 0;
  const grandTotal = orderSummary?.grandTotal || 0;
  const hasItems = cartItems.length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <div className="flex flex-col w-full h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Thêm món</h2>
            {tableCode && <span className="text-sm text-muted-foreground">Bàn {tableCode}</span>}
            {orderSummary?.orderNumber && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                #{orderSummary.orderNumber}
              </span>
            )}
            {isSyncing && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Đang đồng bộ...
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* 50/50 split */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT - Ingredient / Inventory */}
          <div className="flex-1 flex flex-col overflow-hidden border-r">
            <div className="px-4 py-3 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm nguyên liệu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {itemsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Không tìm thấy nguyên liệu
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredItems.map((item) => {
                    const outOfStock = item.stockQty <= 0 || !item.available;
                    const lowStock = item.stockQty > 0 && item.stockQty <= 5;
                    return (
                      <div
                        key={item.ingredientId}
                        onClick={() => !outOfStock && handleCardClick(item.ingredientId)}
                        className={`rounded-lg border bg-card p-3 flex flex-col gap-2 transition-colors ${
                          outOfStock
                            ? 'opacity-50 border-destructive/30 cursor-not-allowed'
                            : 'hover:border-primary/50 hover:shadow-sm cursor-pointer active:scale-[0.98]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.ingredientName}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="text-base font-bold text-primary">
                              {item.price.toLocaleString()}₫
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-xs font-medium ${
                            outOfStock ? 'text-destructive' :
                            lowStock ? 'text-amber-500' :
                            'text-muted-foreground'
                          }`}>
                            Tồn: {item.stockQty} {item.unit}
                          </span>
                          {outOfStock && (
                            <AlertTriangle className="w-3 h-3 text-destructive ml-auto" />
                          )}
                        </div>
                        {outOfStock && (
                          <div className="flex items-center gap-1 text-destructive text-xs font-medium mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            Hết hàng
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - Cart */}
          <div className="w-[50%] min-w-[350px] max-w-[500px] flex flex-col bg-muted/30">
            <div className="px-4 py-3 border-b bg-card shrink-0">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Đơn hiện tại
                {summaryLoading && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                {hasItems && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full ml-auto">
                    {cartItems.reduce((s, i) => s + i.quantity, 0)} món
                  </span>
                )}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              {summaryLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !hasItems ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">Chưa gọi món</p>
                  <p className="text-xs opacity-60 mt-1">Nhấn vào món bên trái để thêm</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.price.toLocaleString()}₫ / đơn vị</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={isPending || !orderId}
                          onClick={() => handleUpdateQty(item.id, item.menuItemId || '', item.quantity, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={isPending || !orderId}
                          onClick={() => handleUpdateQty(item.id, item.menuItemId || '', item.quantity, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <p className="text-sm font-semibold tabular-nums">{item.lineTotal.toLocaleString()}₫</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={isPending || !orderId} onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="px-4 py-3 border-t bg-card shrink-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tổng món</span>
                <span className="font-medium tabular-nums">{foodTotal.toLocaleString()}₫</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phí bàn</span>
                <span className="font-medium tabular-nums">{tableFee.toLocaleString()}₫</span>
              </div>
              {serviceCharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phí dịch vụ</span>
                  <span className="font-medium tabular-nums">{serviceCharge.toLocaleString()}₫</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Thuế</span>
                  <span className="font-medium tabular-nums">{tax.toLocaleString()}₫</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Tổng cộng</span>
                <span className="text-primary tabular-nums">{grandTotal.toLocaleString()}₫</span>
              </div>
            </div>

            <div className="px-4 py-3 border-t shrink-0">
              <Button className="w-full" onClick={() => { onSuccess(); onClose(); }}>
                Xong
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
