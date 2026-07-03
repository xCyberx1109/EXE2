import { useMemo, useState, useEffect } from 'react';
import {
  Loader2, Minus, Plus, Search, ShoppingCart, Trash2, X,
  Package, AlertTriangle, Cloud,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useMenuItems, useSellableItems } from '@/app/api/hooks';
import { useOptimisticOrderEditor } from '@/shared/hooks/useOptimisticOrderEditor';
import type { MenuItem, SellableItem } from '@/app/types';
import {
  useRestaurantTableOrder,
  useTableOrderSummary,
} from '../hooks';
import { billiardApi, restaurantApi } from '@/app/api/services';

interface OptimisticEditorProps {
  items: any[];
  foodTotal: number;
  isSyncing: boolean;
  hasPending: boolean;
  addItem: (params: { menuItemId?: string; inventoryId?: string; name: string; price: number }) => void;
  changeQuantity: (itemId: string, delta: number) => void;
  removeItem: (itemId: string) => void;
  syncNow: () => Promise<void>;
}

interface OrderDrawerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  tableName?: string;
  tableCode?: string;
  currentOrderId: string | null;
  onSuccess: () => void;
  mode: 'RESTAURANT' | 'BILLIARD';
  editorProps?: OptimisticEditorProps;
}

interface BilliardDisplayItem {
  id: string;
  name: string;
  stockQty: number;
  unit: string;
  price: number;
  available: boolean;
}

