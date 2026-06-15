import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billiardApi, tableApi } from '@/app/api/services';
import type { BilliardTableWithSession, BilliardPlaySession, BilliardReservation } from './types';

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
    mutationFn: ({ orderId, tableId, menuItemId, quantity }: { orderId: string; tableId: string; menuItemId: string; quantity: number }) =>
      billiardApi.addOrderItem(orderId, { menuItemId, quantity }),
    onSuccess: (data, variables) => {
      qc.setQueryData(['orders', 'byTable', variables.tableId], (old: any) => {
        if (!old) return old;
        const lineTotal = Number(data.price ?? data.total ?? 0);
        const newItem = {
          id: data.id,
          menuItemId: data.menuItemId,
          name: data.name,
          price: Number(data.price),
          cost: Number(data.cost),
          quantity: data.quantity,
          lineTotal,
          category: '',
          description: '',
          available: true,
        };
        return {
          ...old,
          items: [...(old.items || []), newItem],
          subtotal: Number(old.subtotal || 0) + lineTotal,
          total: Number(old.total || 0) + lineTotal,
          itemCount: (old.itemCount || 0) + data.quantity,
        };
      });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['billiard', 'tables'] });
    },
  });
}
