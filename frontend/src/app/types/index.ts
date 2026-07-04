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

export interface SellableItem {
  id: string;
  name: string;
  image: string | null;
  sellingPrice: number;
  availableQuantity: number;
  unit: string;
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
  data: T[];
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
  plan: 'BASIC' | 'STANDARD' | 'PREMIUM';
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
  | 'ORDER_CREATE'
  | 'ORDER_UPDATE'
  | 'ORDER_DELETE'
  | 'ORDER_HISTORY_VIEW'

  | 'MENU_VIEW'
  | 'MENU_CREATE'
  | 'MENU_UPDATE'
  | 'MENU_DELETE'
  | 'MENU_MANAGEMENT_VIEW'

  | 'INVENTORY_VIEW'
  | 'INVENTORY_CREATE'
  | 'INVENTORY_UPDATE'
  | 'INVENTORY_DELETE'
  | 'INVENTORY_IMPORT'
  | 'INVENTORY_EXPORT'
  | 'INVENTORY_ADJUST'

  | 'REPORT_VIEW'
  | 'REPORT_EXPORT'

  | 'BRANCH_VIEW'
  | 'BRANCH_CREATE'
  | 'BRANCH_UPDATE'
  | 'BRANCH_DELETE'
  | 'BRANCH_LOCK'
  | 'BRANCH_UNLOCK'
  | 'BRANCH_FORCE_DELETE'

  | 'POS_OPEN'
  | 'POS_CLOSE'
  | 'POS_CREATE_ORDER'
  | 'POS_CANCEL_ORDER'

  | 'POS_ORDER_QUEUE_VIEW'
  | 'POS_ORDER_QUEUE_CREATE'
  | 'POS_ORDER_QUEUE_UPDATE'
  | 'POS_ORDER_QUEUE_DELETE'
  | 'POS_ORDER_QUEUE_PAY'

  | 'POS_DEVICE_VIEW'
  | 'POS_DEVICE_CREATE'
  | 'POS_DEVICE_UPDATE'
  | 'POS_DEVICE_DELETE'

  | 'TABLE_VIEW'
  | 'TABLE_CREATE'
  | 'TABLE_UPDATE'
  | 'TABLE_DELETE'

  | 'BILLIARD_TABLE_VIEW'
  | 'BILLIARD_TABLE_CREATE'
  | 'BILLIARD_TABLE_UPDATE'
  | 'BILLIARD_TABLE_DELETE'
  | 'BILLIARD_TABLE_LAYOUT_EDIT'

  | 'BILLIARD_SESSION_VIEW'
  | 'BILLIARD_SESSION_START'
  | 'BILLIARD_SESSION_CHECKIN'
  | 'BILLIARD_SESSION_FINISH'

  | 'BILLIARD_RESERVATION_VIEW'
  | 'BILLIARD_RESERVATION_CREATE'
  | 'BILLIARD_RESERVATION_CANCEL'

  | 'BILLIARD_ORDER_VIEW'
  | 'BILLIARD_ORDER_CREATE'
  | 'BILLIARD_ORDER_UPDATE'
  | 'BILLIARD_ORDER_DELETE'
  | 'BILLIARD_ORDER_ADD_ITEM'

  | 'BILLIARD_PAY_VIEW'
  | 'BILLIARD_PAY_PROCESS'

  | 'BILLIARD_REPORT_VIEW'

  | 'RESTAURANT_TABLE_VIEW'
  | 'RESTAURANT_TABLE_CREATE'
  | 'RESTAURANT_TABLE_UPDATE'
  | 'RESTAURANT_TABLE_DELETE'
  | 'RESTAURANT_TABLE_LAYOUT_EDIT'
  | 'RESTAURANT_TABLE_TRANSFER'
  | 'RESTAURANT_TABLE_MERGE'
  | 'RESTAURANT_TABLE_SPLIT'
  | 'RESTAURANT_ORDER_VIEW'
  | 'RESTAURANT_ORDER_CREATE'
  | 'RESTAURANT_ORDER_UPDATE'
  | 'RESTAURANT_ORDER_DELETE'
  | 'RESTAURANT_ORDER_ADD_ITEM'
  | 'RESTAURANT_PAY_VIEW'
  | 'RESTAURANT_PAY_PROCESS'

