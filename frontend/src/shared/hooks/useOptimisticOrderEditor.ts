import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type OrderItemLike = {
  id: string;
  quantity: number;
  price: number;
  lineTotal: number;
  name?: string;
  menuItemId?: string;
  inventoryId?: string;
  [key: string]: unknown;
};

type OrderLike = {
  items?: OrderItemLike[];
  foodTotal?: number;
  grandTotal?: number;
  [key: string]: unknown;
};

type SyncAddFn = (orderId: string, item: {
  tempId: string;
  menuItemId?: string;
  inventoryId?: string;
  name: string;
  price: number;
  quantity: number;
}) => Promise<unknown>;

type SyncUpdateFn = (orderId: string, itemId: string, quantity: number) => Promise<unknown>;
type SyncRemoveFn = (orderId: string, itemId: string) => Promise<unknown>;

interface UseOptimisticOrderEditorOptions {
  orderId: string | null;
  queryKey: unknown[];
  onSyncAdd?: SyncAddFn;
  onSyncUpdate: SyncUpdateFn;
  onSyncRemove: SyncRemoveFn;
  debounceMs?: number;
}

type PendingAddItem = {
  tempId: string;
  menuItemId?: string;
  inventoryId?: string;
  name: string;
  price: number;
  quantity: number;
};

