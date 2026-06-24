export type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

export const PLAN_KEYS: PlanKey[] = ['BASIC', 'STANDARD', 'PREMIUM'];
export const PLAN_ORDER: PlanKey[] = ['BASIC', 'STANDARD', 'PREMIUM'];

export interface ModuleGroup {
  module: string;
  label: string;
  permissions: string[];
}

export const PLAN_PERMISSIONS: Record<PlanKey, string[]> = {
  BASIC: [
    'DASHBOARD_VIEW',
    'MENU_VIEW',
    'MENU_CREATE',
    'MENU_UPDATE',
    'CATEGORY_VIEW',
    'CATEGORY_CREATE',
    'CATEGORY_UPDATE',
    'ORDER_VIEW',
    'ORDER_CREATE',
    'ORDER_UPDATE',
    'ORDER_HISTORY_VIEW',
    'TABLE_VIEW',
    'POS_CREATE_ORDER',
    'POS_CANCEL_ORDER',
    'REPORT_VIEW',
    'CUSTOMER_VIEW',
  ],

  STANDARD: [
    'DASHBOARD_VIEW',
    'MENU_VIEW',
    'MENU_CREATE',
    'MENU_UPDATE',
    'CATEGORY_VIEW',
    'CATEGORY_CREATE',
    'CATEGORY_UPDATE',
    'ORDER_VIEW',
    'ORDER_CREATE',
    'ORDER_UPDATE',
    'ORDER_HISTORY_VIEW',
    'TABLE_VIEW',
    'POS_CREATE_ORDER',
    'POS_CANCEL_ORDER',
    'REPORT_VIEW',
    'CUSTOMER_VIEW',
    'INVENTORY_VIEW',
    'INVENTORY_CREATE',
    'INVENTORY_UPDATE',
    'INVENTORY_IMPORT',
    'INVENTORY_EXPORT',
    'INVENTORY_ADJUST',
    'CUSTOMER_CREATE',
    'CUSTOMER_UPDATE',
    'SHIFT_VIEW',
    'SHIFT_CREATE',
    'SHIFT_UPDATE',
    'POS_OPEN',
    'POS_CLOSE',
    'POS_ORDER_QUEUE_VIEW',
    'POS_ORDER_QUEUE_CREATE',
    'POS_ORDER_QUEUE_UPDATE',
    'POS_ORDER_QUEUE_PAY',
  ],

  PREMIUM: [
    'DASHBOARD_VIEW',
    'MENU_VIEW',
    'MENU_CREATE',
    'MENU_UPDATE',
    'CATEGORY_VIEW',
    'CATEGORY_CREATE',
    'CATEGORY_UPDATE',
    'ORDER_VIEW',
    'ORDER_CREATE',
    'ORDER_UPDATE',
    'ORDER_HISTORY_VIEW',
    'TABLE_VIEW',
    'POS_CREATE_ORDER',
    'POS_CANCEL_ORDER',
    'REPORT_VIEW',
    'CUSTOMER_VIEW',
    'INVENTORY_VIEW',
    'INVENTORY_CREATE',
    'INVENTORY_UPDATE',
    'INVENTORY_IMPORT',
    'INVENTORY_EXPORT',
    'INVENTORY_ADJUST',
    'CUSTOMER_CREATE',
    'CUSTOMER_UPDATE',
    'SHIFT_VIEW',
    'SHIFT_CREATE',
    'SHIFT_UPDATE',
    'POS_OPEN',
    'POS_CLOSE',
    'POS_ORDER_QUEUE_VIEW',
    'POS_ORDER_QUEUE_CREATE',
    'POS_ORDER_QUEUE_UPDATE',
    'POS_ORDER_QUEUE_PAY',
    'BILLIARD_TABLE_CREATE',
    'BILLIARD_TABLE_LAYOUT_EDIT',
    'BILLIARD_SESSION_VIEW',
    'BILLIARD_SESSION_CHECKIN',
    'BILLIARD_SESSION_START',
    'BILLIARD_SESSION_FINISH',
    'BILLIARD_ORDER_VIEW',
    'BILLIARD_ORDER_CREATE',
    'BILLIARD_ORDER_UPDATE',
    'BILLIARD_ORDER_ADD_ITEM',
    'BILLIARD_PAY_VIEW',
    'BILLIARD_PAY_PROCESS',
    'BILLIARD_RESERVATION_VIEW',
    'BILLIARD_RESERVATION_CREATE',
    'BILLIARD_RESERVATION_CANCEL',
    'BILLIARD_REPORT_VIEW',
    'RESTAURANT_TABLE_VIEW',
    'RESTAURANT_TABLE_CREATE',
    'RESTAURANT_TABLE_UPDATE',
    'RESTAURANT_TABLE_DELETE',
    'RESTAURANT_TABLE_LAYOUT_EDIT',
    'RESTAURANT_TABLE_TRANSFER',
    'RESTAURANT_TABLE_MERGE',
    'RESTAURANT_TABLE_SPLIT',
    'RESTAURANT_ORDER_VIEW',
    'RESTAURANT_ORDER_CREATE',
    'RESTAURANT_ORDER_UPDATE',
    'RESTAURANT_ORDER_DELETE',
    'RESTAURANT_ORDER_ADD_ITEM',
    'RESTAURANT_PAY_VIEW',
    'RESTAURANT_PAY_PROCESS',
    'REPORT_EXPORT',
  ],
};

