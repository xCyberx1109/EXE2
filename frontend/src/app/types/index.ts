export interface MenuItem {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  price: number;
  cost: number;
  description: string;
  available: boolean;
  imageUrl?: string | null;
  ingredients?: MenuItemIngredientDetail[];
}

export interface MenuItemIngredientDetail {
  id: string;
  ingredientId: string;
  amount: number;
  ingredient?: InventoryItem;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  price: number;
  supplier: string;
  lastUpdated: string;
}

export interface RevenueRecord {
  id: string;
  date: string;
  orderCount: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface TopSellingItem {
  menuItemId: string;
  quantity: number;
  name?: string;
  category?: string;
  price?: number;
}

export interface PosOrder {
  id: string;
  table: number;
  items: Array<MenuItem & { quantity: number }>;
  time: string;
  status?: string;
  total?: number;
}

export interface OrderItemDetail {
  id: string;
  menuItemId: string | null;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  tableNumber: number | null;
  status: string;
  paymentMethod: string | null;
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  profit: number;
  createdAt: string;
  completedAt: string | null;
  items: OrderItemDetail[];
  itemCount: number;
}

export interface DailyOrdersResponse {
  date: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    completedCount: number;
    pendingCount: number;
  };
  orders: OrderDetail[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DashboardData {
  stats: {
    totalRevenue: number;
    totalProfit: number;
    totalOrders: number;
    availableMenuItems: number;
    lowStockCount: number;
  };
  topMenuItems: TopSellingItem[];
  lowStockItems: InventoryItem[];
}

export interface RevenueSummary {
  totalRevenue: number;
  totalProfit: number;
  totalCost: number;
  totalOrders: number;
  avgOrderValue: number;
  profitMargin: number;
  avgRevenuePerDay: number;
  days: number;
}

export interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER';
  mustChangePassword?: boolean;
  branchId?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  plan: 'BASIC' | 'PRO' | 'ENTERPRISE';
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
  subscriptionStart: string;
  subscriptionEnd: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  account?: BranchAccount; // Thông tin account quản lý (nếu có)
}

export interface BranchAccount {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
}

// === POS Mode ===
export type PosMode = 'CASHIER' | 'KITCHEN' | 'HYBRID';

// === POS Device Types ===
export interface PosDevice {
  id: string;
  branchId: string;
  name: string;
  deviceCode: string;
  devicePin?: string;
  type: 'CASHIER' | 'TABLET' | 'KIOSK';
  mode: PosMode;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  active: boolean;
  lastActive: string | null;
  createdAt: string;
  _count?: { orders: number };
  shifts?: Array<{
    id: string;
    startTime: string;
    status: string;
    account: { id: string; fullName: string } | null;
  }>;
  branch?: { id: string; name: string };
}

export interface PosDeviceCreatePayload {
  name: string;
  type: PosDevice['type'];
  mode?: PosMode;
}

export interface PosLoginResponse {
  token: string;
  device: {
    id: string;
    name: string;
    deviceCode: string;
    type: string;
    mode: PosMode;
    status: string;
    lastActive: string;
  };
  branch: {
    id: string;
    name: string;
    address: string;
  };
  shift: {
    id: string;
    startTime: string;
    status: string;
  };
}

export interface PosProfile {
  id: string;
  name: string;
  deviceCode: string;
  type: string;
  mode: PosMode;
  status: string;
  active: boolean;
  lastActive: string | null;
  branch: { id: string; name: string } | null;
  currentShift: {
    id: string;
    startTime: string;
    isOnline: boolean;
  } | null;
  ordersToday: number;
}

export interface KitchenOrderItem {
  id: string;
  name: string;
  quantity: number;
  note?: string;
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  tableNumber: number | null;
  status: string;
  items: KitchenOrderItem[];
  createdAt: string;
  note?: string;
}

export interface ResetPinResponse {
  deviceId: string;
  deviceCode: string;
  devicePin: string;
}
