import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billiardApi, restaurantApi } from '@/app/api/services';
import type { BilliardTableWithSession, CreateTableBody, RestaurantTable } from './types';

// ==================== BILLIARD HOOKS ====================

export function useBilliardTables() {
  return useQuery<BilliardTableWithSession[]>({
    queryKey: ['billiard', 'tables'],
    queryFn: () => billiardApi.listTables(),
    refetchInterval: 30_000,
  });
}

export function usePlayNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, durationMinutes, customerName, phone }: {
      tableId: string; durationMinutes: number; customerName?: string; phone?: string;
    }) => billiardApi.playNow(tableId, { durationMinutes, customerName, phone }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useReserve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, customerName, phone, reservationTime, durationMinutes, note }: {
      tableId: string; customerName: string; phone?: string; reservationTime: string; durationMinutes?: number; note?: string;
    }) => billiardApi.reserve(tableId, { customerName, phone, reservationTime, durationMinutes, note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.checkIn(tableId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.cancelReservation(tableId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useExtendSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, additionalMinutes }: { sessionId: string; additionalMinutes: number }) =>
      billiardApi.extendSession(sessionId, additionalMinutes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.finishSession(tableId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTableBody) => billiardApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useDisableTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.updateTable(tableId, { status: 'DISABLED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useEnableTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.updateTable(tableId, { status: 'AVAILABLE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billiard', 'tables'] }); },
  });
}

export function useUpdateLayout(mode: 'BILLIARD' | 'RESTAURANT') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tables: { id: string; posX: number; posY: number }[]) =>
      mode === 'BILLIARD' ? billiardApi.updateLayout(tables) : restaurantApi.updateLayout(tables),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
    },
  });
}

export function useTableOrderSummary(tableId: string) {
  return useQuery({
    queryKey: ['billiard', 'order-summary', tableId],
    queryFn: () => billiardApi.getOrderSummary(tableId),
    enabled: !!tableId,
  });
}

// ==================== RESTAURANT HOOKS ====================

export function useRestaurantTables() {
  return useQuery<RestaurantTable[]>({
    queryKey: ['restaurant', 'tables'],
    queryFn: () => restaurantApi.listTables(),
    refetchInterval: 15_000,
  });
}

export function useCreateRestaurantTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTableBody) => restaurantApi.createTable(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); },
  });
}

export function useUpdateRestaurantTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => restaurantApi.updateTable(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); },
  });
}

export function useDeleteRestaurantTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantApi.deleteTable(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); },
  });
}

export function useOpenOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, guestCount }: { tableId: string; guestCount?: number }) =>
      restaurantApi.openOrder(tableId, { guestCount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); },
  });
}

export function useRestaurantTableOrder(tableId: string) {
  return useQuery({
    queryKey: ['restaurant', 'order', tableId],
    queryFn: () => restaurantApi.getTableOrder(tableId),
    enabled: !!tableId,
    refetchInterval: 10_000,
  });
}

export function useAddRestaurantOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, tableId, menuItemId, quantity }: {
      orderId: string; tableId: string; menuItemId: string; quantity: number;
    }) => restaurantApi.addOrderItem(orderId, { menuItemId, quantity }),
    onMutate: async ({ orderId, tableId, menuItemId, quantity, menuItemName, menuItemPrice }: any) => {
      await qc.cancelQueries({ queryKey: ['restaurant', 'order', tableId] });
      const previousOrder = qc.getQueryData(['restaurant', 'order', tableId]);

      let resolvedName = menuItemName;
      let resolvedPrice = menuItemPrice;
      if (resolvedName == null || resolvedPrice == null) {
        const menuQueries = qc.getQueriesData({ queryKey: ['menu', 'list'] });
        for (const [, data] of menuQueries) {
          const items = Array.isArray(data) ? data : [];
          const menuItem = items.find((i: any) => i.id === menuItemId);
          if (menuItem) { resolvedName = menuItem.name; resolvedPrice = Number(menuItem.price); break; }
        }
      }

      qc.setQueryData(['restaurant', 'order', tableId], (old: any) => {
        if (!old) return old;
        const items = [...(old.items || [])];
        const idx = items.findIndex((i: any) => i.menuItemId === menuItemId);
        if (idx >= 0) {
          const existing = items[idx];
          items[idx] = { ...existing, quantity: existing.quantity + quantity, lineTotal: (existing.quantity + quantity) * existing.price };
        } else {
          items.push({ id: `opt-${menuItemId}-${Date.now()}`, menuItemId, name: resolvedName || menuItemId, price: resolvedPrice ?? 0, quantity, lineTotal: (resolvedPrice ?? 0) * quantity });
        }
        const foodTotal = items.reduce((s: number, i: any) => s + i.lineTotal, 0);
        return { ...old, items, foodTotal };
      });

      return { previousOrder };
    },
    onError: (err, { tableId }: any, context) => {
      if (context?.previousOrder) qc.setQueryData(['restaurant', 'order', tableId], context.previousOrder);
    },
    onSuccess: async (data, { orderId, tableId }: any) => {
      if (data?.order) qc.setQueryData(['restaurant', 'order', tableId], data.order);
      await qc.invalidateQueries({ queryKey: ['restaurant', 'order', tableId] });
      await qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
    },
  });
}

