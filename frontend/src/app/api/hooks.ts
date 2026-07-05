import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import {
  authApi, menuApi, inventoryApi,
  dashboardApi, branchApi, inviteApi, tableApi, ordersApi, ordersQueueApi, employeeApi,
} from './services';
import {
  posDevicesV2Api,
} from './posServices';
import { apiFetch } from './client';
import type {
  MenuItem, InventoryItem, InventoryTransaction, DashboardDataV2,
  TableItem, OrderDetail, DailyOrdersResponse, InventoryStats,
  PosDeviceV2,
  DeleteDependencyReport, InventoryIssue, PaginatedResponse, EmployeeFormData,
  PermissionTemplatesResponse,
} from '../types';
import type { MenuItemPayload } from './services';

/* ========================================================================
   Auth Hooks
   ======================================================================== */

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => authApi.getMe(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

/* ========================================================================
   Menu Hooks
   ======================================================================== */

export function useMenuItems(filters?: { page?: number; limit?: number; search?: string; available?: string; accountId?: string }) {
  return useQuery({
    queryKey: queryKeys.menu.all(filters as Record<string, string | number | undefined>),
    queryFn: () => menuApi.list(filters),
    staleTime: 1000 * 30,
    select: (data) => {
      if (Array.isArray(data)) return { data, pagination: undefined as any };
      return data;
    },
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: queryKeys.menu.detail(id),
    queryFn: () => menuApi.getById(id),
    enabled: !!id,
  });
}

export function useTopSellingMenuItems(limit = 10) {
  return useQuery({
    queryKey: queryKeys.menu.topSelling(limit),
    queryFn: () => menuApi.topSelling(limit),
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateMenuItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MenuItemPayload) => menuApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}

export function useUpdateMenuItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & MenuItemPayload) =>
      menuApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}

export function useToggleMenuItemAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => menuApi.toggleAvailability(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}

export function useDeleteMenuItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => menuApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}

/* ========================================================================
   Inventory Hooks
   ======================================================================== */

export function useInventoryItems(filters?: { page?: number; limit?: number; search?: string; lowStock?: boolean; status?: string }) {
  return useQuery({
    queryKey: queryKeys.inventory.all(filters as Record<string, string | number | boolean | undefined>),
    queryFn: () => inventoryApi.list(filters),
    staleTime: 1000 * 30,
    select: (data) => {
      if (Array.isArray(data)) return { data, pagination: undefined as any };
      return data;
    },
  });
}

export function useSellableItems() {
  return useQuery({
    queryKey: ['inventory', 'sellable'],
    queryFn: () => inventoryApi.listSellable(),
    staleTime: 1000 * 30,
  });
}

export function useInventoryStats() {
  return useQuery({
    queryKey: queryKeys.inventory.stats,
    queryFn: () => inventoryApi.stats(),
    staleTime: 1000 * 30,
  });
}

export function useCreateInventoryItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => inventoryApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventoryItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      inventoryApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteInventoryItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: (_data: DeleteDependencyReport) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBulkImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: Array<{ ingredientId: string; quantity: number }>; reason: string }) =>
      inventoryApi.bulkImport(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBulkExportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: Array<{ ingredientId: string; quantity: number }>; reason: string }) =>
      inventoryApi.bulkExport(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useStockInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, quantity, note, type, expiryDate, batchCode, unitCost,
    }: {
      id: string; quantity: number; note?: string; type?: string;
      expiryDate?: string; batchCode?: string; unitCost?: number;
    }) =>
      inventoryApi.stockIn(id, quantity, note, type, { expiryDate, batchCode, unitCost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useStockOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity, note, type }: { id: string; quantity: number; note?: string; type?: string }) =>
      inventoryApi.stockOut(id, quantity, note, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useApprovalThreshold() {
  return useQuery({
    queryKey: queryKeys.inventory.approvalThreshold,
    queryFn: () => inventoryApi.getApprovalThreshold(),
    staleTime: 1000 * 30,
  });
}

export function useUpdateApprovalThresholdMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threshold: number) => inventoryApi.updateApprovalThreshold(threshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.approvalThreshold });
    },
  });
}

