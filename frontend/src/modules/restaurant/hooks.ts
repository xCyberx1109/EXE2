// Re-export restaurant hooks from the unified billiard module
export {
  useRestaurantTables,
  useCreateRestaurantTable,
  useUpdateRestaurantTable,
  useDeleteRestaurantTable,
  useOpenOrder,
  useRestaurantTableOrder,
  useAddRestaurantOrderItem,
  useUpdateRestaurantOrderItem,
  useRemoveRestaurantOrderItem,
  useTransferTable,
  useMergeTables,
  useSplitOrder,
  usePayRestaurantOrder,
  useUpdateGuestCount,
  useUpdateOrderNote,
  useUpdateLayout,
} from '../billiard/hooks';
