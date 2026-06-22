// Re-export types from the unified billiard module
export type {
  BilliardOrderItem,
  BilliardOrderInfo,
  BilliardTableWithSession,
  RestaurantTable,
  CreateTableBody,
  CreateOrderBody,
  MenuItemOption,
  TableType,
} from '../billiard/types';

export type RestaurantTableWithOrder = import('../billiard/types').RestaurantTable;