export function useAdjustmentRequests(status?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.inventory.adjustmentRequests(status),
    queryFn: () => inventoryApi.listAdjustmentRequests(status),
    staleTime: 1000 * 15,
    enabled,
  });
}

export function useApproveAdjustmentRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryApi.approveAdjustmentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useRejectAdjustmentRequestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      inventoryApi.rejectAdjustmentRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useExpiringBatches(days = 7) {
  return useQuery({
    queryKey: ['inventory', 'expiringBatches', days],
    queryFn: () => inventoryApi.listExpiringBatches(days),
    staleTime: 1000 * 30,
  });
}

export function useWasteReport(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'wasteReport', from, to],
    queryFn: () => inventoryApi.getWasteReport(from, to),
    staleTime: 1000 * 30,
    enabled,
  });
}

export function useFoodCostReport(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'foodCostReport', from, to],
    queryFn: () => inventoryApi.getFoodCostReport(from, to),
    staleTime: 1000 * 30,
    enabled,
  });
}

export function useIngredientTransactions(ingredientId: string | null) {
  return useQuery({
    queryKey: ['inventory', 'transactions', ingredientId],
    queryFn: () => inventoryApi.getIngredientTransactions(ingredientId as string),
    staleTime: 1000 * 15,
    enabled: !!ingredientId,
  });
}

export function useInventoryTransactions(params?: { page?: number; limit?: number; type?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.inventory.transactions(params),
    queryFn: () => inventoryApi.listTransactions(params),
    staleTime: 1000 * 30,
  });
}

/* ========================================================================
   Dashboard Hooks
   ======================================================================== */

export function useDashboardDataV2(chartRange?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.v2(chartRange),
    queryFn: () => dashboardApi.getV2(chartRange),
    staleTime: 1000 * 60,
    retry: 2,
  });
}

/* ========================================================================
   Table Hooks
   ======================================================================== */

export function useTablesPos() {
  return useQuery({
    queryKey: queryKeys.tables.pos,
    queryFn: () => tableApi.listPos(),
    staleTime: 1000 * 10,
    refetchInterval: 5000,
    select: (data) => Array.isArray(data) ? data : [],
  });
}

export function useAdminTables(filters?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: () => tableApi.list(filters),
    staleTime: 1000 * 30,
    select: (data) => {
      if (Array.isArray(data)) return { data, pagination: undefined as any };
      return data;
    },
  });
}