export function useUpdateRestaurantOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, quantity, tableId }: { orderId: string; itemId: string; quantity: number; tableId: string }) =>
      restaurantApi.updateOrderItem(orderId, itemId, { quantity }),
    onMutate: async ({ itemId, quantity, tableId }) => {
      await qc.cancelQueries({ queryKey: ['restaurant', 'order', tableId] });
      const previousOrder = qc.getQueryData(['restaurant', 'order', tableId]);
      qc.setQueryData(['restaurant', 'order', tableId], (old: any) => {
        if (!old) return old;
        const items = (old.items || []).map((i: any) => i.id === itemId ? { ...i, quantity, lineTotal: quantity * i.price } : i);
        return { ...old, items, foodTotal: items.reduce((s: number, i: any) => s + i.lineTotal, 0) };
      });
      return { previousOrder };
    },
    onError: (err, { tableId }: any, context) => {
      if (context?.previousOrder) qc.setQueryData(['restaurant', 'order', tableId], context.previousOrder);
    },
    onSuccess: (data, { tableId }: any) => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'order', tableId] });
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
    },
  });
}

export function useRemoveRestaurantOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, tableId }: { orderId: string; itemId: string; tableId: string }) =>
      restaurantApi.removeOrderItem(orderId, itemId),
    onMutate: async ({ itemId, tableId }) => {
      await qc.cancelQueries({ queryKey: ['restaurant', 'order', tableId] });
      const previousOrder = qc.getQueryData(['restaurant', 'order', tableId]);
      qc.setQueryData(['restaurant', 'order', tableId], (old: any) => {
        if (!old) return old;
        const items = (old.items || []).filter((i: any) => i.id !== itemId);
        return { ...old, items, foodTotal: items.reduce((s: number, i: any) => s + i.lineTotal, 0) };
      });
      return { previousOrder };
    },
    onError: (err, { tableId }: any, context) => {
      if (context?.previousOrder) qc.setQueryData(['restaurant', 'order', tableId], context.previousOrder);
    },
    onSuccess: (data, { tableId }: any) => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'order', tableId] });
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
    },
  });
}

export function useTransferTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, targetTableId }: { tableId: string; targetTableId: string }) =>
      restaurantApi.transferOrder(tableId, { targetTableId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); },
  });
}

export function useMergeTables() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, targetTableId }: { tableId: string; targetTableId: string }) =>
      restaurantApi.mergeTables(tableId, { targetTableId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); },
  });
}

export function useSplitOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, targetTableId, items }: { tableId: string; targetTableId: string; items: Array<{ itemId: string; quantity: number }> }) =>
      restaurantApi.splitOrder(tableId, { targetTableId, items }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); },
  });
}

export function usePayRestaurantOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, paymentMethod }: { orderId: string; paymentMethod?: string }) =>
      restaurantApi.payOrder(orderId, paymentMethod),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
      qc.invalidateQueries({ queryKey: ['restaurant', 'order'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateGuestCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, guestCount }: { tableId: string; guestCount: number }) =>
      restaurantApi.updateGuestCount(tableId, guestCount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
      qc.invalidateQueries({ queryKey: ['restaurant', 'order'] });
    },
  });
}

export function useUpdateOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note: string }) =>
      restaurantApi.updateOrderNote(orderId, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'order'] }); },
  });
}