export const ADVANCED_PERMISSIONS: string[] = [
  'ADMIN_ALL',
  'PERMISSION_VIEW',
  'PERMISSION_ASSIGN',
  'PERMISSION_MANAGE',
  'SETTINGS_VIEW',
  'SETTINGS_UPDATE',
  'BRANCH_CREATE',
  'BRANCH_UPDATE',
  'BRANCH_DELETE',
  'BRANCH_FORCE_DELETE',
  'BRANCH_LOCK',
  'BRANCH_UNLOCK',
  'POS_DEVICE_VIEW',
  'POS_DEVICE_CREATE',
  'POS_DEVICE_UPDATE',
  'CUSTOMER_DELETE',
  'MENU_DELETE',
  'CATEGORY_DELETE',
  'ORDER_DELETE',
  'INVENTORY_DELETE',
];

export const MODULE_GROUPS: ModuleGroup[] = [
  { module: 'dashboard', label: 'Dashboard', permissions: ['DASHBOARD_VIEW'] },
  {
    module: 'menu',
    label: 'Menu',
    permissions: ['MENU_VIEW', 'MENU_CREATE', 'MENU_UPDATE', 'MENU_DELETE', 'CATEGORY_VIEW', 'CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE'],
  },
  {
    module: 'orders',
    label: 'Orders',
    permissions: ['ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_DELETE', 'ORDER_HISTORY_VIEW'],
  },
  {
    module: 'inventory',
    label: 'Inventory',
    permissions: ['INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE', 'INVENTORY_IMPORT', 'INVENTORY_EXPORT', 'INVENTORY_ADJUST'],
  },
  {
    module: 'customers',
    label: 'Customers',
    permissions: ['CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE'],
  },
  {
    module: 'pos',
    label: 'POS',
    permissions: ['POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER', 'POS_CANCEL_ORDER', 'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_PAY'],
  },
  {
    module: 'billiard',
    label: 'Billiard',
    permissions: [
      'BILLIARD_TABLE_CREATE', 'BILLIARD_TABLE_LAYOUT_EDIT',
      'BILLIARD_SESSION_VIEW', 'BILLIARD_SESSION_CHECKIN', 'BILLIARD_SESSION_START', 'BILLIARD_SESSION_FINISH',
      'BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE', 'BILLIARD_ORDER_ADD_ITEM',
      'BILLIARD_PAY_VIEW', 'BILLIARD_PAY_PROCESS',
      'BILLIARD_RESERVATION_VIEW', 'BILLIARD_RESERVATION_CREATE', 'BILLIARD_RESERVATION_CANCEL',
      'BILLIARD_REPORT_VIEW',
    ],
  },
  {
    module: 'restaurant',
    label: 'Restaurant',
    permissions: [
      'RESTAURANT_TABLE_VIEW', 'RESTAURANT_TABLE_CREATE', 'RESTAURANT_TABLE_UPDATE', 'RESTAURANT_TABLE_DELETE', 'RESTAURANT_TABLE_LAYOUT_EDIT',
      'RESTAURANT_TABLE_TRANSFER', 'RESTAURANT_TABLE_MERGE', 'RESTAURANT_TABLE_SPLIT',
      'RESTAURANT_ORDER_VIEW', 'RESTAURANT_ORDER_CREATE', 'RESTAURANT_ORDER_UPDATE', 'RESTAURANT_ORDER_DELETE', 'RESTAURANT_ORDER_ADD_ITEM',
      'RESTAURANT_PAY_VIEW', 'RESTAURANT_PAY_PROCESS',
    ],
  },
  { module: 'reports', label: 'Reports', permissions: ['REPORT_VIEW', 'REPORT_EXPORT'] },
  { module: 'shift', label: 'Shift', permissions: ['SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_UPDATE'] },
  { module: 'table', label: 'Table', permissions: ['TABLE_VIEW'] },
  {
    module: 'advanced',
    label: 'Advanced',
    permissions: ADVANCED_PERMISSIONS,
  },
];