export function useCreateTableMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { tableCode: string; tableName?: string; capacity: number; status?: string }) =>
      tableApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useUpdateTableMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; tableCode?: string; tableName?: string; capacity?: number; status?: string }) =>
      tableApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useDeleteTableMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tableApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useAssignOrderToTableMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, orderId }: { tableId: string; orderId: string }) =>
      tableApi.assignOrder(tableId, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useReleaseTableMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => tableApi.release(tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useCheckInTableMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tableId: string) => tableApi.checkIn(tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

/* ========================================================================
   Order Hooks
   ======================================================================== */

export function useDailyOrders(date?: string, status?: string) {
  return useQuery({
    queryKey: queryKeys.orders.daily(date, status),
    queryFn: () => ordersApi.listByDate(date, status),
    staleTime: 1000 * 30,
  });
}

export function useOrderHistory(params?: { startDate?: string; endDate?: string; status?: string; source?: string }) {
  return useQuery({
    queryKey: queryKeys.orders.history(params as Record<string, string | undefined>),
    queryFn: () => ordersApi.history(params),
    staleTime: 1000 * 30,
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => ordersApi.getDetail(orderId),
    enabled: !!orderId,
  });
}

export function useActiveOrderByTable(tableId: string) {
  return useQuery({
    queryKey: queryKeys.orders.byTable(tableId),
    queryFn: () => ordersApi.getActiveByTable(tableId),
    enabled: !!tableId,
    staleTime: 1000 * 15,
  });
}

export function useCreatePosOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { table: string; tableId: string; items: Array<{ menuItemId: string; quantity: number }>; orderType: string }) =>
      ordersApi.createPos(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useCompletePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableNumber, paymentMethod }: { tableNumber: string | number; paymentMethod?: string }) =>
      ordersApi.completePayment(tableNumber, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

/* ========================================================================
   Order Queue Hooks
   ======================================================================== */

export function useOrderQueue(
  params?: { search?: string; status?: string; paymentStatus?: string },
  extraOptions?: { refetchInterval?: number | false; staleTime?: number }
) {
  return useQuery({
    queryKey: queryKeys.ordersQueue.all(params as Record<string, string | undefined>),
    queryFn: () => ordersQueueApi.list(params),
    staleTime: 1000 * 15,
    ...(extraOptions?.refetchInterval != null && { refetchInterval: extraOptions.refetchInterval }),
    ...(extraOptions?.staleTime != null && { staleTime: extraOptions.staleTime }),
  });
}

export function useCreateOrderQueueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: Array<{ menuItemId: string; quantity: number }> }) =>
      ordersQueueApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'queue'] });
    },
  });
}

export function useUpdateOrderQueueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; items?: Array<{ menuItemId: string; quantity: number }>; discount?: number; status?: string; note?: string }) =>
      ordersQueueApi.update(id, body),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['orders', 'queue'] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['orders', 'queue'] });
      if (status === 'COMPLETED') {
        queryClient.setQueriesData({ queryKey: ['orders', 'queue'] }, (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.filter((item: any) => item.id !== id);
        });
      }
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'queue'] });
    },
  });
}

export function useCancelOrderQueueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersQueueApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'queue'] });
    },
  });
}

export function usePayOrderQueueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentMethod }: { id: string; paymentMethod?: string }) =>
      ordersQueueApi.pay(id, paymentMethod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'daily'] });
    },
  });
}

/* ========================================================================
   Kitchen Queue Hook
   ======================================================================== */

export interface KitchenOrderItem {
  id: string;
  name: string;
  quantity: number;
  note?: string;
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  tableNumber: string | null;
  kotNumber: string;
  status: string;
  priority: number;
  note?: string;
  items: KitchenOrderItem[];
  createdAt: string;
  elapsed: number;
}

export function useKitchenQueue() {
  return useQuery({
    queryKey: queryKeys.orders.kitchenQueue,
    queryFn: async () => {
      const data = await apiFetch<{ kots: any[]; orders: any[] }>('/orders/kitchen-queue', { auth: false });
      const now = Date.now();
      const mapped: KitchenOrder[] = (data.kots || data.orders || []).map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber || o.order?.orderNumber || '',
        tableNumber: o.tableNumber || o.order?.tableNumber || null,
        kotNumber: o.kotNumber || o.id?.slice(0, 8),
        status: o.status || o.kitchenStatus || 'PENDING',
        priority: o.priority || 0,
        note: o.note || o.order?.note,
        items: o.items || o.orderItems || [],
        createdAt: o.createdAt,
        elapsed: now - new Date(o.createdAt).getTime(),
      }));
      return mapped;
    },
    staleTime: 1000 * 5,
    refetchInterval: 5000,
  });
}