export function OrderDrawer({ open, onClose, tableId, tableName, tableCode, currentOrderId, onSuccess, mode, editorProps }: OrderDrawerProps) {
  const [search, setSearch] = useState('');

  const isRestaurant = mode === 'RESTAURANT';
  const displayName = tableName || tableCode;

  const { data: menuData, isLoading: menuLoading } = useMenuItems({ available: 'true' });
  const { data: orderData, isLoading: orderLoading } = useRestaurantTableOrder(tableId);

  const { data: sellableData, isLoading: itemsLoading } = useSellableItems();

  const menuItems = Array.isArray(menuData) ? menuData : (menuData?.data ?? []);
  const sellableItems = sellableData ?? [];
  const { data: orderSummary, isLoading: summaryLoading } = useTableOrderSummary(tableId);

  const order = orderData as any;
  const orderId = currentOrderId || (isRestaurant ? order?.id : orderSummary?.orderId) || null;

  const localEditor = useOptimisticOrderEditor({
    orderId,
    queryKey: isRestaurant
      ? ['restaurant', 'order', tableId]
      : ['billiard', 'order-summary', tableId],
    onSyncAdd: isRestaurant
      ? (oid, item) => restaurantApi.addOrderItem(oid, { menuItemId: item.menuItemId!, quantity: item.quantity })
      : (oid, item) => billiardApi.addOrderItem(oid, { inventoryId: item.inventoryId!, quantity: item.quantity }),
    onSyncUpdate: isRestaurant
      ? (oid, itemId, qty) => restaurantApi.updateOrderItem(oid, itemId, { quantity: qty })
      : (oid, itemId, qty) => billiardApi.updateOrderItem(oid, itemId, { quantity: qty }),
    onSyncRemove: isRestaurant
      ? (oid, itemId) => restaurantApi.removeOrderItem(oid, itemId)
      : (oid, itemId) => billiardApi.removeOrderItem(oid, itemId),
    debounceMs: 800,
  });

  const optimisticEditor = (!isRestaurant && editorProps) ? editorProps : localEditor;

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const displayItems: BilliardDisplayItem[] = useMemo(() => {
    return sellableItems
      .map((item) => ({
        id: item.id,
        name: item.name,
        stockQty: Number(item.availableQuantity ?? 0),
        unit: item.unit,
        price: Number(item.sellingPrice),
        available: true,
      }))
      .sort((a, b) => {
        if (a.stockQty > 0 !== b.stockQty > 0) return a.stockQty > 0 ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [sellableItems]);

  const handleRestaurantAdd = (item: MenuItem) => {
    if (!orderId) return;
    optimisticEditor.addItem({ menuItemId: item.id, name: item.name, price: Number(item.price) });
  };

  const handleInventoryCardClick = (item: BilliardDisplayItem) => {
    if (!orderId) return;
    optimisticEditor.addItem({ inventoryId: item.id, name: item.name, price: item.price });
  };

  const filteredMenuItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const availableItems = (menuItems as MenuItem[]).filter((item) => item.available !== false);
    if (!q) return availableItems;
    return availableItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [menuItems, search]);

  const filteredInventoryItems = useMemo(() => {
    if (!search) return displayItems;
    const q = search.toLowerCase();
    return displayItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [displayItems, search]);

  if (!open) return null;

  const restaurantFoodTotal = optimisticEditor.foodTotal;
  const billiardFoodTotal = isRestaurant ? 0 : optimisticEditor.foodTotal;
  const tableFee = orderSummary?.tableFee || 0;
  const billiardServiceCharge = orderSummary?.serviceCharge || 0;
  const billiardTax = orderSummary?.tax || 0;
  const billiardGrandTotal = billiardFoodTotal + tableFee + billiardServiceCharge + billiardTax;

  const handleDone = () => {
    onSuccess();
    onClose();
  };

  const orderItems = optimisticEditor.items;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      <div className="flex h-full w-full flex-col bg-background">
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-foreground">Thêm món</h2>
            {displayName && <span className="text-xs text-muted-foreground">{isRestaurant ? displayName : `Bàn ${displayName}`}</span>}
            {isRestaurant ? (
              order?.orderNumber && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  #{order.orderNumber}
                </span>
              )
            ) : (
              orderSummary?.orderNumber && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  #{orderSummary.orderNumber}
                </span>
              )
            )}
            {(optimisticEditor.isSyncing || optimisticEditor.hasPending) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <Cloud className="size-2.5" />
                Saving...
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col border-r">
            <div className="border-b px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={isRestaurant ? 'Tìm món...' : 'Tìm nguyên liệu...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {isRestaurant ? (
                menuLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredMenuItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Không tìm thấy món
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredMenuItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="rounded-md border bg-card p-2 text-left transition hover:border-primary/50 hover:shadow-sm disabled:opacity-50"
                        disabled={!orderId}
                        onClick={() => handleRestaurantAdd(item)}
                      >
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="mt-1 text-xs font-bold text-primary">{Number(item.price).toLocaleString()} ₫</div>
                        {item.category && <div className="mt-1 text-xs text-muted-foreground">{item.category}</div>}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                itemsLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredInventoryItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Không tìm thấy nguyên liệu
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredInventoryItems.map((item) => {
                      const outOfStock = item.stockQty <= 0 || !item.available;
                      const lowStock = item.stockQty > 0 && item.stockQty <= 5;
                      return (
                        <div
                          key={item.id}
                          onClick={() => !outOfStock && handleInventoryCardClick(item)}
                          className={`rounded-md border bg-card p-2 flex flex-col gap-1.5 transition-colors ${
                            outOfStock
                              ? 'opacity-50 border-destructive/30 cursor-not-allowed'
                              : 'hover:border-primary/50 hover:shadow-sm cursor-pointer active:scale-[0.98]'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-base font-bold text-primary">{item.price.toLocaleString()}₫</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Package className="size-3 text-muted-foreground" />
                            <span className={`text-xs font-medium ${
                              outOfStock ? 'text-destructive' :
                              lowStock ? 'text-amber-500' :
                              'text-muted-foreground'
                            }`}>
                              Tồn: {item.stockQty} {item.unit}
                            </span>
                            {outOfStock && <AlertTriangle className="size-2.5 text-destructive ml-auto" />}
                          </div>
                          {outOfStock && (
                            <div className="flex items-center gap-1 text-destructive text-xs font-medium mt-1">
                              <AlertTriangle className="size-2.5" />
                              Hết hàng
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>

          <div className={`flex flex-col bg-muted/30 ${isRestaurant ? 'w-[42%] min-w-0' : 'w-1/2 min-w-0'}`}>
            <div className="flex items-center gap-1.5 border-b bg-card px-4 py-3 font-semibold">
              <ShoppingCart className="size-3.5" />
              Đơn hiện tại
              {(isRestaurant ? orderLoading : summaryLoading) && <Loader2 className="ml-auto size-2.5 animate-spin" />}
              {!isRestaurant && orderItems.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full ml-auto">
                  {orderItems.reduce((s: number, i: any) => s + i.quantity, 0)} món
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
              {isRestaurant ? (
                orderLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : orderItems.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-xs text-muted-foreground">
                    <ShoppingCart className="mb-2 h-8 w-10 opacity-30" />
                    Chưa gọi món
                  </div>
                ) : (
                  <div className="space-y-1">
                    {orderItems.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-1.5 border-b py-2 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{Number(item.price).toLocaleString()} ₫</p>
                        </div>
                        <Button variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => optimisticEditor.changeQuantity(item.id, -1)}>
                          <Minus className="size-2.5" />
                        </Button>
                        <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => optimisticEditor.changeQuantity(item.id, 1)}>
                          <Plus className="size-2.5" />
                        </Button>
                        <span className="min-w-[84px] text-right text-xs font-semibold">{Number(item.lineTotal).toLocaleString()} ₫</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                          onClick={() => optimisticEditor.removeItem(item.id)}>
                          <Trash2 className="size-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                summaryLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : orderItems.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-xs text-muted-foreground">
                    <ShoppingCart className="mb-2 size-8 opacity-30" />
                    Chưa gọi món
                    <p className="text-xs opacity-60 mt-1">Nhấn vào món bên trái để thêm</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {orderItems.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-1.5 border-b py-2 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.price.toLocaleString()}₫ / đơn vị</p>
                        </div>
                        <Button variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => optimisticEditor.changeQuantity(item.id, -1)}>
                          <Minus className="size-2.5" />
                        </Button>
                        <span className="w-8 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6"
                          onClick={() => optimisticEditor.changeQuantity(item.id, 1)}>
                          <Plus className="size-2.5" />
                        </Button>
                        <span className="min-w-[80px] text-right text-xs font-semibold tabular-nums">{item.lineTotal.toLocaleString()}₫</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => optimisticEditor.removeItem(item.id)}>
                          <Trash2 className="size-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="space-y-1.5 border-t bg-card px-2 py-1.5">
              {isRestaurant ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Món</span>
                    <span className="font-medium">{restaurantFoodTotal.toLocaleString()} ₫</span>
                  </div>
                  {Number(order?.serviceCharge || 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Phí dịch vụ</span>
                      <span className="font-medium">{Number(order?.serviceCharge || 0).toLocaleString()} ₫</span>
                    </div>
                  )}
                  {Number(order?.tax || 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Thuế</span>
                      <span className="font-medium">{Number(order?.tax || 0).toLocaleString()} ₫</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-xs font-bold">
                    <span>Tổng cộng</span>
                    <span className="text-primary">{(restaurantFoodTotal + Number(order?.serviceCharge || 0) + Number(order?.tax || 0) - Number(order?.discount || 0)).toLocaleString()} ₫</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Tổng món</span>
                    <span className="font-medium tabular-nums">{billiardFoodTotal.toLocaleString()}₫</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Phí bàn</span>
                    <span className="font-medium tabular-nums">{tableFee.toLocaleString()}₫</span>
                  </div>
                  {billiardServiceCharge > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Phí dịch vụ</span>
                      <span className="font-medium tabular-nums">{billiardServiceCharge.toLocaleString()}₫</span>
                    </div>
                  )}
                  {billiardTax > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Thuế</span>
                      <span className="font-medium tabular-nums">{billiardTax.toLocaleString()}₫</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-bold border-t pt-2">
                    <span>Tổng cộng</span>
                    <span className="text-primary tabular-nums">{billiardGrandTotal.toLocaleString()}₫</span>
                  </div>
                </>
              )}
              <Button className="w-full" onClick={handleDone}>
                Xong
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