export interface AdvancedGroup {
  id: string;
  label: string;
  icon: string;
  permissions: string[];
}

export const ADVANCED_GROUPS: AdvancedGroup[] = [
  {
    id: 'system',
    label: 'Quản trị hệ thống',
    icon: 'Shield',
    permissions: ['ADMIN_ALL', 'PERMISSION_VIEW', 'PERMISSION_ASSIGN', 'PERMISSION_MANAGE', 'SETTINGS_VIEW', 'SETTINGS_UPDATE'],
  },
  {
    id: 'branch',
    label: 'Quản lý chi nhánh',
    icon: 'Building2',
    permissions: ['BRANCH_CREATE', 'BRANCH_UPDATE', 'BRANCH_DELETE', 'BRANCH_LOCK', 'BRANCH_UNLOCK', 'BRANCH_FORCE_DELETE'],
  },
  {
    id: 'pos_device',
    label: 'Thiết bị POS',
    icon: 'Smartphone',
    permissions: ['POS_DEVICE_VIEW', 'POS_DEVICE_CREATE', 'POS_DEVICE_UPDATE'],
  },
  {
    id: 'dangerous',
    label: 'Quyền nguy hiểm',
    icon: 'Trash2',
    permissions: ['CUSTOMER_DELETE', 'MENU_DELETE', 'ORDER_DELETE', 'INVENTORY_DELETE'],
  },
];

export const PLAN_FEATURES: Record<PlanKey, string[]> = {
  BASIC: [
    'Dashboard',
    'Thực đơn',
    'Danh mục',
    'Đơn hàng',
    'Khách hàng',
    'POS cơ bản',
    'Quản lý bàn',
    'Báo cáo cơ bản',
  ],
  STANDARD: [
    'Kho',
    'Điều phối đơn hàng',
    'Quản lý ca làm việc',
    'POS nâng cao',
    'Tồn kho',
  ],
  PREMIUM: [
    'Billiard',
    'Nhà hàng',
    'Xuất báo cáo',
    'Tất cả tính năng vận hành',
  ],
};

export const ADVANCED_FEATURES: string[] = [
  'Quản lý phân quyền',
  'Quản lý hệ thống',
  'Quản lý chi nhánh',
  'Quản lý thiết bị POS',
  'Quyền xóa dữ liệu',
  'Quyền quản trị cao cấp',
];

export const SYSTEM_DANGER_PERMISSIONS: string[] = [
  'ADMIN_ALL',
  'PERMISSION_MANAGE',
  'BRANCH_FORCE_DELETE',
];

export function getPlanPermissions(plan: PlanKey): string[] {
  return [...PLAN_PERMISSIONS[plan]];
}

export function getPlanPermissionCount(plan: PlanKey): number {
  return PLAN_PERMISSIONS[plan].length;
}

export function isAdvancedPermission(code: string): boolean {
  return ADVANCED_PERMISSIONS.includes(code);
}

/** Lấy danh sách features của plan (chỉ features riêng, không kế thừa) */
export function getOwnPlanFeatures(plan: PlanKey): string[] {
  return PLAN_FEATURES[plan] || [];
}

/** Lấy danh sách features kế thừa từ plan thấp hơn */
export function getInheritedPlanFeatures(plan: PlanKey): string[] {
  const idx = PLAN_ORDER.indexOf(plan);
  if (idx <= 0) return [];
  const inherited: string[] = [];
  for (let i = 0; i < idx; i++) {
    inherited.push(...PLAN_FEATURES[PLAN_ORDER[i]]);
  }
  return inherited;
}

/** Lấy tất cả features (kế thừa + riêng) */
export function getAllPlanFeatures(plan: PlanKey): string[] {
  const idx = PLAN_ORDER.indexOf(plan);
  const all: string[] = [];
  for (let i = 0; i <= idx; i++) {
    all.push(...PLAN_FEATURES[PLAN_ORDER[i]]);
  }
  return all;
}

export function getPlanLabel(plan: PlanKey): string {
  const labels: Record<PlanKey, string> = { BASIC: 'Cơ bản', STANDARD: 'Chuyên nghiệp', PREMIUM: 'Doanh nghiệp' };
  return labels[plan];
}

export function getPlanPrice(plan: PlanKey): string {
  const prices: Record<PlanKey, string> = { BASIC: 'Miễn phí', STANDARD: '499.000₫/tháng', PREMIUM: '1.999.000₫/tháng' };
  return prices[plan];
}
