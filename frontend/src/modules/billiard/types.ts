export type TableType = 'RESTAURANT' | 'BILLIARD';

export interface BilliardTable {
  id: string;
  accountId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  tableType: TableType;
  posX: number;
  posY: number;
  xPercent: number;
  yPercent: number;
  hourlyRate: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'CHECKING_OUT' | 'DISABLED';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BilliardOrderItem {
  id: string;
  menuItemId: string | null;
  inventoryId: string | null;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface BilliardOrderInfo {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  itemCount: number;
  items: BilliardOrderItem[];
  foodTotal: number;
  tableFee: number;
  grandTotal: number;
}

export interface BilliardPlaySession {
  id: string;
  tableId: string;
  startTime: string | null;
  expectedEndTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  tableFee: number;
  status: 'PLAYING' | 'COMPLETED' | 'CANCELLED';
}

export interface BilliardReservation {
  id: string;
  customerName: string;
  phone: string | null;
  reservationTime?: string | null;
  durationMinutes?: number | null;
  note: string | null;
}

export interface BilliardTableWithSession {
  id: string;
  accountId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  tableType: TableType;
  posX: number;
  posY: number;
  xPercent: number;
  yPercent: number;
  hourlyRate: number;
  status: string;
  currentSession?: BilliardPlaySession | null;
  currentReservation?: BilliardReservation | null;
  currentOrder?: BilliardOrderInfo | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SortPriority =
  | 'OCCUPIED_ENDING'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'AVAILABLE'
  | 'CLEANING'
  | 'CHECKING_OUT'
  | 'DISABLED';

export interface PlayNowBody {
  durationMinutes?: number;
  customerName?: string;
  phone?: string;
}

export interface ReserveBody {
  customerName: string;
  phone?: string;
  reservationTime: string;
  durationMinutes?: number;
  note?: string;
}

export interface ExtendSessionBody {
  additionalMinutes: number;
}

export interface CreateTableBody {
  tableCode: string;
  tableName?: string;
  tableType: TableType;
  capacity?: number;
  posX?: number;
  posY?: number;
  xPercent?: number;
  yPercent?: number;
  hourlyRate?: number;
}

// Restaurant-specific types
export interface RestaurantTable {
  id: string;
  accountId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  tableType: 'RESTAURANT';
  posX: number;
  posY: number;
  xPercent: number;
  yPercent: number;
  status: string;
  isMerged: boolean;
  mergedIntoTableId: string | null;
  currentOrder: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    itemCount: number;
    items: BilliardOrderItem[];
    foodTotal: number;
    guestCount: number;
    startTime: string | null;
    elapsedMinutes: number;
    note: string | null;
    mergedTableIds: string[] | null;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderBody {
  guestCount?: number;
  note?: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  available: boolean;
}