export function useOptimisticOrderEditor({
  orderId,
  queryKey,
  onSyncAdd,
  onSyncUpdate,
  onSyncRemove,
  debounceMs = 800,
}: UseOptimisticOrderEditorOptions) {
  const queryClient = useQueryClient();
  const pendingRef = useRef<Map<string, number>>(new Map());
  const additionsRef = useRef<Map<string, PendingAddItem>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const flushingRef = useRef(false);
  const waitingForFlushRef = useRef<Array<() => void>>([]);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;
  const onSyncAddRef = useRef(onSyncAdd);
  onSyncAddRef.current = onSyncAdd;
  const onSyncUpdateRef = useRef(onSyncUpdate);
  onSyncUpdateRef.current = onSyncUpdate;
  const onSyncRemoveRef = useRef(onSyncRemove);
  onSyncRemoveRef.current = onSyncRemove;
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updatePendingKeys = useCallback(() => {
    const keys = new Set<string>();
    for (const k of pendingRef.current.keys()) keys.add(k);
    for (const k of additionsRef.current.keys()) keys.add(k);
    setPendingKeys(keys);
  }, []);

  const serverOrder = queryClient.getQueryData<OrderLike>(queryKeyRef.current);
  const serverItems = serverOrder?.items ?? [];

  const items = useMemo(() => {
    const merged = serverItems
      .map((item) => {
        const delta = pendingRef.current.get(item.id);
        if (delta === undefined) return item;
        const qty = Math.max(0, item.quantity + delta);
        if (qty <= 0) return null;
        return { ...item, quantity: qty, lineTotal: qty * item.price };
      })
      .filter(Boolean) as OrderItemLike[];

    if (pendingKeys.size > 0) {
      for (const add of additionsRef.current.values()) {
        if (serverItems.some((i) =>
          add.menuItemId ? i.menuItemId === add.menuItemId : i.inventoryId === add.inventoryId
        )) continue;
        merged.push({
          id: add.tempId,
          menuItemId: add.menuItemId,
          inventoryId: add.inventoryId,
          name: add.name,
          price: add.price,
          quantity: add.quantity,
          lineTotal: add.price * add.quantity,
        });
      }
    }

    return merged;
  }, [serverItems, pendingKeys]);

  const foodTotal = useMemo(() => {
    return items.reduce((s, i) => s + i.lineTotal, 0);
  }, [items]);

  const scheduleSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doFlushSync, debounceMs);
  }, [debounceMs]);

  const resolveWaiters = useCallback(() => {
    const resolvers = waitingForFlushRef.current;
    waitingForFlushRef.current = [];
    for (const resolve of resolvers) resolve();
  }, []);

  const doFlushSync = useCallback(async () => {
    if (flushingRef.current) return;
    const oid = orderIdRef.current;
    if (!oid) return;
    if (pendingRef.current.size === 0 && additionsRef.current.size === 0) return;

    flushingRef.current = true;
    setIsSyncing(true);

    const deltasSnapshot = new Map(pendingRef.current);
    const additionsSnapshot = Array.from(additionsRef.current.entries());

    if (deltasSnapshot.size === 0 && additionsSnapshot.length === 0) {
      flushingRef.current = false;
      setIsSyncing(false);
      resolveWaiters();
      return;
    }

    const updates: Array<{ itemId: string; qty: number }> = [];
    const removes: string[] = [];

    const freshOrder = queryClient.getQueryData<OrderLike>(queryKeyRef.current);
    const freshItems = freshOrder?.items ?? [];

    for (const [itemId, delta] of deltasSnapshot) {
      const freshItem = freshItems.find((i) => i.id === itemId);
      const serverQty = freshItem?.quantity ?? 0;
      const intended = Math.max(0, serverQty + delta);
      if (intended <= 0) {
        removes.push(itemId);
      } else if (intended !== serverQty) {
        updates.push({ itemId, qty: intended });
      }
    }

    if (updates.length === 0 && removes.length === 0 && additionsSnapshot.length === 0) {
      flushingRef.current = false;
      setIsSyncing(false);
      resolveWaiters();
      return;
    }

    await queryClient.cancelQueries({ queryKey: queryKeyRef.current });

    try {
      const addResponses = await Promise.all(
        additionsSnapshot.map(([, addItem]) => {
          if (!onSyncAddRef.current) return Promise.resolve(null);
          return onSyncAddRef.current(oid, addItem);
        }),
      );

      const hasOrderResponse = addResponses.some(
        (r) => r && typeof r === 'object' && 'order' in (r as Record<string, unknown>),
      );

      if (hasOrderResponse) {
        for (const resp of addResponses) {
          if (resp && typeof resp === 'object' && 'order' in (resp as Record<string, unknown>)) {
            queryClient.setQueryData(queryKeyRef.current, (resp as { order: OrderLike }).order);
          }
        }
      }

      await Promise.all([
        ...updates.map((u) => onSyncUpdateRef.current(oid, u.itemId, u.qty)),
        ...removes.map((id) => onSyncRemoveRef.current(oid, id)),
      ]);

      // Update cache with all mutations
      const needsCacheUpdate = (additionsSnapshot.length > 0 && !hasOrderResponse)
        || updates.length > 0 || removes.length > 0;
      if (needsCacheUpdate) {
        queryClient.setQueryData(queryKeyRef.current, (old: unknown) => {
          if (!old || typeof old !== 'object') return old;
          const o = old as OrderLike;
          let items = [...(o.items || [])];

          if (additionsSnapshot.length > 0 && !hasOrderResponse) {
            for (const [, addItem] of additionsSnapshot) {
              const existingIdx = items.findIndex((i) =>
                addItem.menuItemId ? i.menuItemId === addItem.menuItemId : i.inventoryId === addItem.inventoryId,
              );
              if (existingIdx >= 0) {
                const current = items[existingIdx];
                items[existingIdx] = {
                  ...current,
                  quantity: current.quantity + addItem.quantity,
                  lineTotal: (current.quantity + addItem.quantity) * current.price,
                };
              } else {
                items.push({
                  id: addItem.tempId,
                  menuItemId: addItem.menuItemId,
                  inventoryId: addItem.inventoryId,
                  name: addItem.name,
                  price: addItem.price,
                  quantity: addItem.quantity,
                  lineTotal: addItem.price * addItem.quantity,
                });
              }
            }
          }

          for (const u of updates) {
            items = items.map((i) =>
              i.id === u.itemId ? { ...i, quantity: u.qty, lineTotal: u.qty * i.price } : i,
            );
          }
          for (const id of removes) {
            items = items.filter((i) => i.id !== id);
          }
          const foodTotal = items.reduce((s, i) => s + i.lineTotal, 0);
          return { ...o, items, foodTotal };
        });
      }

      // Clear pending refs ONLY after server confirms success
      for (const [itemId] of deltasSnapshot) {
        pendingRef.current.delete(itemId);
      }
      for (const [tempId] of additionsSnapshot) {
        additionsRef.current.delete(tempId);
      }
      updatePendingKeys();
    } catch {
      // Keep pending refs alive — they will be retried on next debounce
      scheduleSync();
    }

    flushingRef.current = false;
    setIsSyncing(false);
    resolveWaiters();
  }, [queryClient, updatePendingKeys, resolveWaiters, scheduleSync]);

  const waitForFlush = useCallback(async () => {
    if (!flushingRef.current) return;
    return new Promise<void>((resolve) => {
      waitingForFlushRef.current.push(resolve);
    });
  }, []);

  const changeQuantity = useCallback(
    (itemId: string, delta: number) => {
      const current = pendingRef.current.get(itemId) ?? 0;
      pendingRef.current.set(itemId, current + delta);
      updatePendingKeys();
      scheduleSync();
    },
    [updatePendingKeys, scheduleSync],
  );

  const setQuantity = useCallback(
    (itemId: string, absoluteQty: number) => {
      const serverItem = serverItems.find((i) => i.id === itemId);
      const serverQty = serverItem?.quantity ?? 0;
      const delta = absoluteQty - serverQty;
      pendingRef.current.set(itemId, delta);
      updatePendingKeys();
      scheduleSync();
    },
    [serverItems, updatePendingKeys, scheduleSync],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const serverItem = serverItems.find((i) => i.id === itemId);
      if (!serverItem) return;
      const delta = -serverItem.quantity;
      pendingRef.current.set(itemId, delta);
      updatePendingKeys();
      scheduleSync();
    },
    [serverItems, updatePendingKeys, scheduleSync],
  );

  const addItem = useCallback(
    (params: {
      menuItemId?: string;
      inventoryId?: string;
      name: string;
      price: number;
    }) => {
      const { menuItemId, inventoryId, name, price } = params;
      const lookupKey = menuItemId || inventoryId;
      if (!lookupKey) return;

      const serverItem = serverItems.find((i) => {
        if (menuItemId && i.menuItemId === menuItemId) return true;
        if (inventoryId && i.inventoryId === inventoryId) return true;
        return false;
      });

      if (serverItem) {
        changeQuantity(serverItem.id, 1);
        return;
      }

      const tempId = `opt-${lookupKey}`;
      const existing = additionsRef.current.get(tempId);
      if (existing) {
        existing.quantity += 1;
        updatePendingKeys();
        scheduleSync();
        return;
      }

      additionsRef.current.set(tempId, {
        tempId,
        menuItemId,
        inventoryId,
        name,
        price,
        quantity: 1,
      });
      updatePendingKeys();
      scheduleSync();
    },
    [serverItems, changeQuantity, updatePendingKeys, scheduleSync],
  );

  const getItemQuantity = useCallback(
    (itemId: string) => {
      const add = additionsRef.current.get(itemId);
      if (add) return add.quantity;
      const serverItem = serverItems.find((i) => i.id === itemId);
      if (!serverItem) return 0;
      const delta = pendingRef.current.get(itemId) ?? 0;
      return Math.max(0, serverItem.quantity + delta);
    },
    [serverItems],
  );

  const syncNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = undefined;

    while (pendingRef.current.size > 0 || additionsRef.current.size > 0) {
      if (flushingRef.current) {
        await waitForFlush();
      } else {
        await doFlushSync();
      }
    }
  }, [doFlushSync, waitForFlush]);

  return {
    items,
    foodTotal,
    isSyncing,
    hasPending: pendingKeys.size > 0,
    addItem,
    changeQuantity,
    setQuantity,
    removeItem,
    getItemQuantity,
    syncNow,
  };
}
