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
  warningQuantity: number;
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

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  itemCount: number;
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
  warningCount?: number;
}

export type AccountRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'STAFF';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: AccountRole;
  permissions?: string[];
  permissionsVersion?: number;
  mustChangePassword?: boolean;
  branchId?: string;
  createdAt: string;
}

export function normalizeRole(role: string): AccountRole {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'MANAGER') return 'MANAGER';
  if (role === 'CASHIER') return 'CASHIER';
  if (role === 'KITCHEN') return 'KITCHEN';
  return 'STAFF';
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

// ======== POS v2 Types ========

export type PosDeviceTypeV2 = 'CASHIER' | 'KITCHEN' | 'TABLET' | 'KIOSK' | 'WAITER' | 'CUSTOMER_DISPLAY' | 'MANAGER';
export type PosStatusV2 = 'PENDING_ACTIVATION' | 'ACTIVATED' | 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'REVOKED';

export type DevicePermission =
  | 'order:create' | 'order:read' | 'order:update' | 'order:cancel'
  | 'payment:process' | 'payment:refund' | 'payment:qr'
  | 'receipt:print' | 'bill:split' | 'bill:print'
  | 'customer:create' | 'customer:read' | 'customer:update'
  | 'menu:create' | 'menu:read' | 'menu:update'
  | 'inventory:read' | 'inventory:update'
  | 'reports:read'
  | 'kitchen:view_queue' | 'kitchen:update_status' | 'kitchen:view_status'
  | 'shift:open' | 'shift:close' | 'shift:view'
  | 'staff:manage' | 'device:manage'
  | 'table:read' | 'table:update'
  | 'kot:read' | 'kot:update';

export interface DeviceFeatures {
  modules: string[];
  routes: string[];
  hide: string[];
}
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface PosDeviceV2 {
  id: string;
  branchId: string;
  name: string;
  type: PosDeviceTypeV2;
  mode: PosMode;
  status: PosStatusV2;
  active: boolean;
  lastActive: string | null;
  lastLoginAt: string | null;
  currentVersion: string | null;
  activatedAt: string | null;
  tokenVersion: number;
  createdAt: string;
  currentShift: {
    id: string;
    startTime: string;
    cashier: string | null;
  } | null;
  ordersToday: number;
  branch?: { id: string; name: string };
}

export interface CreatePosDeviceResponse {
  id: string;
  name: string;
  type: string;
  mode: PosMode;
  setupPin: string;
  setupPinExpiresAt: string;
  branchId: string;
  status: string;
  active: boolean;
  createdAt: string;
}

export interface StaffLoginResponse {
  sessionId: string;
  account: {
    id: string;
    fullName: string;
    role: string;
  };
  shift: {
    id: string;
    status: ShiftStatus;
    openedAt: string;
  } | null;
  loginAt: string;
}

export interface ActiveStaff {
  sessionId: string;
  account: {
    id: string;
    fullName: string;
    role: string;
  };
  loginAt: string;
  lastActivityAt: string | null;
}

export interface OpenShiftRequest {
  openingBalance: number;
  note?: string;
}

export interface CloseShiftRequest {
  closingBalance: number;
  actualBalance?: number;
  note?: string;
}

export interface ShiftResponse {
  id: string;
  status: ShiftStatus;
  openingBalance: number;
  closingBalance?: number;
  expectedCashBalance?: number;
  balanceVariance?: number;
  cashSales?: number;
  cardSales?: number;
  otherSales?: number;
  totalOrders?: number;
  openedAt: string;
  closedAt?: string;
  cashier?: { id: string; fullName: string } | null;
}

export interface CurrentShift {
  id: string;
  status: ShiftStatus;
  openingBalance: number;
  openedAt: string;
  cashSales: number;
  cardSales: number;
  otherSales: number;
  totalOrders: number;
  currentSales: number;
  staff: Array<{ id: string; fullName: string; role: string }>;
  isOnline: boolean;
  lastActive: string | null;
}

export interface DeviceRegeneratePinResponse {
  deviceId: string;
  setupPin: string;
  setupPinExpiresAt: string;
}

export interface DeviceRevokeResponse {
  deviceId: string;
  status: string;
}

export interface PosSetupState {
  step: 'welcome' | 'activation' | 'complete';
  deviceName?: string;
  deviceToken?: string;
  branchName?: string;
}

// ======== Unified Auth Types ========

export interface DeviceLoginRequest {
  setupPin: string;
  fingerprint?: string;
  deviceName?: string;
}

export interface DeviceLoginResponse {
  deviceToken: string;
  refreshToken: string;
  expiresAt: string;
  device: {
    id: string;
    name: string;
    type: PosDeviceTypeV2;
    mode: PosMode;
    status: string;
  };
  permissions: DevicePermission[];
  features: DeviceFeatures;
  enabledFeatures: string[];
  branch: {
    id: string;
    name: string;
    address: string;
  };
}

export interface TableItem {
  id: string;
  branchId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'DISABLED';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRefreshResponse {
  deviceToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface DeviceSessionInfo {
  id: string;
  deviceName: string | null;
  fingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  lastUsedAt: string;
  createdAt: string;
}

export type AuthMode = 'account' | 'device';