  | 'CATEGORY_VIEW'
  | 'CATEGORY_CREATE'
  | 'CATEGORY_UPDATE'
  | 'CATEGORY_DELETE'

  | 'CUSTOMER_VIEW'
  | 'CUSTOMER_CREATE'
  | 'CUSTOMER_UPDATE'
  | 'CUSTOMER_DELETE'

  | 'SHIFT_VIEW'
  | 'SHIFT_CREATE'
  | 'SHIFT_UPDATE'
  | 'SHIFT_CLOSE'

  | 'PERMISSION_VIEW'
  | 'PERMISSION_MANAGE'
  | 'PERMISSION_ASSIGN'

  | 'SETTINGS_VIEW'
  | 'SETTINGS_UPDATE'

  | 'DASHBOARD_VIEW'

  | 'VIEW_AUDIT_LOG';

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
  template: PosMachineTemplate;
  status: string;
  active: boolean;
  lastActive: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  account?: { id: string; name: string };
}

export interface CreatePosDeviceResponse {
  id: string;
  name: string;
  template: string;
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

export interface DeviceResetResponse {
  deviceId: string;
  setupPin: string;
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

export type AuthMode = 'account' | 'device' | 'pos_machine';

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

// ====== POS Machine Types ======
export type PosMachineTemplate = 'CASHIER' | 'KITCHEN' | 'BILLIARD' | 'RESTAURANT' | 'CUSTOM';

export const POS_MACHINE_TEMPLATES: Record<PosMachineTemplate, string> = {
  CASHIER: 'Thu ngân',
  KITCHEN: 'Bếp',
  BILLIARD: 'Bi-a',
  RESTAURANT: 'Nhà hàng',
  CUSTOM: 'Tùy chỉnh',
};

export interface PosMachine {
  id: string;
  name: string;
  template: PosMachineTemplate;
  status: 'ACTIVE' | 'LOCKED';
  lastLoginAt: string | null;
  createdAt: string;
  permissionCount: number;
}

export interface PosMachineDetail extends PosMachine {
  permissions: Array<{
    id: string;
    permissionId: string;
    permission: {
      id: string;
      code: string;
      name: string;
      module: string;
    };
  }>;
}

export interface PosMachineLoginResponse {
  token: string;
  machine: {
    id: string;
    name: string;
    template: PosMachineTemplate;
    status: string;
  };
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
  };
  module: string;
  permissions: string[];
}

export interface LoginByPinMachine {
  id: string;
  name: string;
  template: PosMachineTemplate;
  status: string;
}

export type LoginByPinResult =
  | PosMachineLoginResponse
  | { requiresMachineSelection: true; employee: { id: string; fullName: string; employeeCode: string }; machines: LoginByPinMachine[] };

export interface PosMachineCreateResponse {
  id: string;
  name: string;
  template: PosMachineTemplate;
  status: string;
  createdAt: string;
}

export interface EmployeeLoginResponse {
  employee: Employee;
  permissions: string[];
  token: string;
}

// ====== Activity Log Types ======
export interface ActivityLogEntry {
  id: string;
  accountId: string | null;
  employeeId: string | null;
  posDeviceId: string | null;
  action: string;
  module: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export type EmployeeLogsResponse = PaginatedResponse<ActivityLogEntry>;

// ====== Permission Types ======
export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

export interface PermissionTemplate {
  key: string;
  name: string;
  permissionCodes: string[];
}

export interface PermissionTemplatesResponse {
  templates: PermissionTemplate[];
  allPermissions: Permission[];
}

// ====== Employee Types ======
export interface Employee {
  id: string;
  accountId: string;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions?: string[];
  permissionIds?: string[];
  roles?: string[];
}

export interface EmployeeCreateResponse {
  employee: Employee;
  generatedPin?: string;
}

export interface EmployeeFormData {
  employeeCode: string;
  fullName: string;
  phone: string;
  email: string;
  pinCode: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  permissionIds?: string[];
}
