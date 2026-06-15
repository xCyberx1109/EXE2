import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billiardApi, tableApi } from '@/app/api/services';
import type { BilliardTableWithSession, BilliardPlaySession, BilliardReservation } from './types';
import type { BilliardOrderSummary } from '@/app/api/services';

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
    mutationFn: ({ tableId, body }: { tableId: string; body: { durationMinutes: number; customerName?: string; phone?: string } }) =>
      billiardApi.playNow(tableId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useReserve() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, body }: { tableId: string; body: { customerName: string; phone?: string; reservationTime: string; durationMinutes?: number; note?: string } }) =>
      billiardApi.reserve(tableId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.checkIn(tableId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.cancelReservation(tableId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useExtendSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, additionalMinutes }: { sessionId: string; additionalMinutes: number }) =>
      billiardApi.extendSession(sessionId, additionalMinutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => billiardApi.finishSession(tableId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { tableCode: string; tableName?: string; tableType: string }) =>
      billiardApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useDisableTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => tableApi.updateStatus(tableId, 'DISABLED'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useEnableTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => tableApi.updateStatus(tableId, 'AVAILABLE'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useUpdateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tables: { id: string; posX: number; posY: number }[]) =>
      billiardApi.updateLayout(tables),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}

export function useAddOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, tableId, menuItemId, inventoryId, quantity }: { orderId: string; tableId: string; menuItemId?: string; inventoryId?: string; quantity: number }) =>
      billiardApi.addOrderItem(orderId, { menuItemId, inventoryId, quantity }),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['billiard', 'orderSummary', variables.tableId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, quantity, tableId }: { orderId: string; itemId: string; quantity: number; tableId: string }) =>
      billiardApi.updateOrderItem(orderId, itemId, { quantity }),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['billiard', 'orderSummary', variables.tableId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useRemoveOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, tableId }: { orderId: string; itemId: string; tableId: string }) =>
      billiardApi.removeOrderItem(orderId, itemId),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['billiard', 'orderSummary', variables.tableId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useTableOrderSummary(tableId: string) {
  return useQuery<BilliardOrderSummary>({
    queryKey: ['billiard', 'orderSummary', tableId],
    queryFn: () => billiardApi.getOrderSummary(tableId),
    enabled: !!tableId,
    refetchInterval: 10_000,
  });
}