export function useUpdateKitchenStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      apiFetch(`/orders/${orderId}/kitchen-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        auth: false,
      } as any),
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.kitchenQueue });
      const previous = queryClient.getQueryData<KitchenOrder[]>(queryKeys.orders.kitchenQueue);
      if (previous) {
        queryClient.setQueryData<KitchenOrder[]>(queryKeys.orders.kitchenQueue, (old) =>
          old?.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.orders.kitchenQueue, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.kitchenQueue });
    },
  });
}

/* ========================================================================
   Customer Display Hook
   ======================================================================== */

export function useCustomerDisplayOrders() {
  return useQuery({
    queryKey: ['customerDisplay', 'orders'],
    queryFn: async () => {
      const data = await apiFetch<{ orders: any[] }>('/orders/daily?status=PREPARING,READY', { auth: false });
      return data.orders || [];
    },
    staleTime: 1000 * 10,
    refetchInterval: 10000,
  });
}

/* ========================================================================
   Branch Hooks
   ======================================================================== */

export function useBranches() {
  return useQuery({
    queryKey: queryKeys.branches.all,
    queryFn: () => branchApi.list(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: import('./services').BranchPayload) => branchApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useUpdateBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & import('./services').BranchPayload) =>
      branchApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useLockBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchApi.lock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useUnlockBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchApi.unlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useDeleteBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

/* ========================================================================
   POS Device Hooks
   ======================================================================== */

export function usePosDevices() {
  return useQuery({
    queryKey: queryKeys.posDevices.all,
    queryFn: () => posDevicesV2Api.list(),
    staleTime: 1000 * 30,
  });
}

export function usePosDeviceLogs(id: string) {
  return useQuery({
    queryKey: queryKeys.posDevices.logs(id),
    queryFn: () => posDevicesV2Api.logs(id),
    enabled: !!id,
  });
}

export function useCreatePosDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type: string; mode?: import('../types').PosMode }) =>
      posDevicesV2Api.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posDevices'] });
    },
  });
}

export function useTogglePosDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      posDevicesV2Api.toggle(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posDevices'] });
    },
  });
}

export function useDeletePosDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => posDevicesV2Api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posDevices'] });
    },
  });
}

export function useRegeneratePinMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => posDevicesV2Api.regeneratePin(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posDevices'] });
    },
  });
}

export function useRevokeDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, reason }: { deviceId: string; reason?: string }) =>
      posDevicesV2Api.revoke(deviceId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posDevices'] });
    },
  });
}

/* ========================================================================
   Invite Hooks
   ======================================================================== */

export function useVerifyInvite(token: string) {
  return useQuery({
    queryKey: queryKeys.invite.verify(token),
    queryFn: () => inviteApi.verify(token),
    enabled: !!token,
    retry: false,
  });
}

export function useSetPasswordMutation() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      inviteApi.setPassword(token, password),
  });
}

/* ========================================================================
   Employee Hooks
   ======================================================================== */

export function useEmployeeList(filters?: { page?: number; limit?: number; search?: string; status?: string }) {
  return useQuery({
    queryKey: queryKeys.employees.list(filters as Record<string, string | number | undefined>),
    queryFn: () => employeeApi.list(filters),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id),
    queryFn: () => employeeApi.get(id),
    enabled: !!id,
  });
}

export function useCreateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EmployeeFormData) => employeeApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

export function useResetPinMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeeApi.resetPin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

export function useUpdateEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<EmployeeFormData>) =>
      employeeApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

export function useEmployeeLogs(id: string, params?: { page?: number; limit?: number; action?: string; module?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: queryKeys.employees.logs(id, params as Record<string, string | undefined>),
    queryFn: () => employeeApi.logs(id, params),
    enabled: !!id,
  });
}

export function useDeleteEmployeeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}

export function usePermissionTemplates() {
  return useQuery({
    queryKey: ['permission-templates'],
    queryFn: () => employeeApi.getPermissionTemplates(),
  });
}

export function useEmployeePermissions(id: string) {
  return useQuery({
    queryKey: ['employee-permissions', id],
    queryFn: () => employeeApi.getPermissions(id),
    enabled: !!id,
  });
}

export function useUpdateEmployeePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissionIds }: { id: string; permissionIds: string[] }) =>
      employeeApi.updatePermissions(id, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
    },
  });
}
