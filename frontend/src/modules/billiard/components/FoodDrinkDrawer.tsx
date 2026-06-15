import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Plus, Minus, Search, ShoppingCart, Loader2, Package } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useMenuItems, useInventoryItems, useActiveOrderByTable } from '@/app/api/hooks';
import { useAddOrderItem } from '../hooks';
import type { InventoryItem } from '@/app/types';

interface FoodDrinkDrawerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  tableCode?: string;
  onSuccess: () => void;
}

const getItemId = (item: InventoryItem): string => item.id ?? (item as any).ingredientId ?? (item as any)._id;

export function FoodDrinkDrawer({ open, onClose, tableId, tableCode, onSuccess }: FoodDrinkDrawerProps) {
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const quantitiesRef = useRef(quantities);
  quantitiesRef.current = quantities;

  const { data: inventoryItems = [], isLoading: itemsLoading } = useInventoryItems({ status: 'ACTIVE'.trim().toUpperCase() });
  const { data: menuItems = [] } = useMenuItems();
  const { data: activeOrder, isLoading: orderLoading } = useActiveOrderByTable(tableId);
  const addOrderItem = useAddOrderItem();

  const getItemQty = (item: InventoryItem): number => {
    return Number(item.quantity ?? (item as any).stock ?? (item as any).availableQty ?? 0);
  };

  const getItemStatus = (item: InventoryItem): string => {
    return ((item as any).status ?? 'ACTIVE').toString().trim().toUpperCase();
  };

  const isOutOfStock = (item: InventoryItem): boolean => {
    const qty = getItemQty(item);
    const status = getItemStatus(item);
    const out = qty <= 0 || status !== 'ACTIVE';
    console.log('[FoodDrinkDrawer] availability', { id: item.id, name: item.name, quantity: qty, status, outOfStock: out });
    return out;
  };

  const menuItemLookup = useMemo(() => {
    const byIngredientId = new Map<string, string>();
    const byName = new Map<string, string>();

    for (const mi of menuItems) {
      if (mi.ingredients) {
        for (const ing of mi.ingredients) {
          if (ing.ingredientId && !byIngredientId.has(ing.ingredientId)) {
            byIngredientId.set(ing.ingredientId, mi.id);
          }
        }
      }
      byName.set(mi.name.toLowerCase(), mi.id);
    }

    return { byIngredientId, byName };
  }, [menuItems]);

  const sortedItems = useMemo(() => {
    return [...inventoryItems].sort((a, b) => getItemQty(b) - getItemQty(a));
  }, [inventoryItems]);

  const filteredItems = useMemo(() => {
    if (!search) return sortedItems;
    const q = search.toLowerCase();
    return sortedItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [sortedItems, search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setQuantities({});
      setAddingId(null);
    }
  }, [open]);

  const handleQtyChange = useCallback((id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }, []);

  const resolveMenuItemId = useCallback((inv: InventoryItem): string | null => {
    const invId = getItemId(inv);
    const byIngredient = menuItemLookup.byIngredientId.get(invId);
    if (byIngredient) return byIngredient;
    const byName = menuItemLookup.byName.get(inv.name.toLowerCase());
    if (byName) return byName;
    return null;
  }, [menuItemLookup]);

  const handleAdd = useCallback(async (item: InventoryItem) => {
    const itemId = getItemId(item);
    const qty = quantitiesRef.current[itemId] ?? 0;
    const outOfStock = isOutOfStock(item);
    const menuItemId = resolveMenuItemId(item);
    console.log('[FoodDrinkDrawer] handleAdd', { itemId, itemName: item.name, qty, outOfStock, hasMenuItem: !!menuItemId, hasOrder: !!activeOrder });

    const effectiveQty = qty > 0 ? qty : 1;
    if (effectiveQty !== qty) {
      setQuantities((prev) => ({ ...prev, [itemId]: effectiveQty }));
    }
    if (!activeOrder) { console.log('[FoodDrinkDrawer] blocked: no active order'); return; }
    if (!menuItemId) { console.warn('[FoodDrinkDrawer] blocked: no menu item mapping for', itemId, item.name); return; }

    setAddingId(itemId);
    try {
      await addOrderItem.mutateAsync({
        orderId: activeOrder.id,
        tableId,
        menuItemId,
        quantity: effectiveQty,
      });
      setQuantities((prev) => {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      });
    } finally {
      setAddingId(null);
    }
  }, [activeOrder, addOrderItem, tableId, resolveMenuItemId]);

  const previewItems = useMemo(() => {
    return activeOrder?.items ?? [];
  }, [activeOrder]);

  const previewTotal = useMemo(() => {
    return previewItems.reduce((sum, i) => sum + Number(i.lineTotal ?? i.price * i.quantity), 0);
  }, [previewItems]);

  const hasAddedItems = previewItems.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 z-50 h-full w-[400px] max-w-[90vw] bg-black/50 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h3 className="text-base font-semibold text-white">Add Food / Drink</h3>
          {tableCode && (
            <p className="text-xs text-white/60">{tableCode}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <Input
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-white/10 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-white/30"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {itemsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-white/50" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-white/40 text-sm">No items found</div>
        ) : (
          filteredItems.map((item) => {
            const itemId = getItemId(item);
            const qty = quantities[itemId] ?? 0;
            const outOfStock = isOutOfStock(item);
            const isAdding = addingId === itemId;
            const hasMenuItem = resolveMenuItemId(item) !== null;

            return (
              <div
                key={itemId}
                className={`rounded-lg border p-3 space-y-2 transition-colors ${
                  outOfStock
                    ? 'bg-white/[0.02] border-white/5 opacity-50'
                    : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                    {item.unit && (
                      <p className="text-xs text-white/40">{item.unit}</p>
                    )}
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">
                      ${Number(item.price).toFixed(2)}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 justify-end">
                      <Package className="w-3 h-3 text-white/40" />
                      <span className={`text-xs ${
                        outOfStock ? 'text-red-400' :
                        getItemQty(item) <= 5 ? 'text-amber-400' :
                        'text-white/50'
                      }`}>
                        {outOfStock ? 'Out of stock' : `${getItemQty(item)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center rounded-md border border-white/20 bg-white/10">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10 rounded-none"
                      disabled={qty <= 0 || outOfStock}
                      onClick={() => handleQtyChange(itemId, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-xs font-medium text-white tabular-nums">
                      {qty}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10 rounded-none"
                      disabled={outOfStock}
                      onClick={() => handleQtyChange(itemId, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    className="h-7 flex-1 text-xs font-medium"
                    disabled={outOfStock}
                    onClick={() => handleAdd(item)}
                  >
                    {isAdding ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    {outOfStock ? 'Unavailable' : 'Add'}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {orderLoading ? (
        <div className="p-4 border-t border-white/10 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-white/50" />
        </div>
      ) : !activeOrder ? (
        <div className="p-4 border-t border-white/10 text-center text-white/40 text-xs">
          No active order for this table.
        </div>
      ) : hasAddedItems ? (
        <div className="border-t border-white/10 bg-white/5 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/60 uppercase tracking-wider">
            <ShoppingCart className="w-3 h-3" />
            Current Order
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {previewItems.map((orderItem) => (
              <div key={orderItem.id} className="flex justify-between text-xs">
                <span className="text-white/80 truncate min-w-0 flex-1">
                  <span className="text-white/50 mr-1">{orderItem.quantity}x</span>
                  {orderItem.name}
                </span>
                <span className="text-white font-medium ml-2 tabular-nums whitespace-nowrap">
                  ${Number(orderItem.lineTotal ?? orderItem.price * orderItem.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-semibold text-white border-t border-white/10 pt-2">
            <span>Total</span>
            <span className="tabular-nums">${previewTotal.toFixed(2)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
