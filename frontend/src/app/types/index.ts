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
  available: boolean;
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
  sortOrder: number;
  active: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface TopSellingItem {
  menuItemId: string;
  soldQuantity: number;
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

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderItemDetail {
  id: string;
  menuItemId: string | null;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  discount: number;
  lineTotal: number;
  note: string | null;
  modifiers: OrderItemModifier[];
}

export interface CustomerInfo {
  id: string;
  fullName: string;
  phone: string;
}

export interface PaymentInfo {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  createdAt: string;
}

export interface TableInfo {
  id: string;
  tableCode: string;
  tableName: string | null;
}

export interface CreatedByInfo {
  id: string;
  fullName: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  tableNumber: number | null;
  status: string;
  paymentMethod: string | null;
  paymentStatus?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  profit: number;
  discount: number;
  rounding: number;
  serviceCharge: number;
  note: string | null;
  source: string | null;
  guestCount: number | null;
  orderType: string;
  createdAt: string;
  completedAt: string | null;
  items: OrderItemDetail[];
  itemCount: number;
  cashier?: string;
  cashierName?: string;
  customer: CustomerInfo | null;
  payments: PaymentInfo[];
  table: TableInfo | null;
  createdBy: CreatedByInfo | null;
}

export interface OrderItemSimple {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderDetailSimple {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  serviceCharge: number;
  total: number;
  items: OrderItemSimple[];
  // Billiard session snapshot
  tableName?: string | null;
  tableCode?: string | null;
  tableType?: string | null;
  sessionStartTime?: string | null;
  playingDurationMinutes?: number | null;
  hourlyRate?: number | null;
  playingCost?: number | null;
  foodDrinkTotal?: number | null;
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

export interface DashboardKpi {
  todayRevenue: number;
  todayRevenueTrend: number;
  todayProfit: number;
  todayProfitTrend: number;
  todayOrders: number;
  todayOrdersTrend: number;
  activeMenuItems: number;
  lowInventoryAlerts: number;
}

export interface RevenueChartPoint {
  date: string;
  revenue: number;
  profit: number;
  orderCount: number;
}

export interface DashboardTopItem {
  menuItemId: string;
  name: string;
  category: string;
  soldQuantity: number;
  revenue: number;
}

export interface DashboardLowStockItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  warningQuantity: number;
  status: 'out_of_stock' | 'low_stock';
}

export interface DashboardActivity {
  id: string;
  action: string;
  module: string;
  details: any;
  createdAt: string;
  user: string | null;
}

export interface DashboardQuickStats {
  totalRevenue30d: number;
  totalProfit30d: number;
  avgOrderValue: number;
  totalCustomersServed: number;
  profitMargin: number;
}

export interface DashboardDataV2 {
  kpi: DashboardKpi;
  revenueChart: RevenueChartPoint[];
  orderStatus: Record<string, number>;
  topItems: DashboardTopItem[];
  lowStockItems: DashboardLowStockItem[];
  recentActivities: DashboardActivity[];
  quickStats: DashboardQuickStats;
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

export interface MenuRecipeRef {
  menuItemId: string;
  menuItemName: string;
  amount: number;
}

export interface DeleteDependencyReport {
  action: 'soft_delete';
  ingredientId: string;
  ingredientName: string;
  dependencies: {
    menuRecipes: MenuRecipeRef[];
    inventoryTransactions: number;
    stockAlerts: number;
    stockAudits: number;
  };
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  permissions?: string[];
  permissionsVersion?: number;
  mustChangePassword?: boolean;
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
}

// === POS Mode ===
export type PosMode = 'CASHIER' | 'KITCHEN' | 'HYBRID';

// ======== POS v2 Types ========

export type PosDeviceTypeV2 = 'CASHIER' | 'KITCHEN' | 'TABLET' | 'KIOSK' | 'WAITER' | 'CUSTOMER_DISPLAY' | 'MANAGER';
export type PosStatusV2 = 'PENDING_ACTIVATION' | 'ACTIVATED' | 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'REVOKED';

export type DevicePermission =
  | 'ORDER_VIEW'
  | 'ORDER_MANAGE'
  | 'ORDER_HISTORY_VIEW'

  | 'MENU_VIEW'
  | 'MENU_CREATE'
  | 'MENU_UPDATE'
  | 'MENU_DELETE'
  | 'MENU_MANAGE'

  | 'INVENTORY_VIEW'
  | 'INVENTORY_MANAGE'
  | 'INVENTORY_IMPORT'
  | 'INVENTORY_EXPORT'
  | 'INVENTORY_ADJUST'

  | 'REPORT_VIEW'
  | 'REPORT_EXPORT'

  | 'BRANCH_VIEW'
  | 'BRANCH_CREATE'
  | 'BRANCH_UPDATE'
  | 'BRANCH_DELETE'
  | 'BRANCH_MANAGE'

  | 'ACCOUNT_VIEW'
  | 'ACCOUNT_MANAGE'

  | 'POS_OPEN'
  | 'POS_CLOSE'
  | 'POS_CREATE_ORDER'
  | 'POS_CANCEL_ORDER'

  | 'POS_ORDER_QUEUE_VIEW'
  | 'POS_ORDER_QUEUE_CREATE'
  | 'POS_ORDER_QUEUE_UPDATE'
  | 'POS_ORDER_QUEUE_DELETE'
  | 'POS_ORDER_QUEUE_PAYMENT'

  | 'POS_DEVICE_VIEW'
  | 'POS_DEVICE_CREATE'
  | 'POS_DEVICE_UPDATE'
  | 'POS_DEVICE_DELETE'

  | 'TABLE_VIEW'
  | 'TABLE_CREATE'
  | 'TABLE_UPDATE'
  | 'TABLE_DELETE'

  | 'CATEGORY_VIEW'
  | 'CATEGORY_CREATE'
  | 'CATEGORY_UPDATE'
  | 'CATEGORY_DELETE'

  | 'CUSTOMER_VIEW'
  | 'CUSTOMER_MANAGE'

  | 'SHIFT_VIEW'
  | 'SHIFT_MANAGE'

  | 'PERMISSION_VIEW'
  | 'PERMISSION_MANAGE'
  | 'PERMISSION_ASSIGN'

  | 'SETTINGS_MANAGE'

  | 'DASHBOARD_VIEW'

  | 'ADMIN_ALL';

export interface DeviceFeatures {
  modules: string[];
  routes: string[];
  hide: string[];
}
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface PosDeviceV2 {
  id: string;
  accountId: string;
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
  account?: { id: string; name: string };
}

export interface CreatePosDeviceResponse {
  id: string;
  name: string;
  type: string;
  mode: PosMode;
  setupPin: string;
  accountId: string;
  status: string;
  active: boolean;
  createdAt: string;
}

export interface StaffLoginResponse {
  sessionId: string;
  account: {
    id: string;
    fullName: string;
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
  staff: Array<{ id: string; fullName: string }>;
  isOnline: boolean;
  lastActive: string | null;
}

export interface DeviceRegeneratePinResponse {
  deviceId: string;
  setupPin: string;
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

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'CHECKING_OUT' | 'DISABLED';

export interface PosTableOrder {
  id: string;
  orderNumber: string;
  status: string;
  itemCount: number;
  total: number;
}

export interface TableItem {
  id: string;
  accountId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  status: TableStatus;
  currentOrderId: string | null;
  currentOrder: PosTableOrder | null;
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

export interface MissingIngredient {
  ingredientName: string;
  required: number;
  available: number;
}

export interface InventoryIssue {
  menuItemId: string;
  menuItemName: string;
  missingIngredients: MissingIngredient[];
}
