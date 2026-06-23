export type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  icon: string;
  permissions: string[];
}

export interface PlanConfig {
  id: PlanKey;
  name: string;
  color: string;
  borderColor: string;
  bgColor: string;
  badgeColor: string;
  price: string;
  features: PlanFeature[];
  featureCountLabel: string;
}

/**
 * SUBSCRIPTION_PLANS — định nghĩa 3 gói dịch vụ.
 * Mỗi gói kế thừa toàn bộ feature của gói dưới.
 */
export const SUBSCRIPTION_PLANS: Record<PlanKey, PlanConfig> = {
  BASIC: {
    id: 'BASIC',
    name: 'Cơ bản',
    color: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    badgeColor: 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400',
    price: 'Miễn phí',
    featureCountLabel: '15 tính năng',
    features: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        description: 'Xem tổng quan cửa hàng',
        icon: 'LayoutDashboard',
        permissions: ['DASHBOARD_VIEW'],
      },
      {
        id: 'table',
        name: 'Quản lý bàn',
        description: 'Xem, tạo và quản lý bàn',
        icon: 'Table',
        permissions: ['TABLE_VIEW', 'TABLE_CREATE', 'TABLE_UPDATE', 'TABLE_DELETE', 'TABLE_LAYOUT_EDIT'],
      },
      {
        id: 'order',
        name: 'Quản lý đơn hàng',
        description: 'Tạo, xem và cập nhật đơn hàng',
        icon: 'FileText',
        permissions: ['ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_HISTORY_VIEW'],
      },
      {
        id: 'pos_order',
        name: 'Tạo đơn POS',
        description: 'Tạo và hủy đơn hàng qua POS',
        icon: 'ShoppingCart',
        permissions: ['POS_CREATE_ORDER', 'POS_CANCEL_ORDER'],
      },
      {
        id: 'order_queue',
        name: 'Điều phối đơn hàng',
        description: 'Xem và quản lý hàng đợi đơn hàng',
        icon: 'ClipboardList',
        permissions: [
          'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE',
          'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_DELETE',
          'POS_ORDER_QUEUE_PAY',
        ],
      },
      {
        id: 'menu',
        name: 'Xem thực đơn',
        description: 'Xem thực đơn và danh mục',
        icon: 'UtensilsCrossed',
        permissions: ['MENU_VIEW', 'CATEGORY_VIEW'],
      },
      {
        id: 'customer',
        name: 'Quản lý khách hàng',
        description: 'Xem và thêm khách hàng',
        icon: 'Users',
        permissions: ['CUSTOMER_VIEW', 'CUSTOMER_CREATE'],
      },
      {
        id: 'inventory_view',
        name: 'Xem tồn kho',
        description: 'Xem thông tin tồn kho',
        icon: 'Package',
        permissions: ['INVENTORY_VIEW'],
      },
      {
        id: 'report_view',
        name: 'Báo cáo cơ bản',
        description: 'Xem báo cáo',
        icon: 'BarChart3',
        permissions: ['REPORT_VIEW'],
      },
      {
        id: 'shift',
        name: 'Quản lý ca làm việc',
        description: 'Xem và quản lý ca làm việc',
        icon: 'Clock',
        permissions: ['SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_CLOSE'],
      },
      {
        id: 'pos_basic',
        name: 'POS cơ bản',
        description: 'Mở và đóng ca POS',
        icon: 'Monitor',
        permissions: ['POS_OPEN', 'POS_CLOSE'],
      },
      {
        id: 'billiard_view',
        name: 'Xem bàn Billiard',
        description: 'Xem danh sách bàn Billiard',
        icon: 'CircleDot',
        permissions: ['BILLIARD_TABLE_VIEW'],
      },
      {
        id: 'restaurant_view',
        name: 'Xem bàn Nhà hàng',
        description: 'Xem danh sách bàn nhà hàng',
        icon: 'UtensilsCrossed',
        permissions: ['RESTAURANT_TABLE_VIEW'],
      },
      {
        id: 'pos_device_view',
        name: 'Xem thiết bị POS',
        description: 'Xem danh sách thiết bị POS',
        icon: 'Smartphone',
        permissions: ['POS_DEVICE_VIEW'],
      },
    ],
  },

  STANDARD: {
    id: 'STANDARD',
    name: 'Chuyên nghiệp',
    color: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    badgeColor: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
    price: '499.000₫/tháng',
    featureCountLabel: '22 tính năng',
    features: [
      // Kế thừa toàn bộ BASIC + các feature mới
      {
        id: 'permission_view',
        name: 'Phân quyền',
        description: 'Xem và phân quyền cho tài khoản',
        icon: 'Shield',
        permissions: ['PERMISSION_VIEW', 'PERMISSION_ASSIGN'],
      },
      {
        id: 'settings',
        name: 'Cài đặt hệ thống',
        description: 'Xem và cập nhật cài đặt',
        icon: 'Settings',
        permissions: ['SETTINGS_VIEW', 'SETTINGS_UPDATE'],
      },
      {
        id: 'report_export',
        name: 'Xuất báo cáo',
        description: 'Xuất báo cáo ra file',
        icon: 'Download',
        permissions: ['REPORT_EXPORT'],
      },
      {
        id: 'branch_view',
        name: 'Quản lý chi nhánh',
        description: 'Xem thông tin chi nhánh',
        icon: 'Building2',
        permissions: ['BRANCH_VIEW'],
      },
      {
        id: 'customer_update',
        name: 'Chỉnh sửa khách hàng',
        description: 'Cập nhật và xóa thông tin khách hàng',
        icon: 'UserPen',
        permissions: ['CUSTOMER_UPDATE', 'CUSTOMER_DELETE'],
      },
      {
        id: 'menu_category',
        name: 'Quản lý danh mục',
        description: 'Thêm, sửa, xóa danh mục món',
        icon: 'Grid3X3',
        permissions: ['CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE'],
      },
      {
        id: 'shift_full',
        name: 'Quản lý ca đầy đủ',
        description: 'Cập nhật ca làm việc',
        icon: 'Clock',
        permissions: ['SHIFT_UPDATE'],
      },
    ],
  },

  PREMIUM: {
    id: 'PREMIUM',
    name: 'Doanh nghiệp',
    color: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    badgeColor: 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
    price: '1.999.000₫/tháng',
    featureCountLabel: 'Toàn bộ tính năng',
    features: [
      // Kế thừa toàn bộ STANDARD + các feature mới
      {
        id: 'billiard_table_full',
        name: 'Quản lý bàn Billiard',
        description: 'Thêm, sửa, xóa bàn và chỉnh sửa sơ đồ',
        icon: 'CircleDot',
        permissions: ['BILLIARD_TABLE_CREATE', 'BILLIARD_TABLE_UPDATE', 'BILLIARD_TABLE_DELETE', 'BILLIARD_TABLE_LAYOUT_EDIT'],
      },
      {
        id: 'billiard_session',
        name: 'Phiên chơi Billiard',
        description: 'Bắt đầu, gia hạn, kết thúc phiên chơi và check-in',
        icon: 'Play',
        permissions: ['BILLIARD_SESSION_VIEW', 'BILLIARD_SESSION_START', 'BILLIARD_SESSION_CHECKIN', 'BILLIARD_SESSION_EXTEND', 'BILLIARD_SESSION_FINISH'],
      },
      {
        id: 'billiard_reservation',
        name: 'Đặt bàn Billiard',
        description: 'Đặt trước và hủy đặt bàn Billiard',
        icon: 'CalendarCheck',
        permissions: ['BILLIARD_RESERVATION_VIEW', 'BILLIARD_RESERVATION_CREATE', 'BILLIARD_RESERVATION_CANCEL'],
      },
      {
        id: 'billiard_order',
        name: 'Gọi món Billiard',
        description: 'Tạo, cập nhật đơn món tại bàn Billiard',
        icon: 'ShoppingBag',
        permissions: ['BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE', 'BILLIARD_ORDER_DELETE', 'BILLIARD_ORDER_ADD_ITEM'],
      },
      {
        id: 'billiard_pay',
        name: 'Thanh toán Billiard',
        description: 'Xem và xử lý thanh toán Billiard',
        icon: 'CreditCard',
        permissions: ['BILLIARD_PAY_VIEW', 'BILLIARD_PAY_PROCESS'],
      },
      {
        id: 'billiard_report',
        name: 'Báo cáo Billiard',
        description: 'Xem báo cáo Billiard',
        icon: 'ChartColumn',
        permissions: ['BILLIARD_REPORT_VIEW'],
      },
      {
        id: 'restaurant_table_full',
        name: 'Quản lý bàn Nhà hàng',
        description: 'Thêm, sửa, xóa bàn, chuyển/gộp/tách bàn',
        icon: 'UtensilsCrossed',
        permissions: [
          'RESTAURANT_TABLE_CREATE', 'RESTAURANT_TABLE_UPDATE',
          'RESTAURANT_TABLE_DELETE', 'RESTAURANT_TABLE_LAYOUT_EDIT',
          'RESTAURANT_TABLE_TRANSFER', 'RESTAURANT_TABLE_MERGE',
          'RESTAURANT_TABLE_SPLIT',
        ],
      },
      {
        id: 'restaurant_order',
        name: 'Gọi món Nhà hàng',
        description: 'Tạo, cập nhật đơn món tại bàn nhà hàng',
        icon: 'ShoppingBag',
        permissions: ['RESTAURANT_ORDER_VIEW', 'RESTAURANT_ORDER_CREATE', 'RESTAURANT_ORDER_UPDATE', 'RESTAURANT_ORDER_DELETE', 'RESTAURANT_ORDER_ADD_ITEM'],
      },
      {
        id: 'restaurant_pay',
        name: 'Thanh toán Nhà hàng',
        description: 'Xem và xử lý thanh toán nhà hàng',
        icon: 'CreditCard',
        permissions: ['RESTAURANT_PAY_VIEW', 'RESTAURANT_PAY_PROCESS'],
      },
      {
        id: 'inventory_full',
        name: 'Quản lý kho',
        description: 'Nhập, xuất, điều chỉnh tồn kho và quản lý nguyên liệu',
        icon: 'Package',
        permissions: ['INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE', 'INVENTORY_IMPORT', 'INVENTORY_EXPORT', 'INVENTORY_ADJUST'],
      },
      {
        id: 'menu_full',
        name: 'Quản lý thực đơn',
        description: 'Thêm, sửa, xóa món ăn',
        icon: 'UtensilsCrossed',
        permissions: ['MENU_CREATE', 'MENU_UPDATE', 'MENU_DELETE'],
      },
      {
        id: 'permission_manage',
        name: 'Quản lý quyền hệ thống',
        description: 'Quản lý toàn bộ quyền hệ thống',
        icon: 'ShieldCheck',
        permissions: ['PERMISSION_MANAGE'],
      },
      {
        id: 'branch_full',
        name: 'Quản lý chi nhánh nâng cao',
        description: 'Tạo, khóa, xóa chi nhánh',
        icon: 'Building2',
        permissions: ['BRANCH_CREATE', 'BRANCH_UPDATE', 'BRANCH_DELETE', 'BRANCH_LOCK', 'BRANCH_UNLOCK', 'BRANCH_FORCE_DELETE'],
      },
      {
        id: 'pos_device_full',
        name: 'Quản lý thiết bị POS',
        description: 'Thêm, sửa, xóa thiết bị POS',
        icon: 'Smartphone',
        permissions: ['POS_DEVICE_CREATE', 'POS_DEVICE_UPDATE', 'POS_DEVICE_DELETE'],
      },
      {
        id: 'order_delete',
        name: 'Xóa đơn hàng',
        description: 'Xóa đơn hàng vĩnh viễn',
        icon: 'Trash2',
        permissions: ['ORDER_DELETE'],
      },
    ],
  },
};

/** Lấy danh sách tất cả permissions thuộc một plan (bao gồm kế thừa) */
function getPlanPermissionSet(planKey: PlanKey, includeLower: boolean): Set<string> {
  const set = new Set<string>();
  const planOrder: PlanKey[] = ['BASIC', 'STANDARD', 'PREMIUM'];
  const idx = planOrder.indexOf(planKey);
  if (idx === -1) return set;

  // features của chính plan này
  for (const f of SUBSCRIPTION_PLANS[planKey].features) {
    for (const p of f.permissions) set.add(p);
  }

  // Kế thừa từ plan thấp hơn
  if (includeLower) {
    for (let i = 0; i < idx; i++) {
      for (const f of SUBSCRIPTION_PLANS[planOrder[i]].features) {
        for (const p of f.permissions) set.add(p);
      }
    }
  }

  return set;
}

/** Lấy tất cả permissions của plan (gồm kế thừa) */
export function getPlanPermissions(planKey: PlanKey): string[] {
  return Array.from(getPlanPermissionSet(planKey, true));
}

/** Lấy permissions RIÊNG của plan này (không kế thừa) */
export function getOwnPlanPermissions(planKey: PlanKey): string[] {
  return Array.from(getPlanPermissionSet(planKey, false));
}

/**
 * Xác định plan của account dựa trên permissions đã gán.
 * Heuristic:
 *   PREMIUM  → có bất kỳ: BILLIARD_TABLE_CREATE, INVENTORY_CREATE, PERMISSION_MANAGE
 *   STANDARD → có bất kỳ: SETTINGS_VIEW, PERMISSION_VIEW, BRANCH_VIEW
 *   BASIC    → mặc định
 */
export function determinePlan(permissions: string[]): PlanKey {
  const set = new Set(permissions);

  if (set.has('BILLIARD_TABLE_CREATE') || set.has('INVENTORY_CREATE') || set.has('PERMISSION_MANAGE') ||
      set.has('RESTAURANT_TABLE_CREATE') || set.has('MENU_CREATE')) {
    return 'PREMIUM';
  }

  if (set.has('SETTINGS_VIEW') || set.has('PERMISSION_VIEW') || set.has('BRANCH_VIEW')) {
    return 'STANDARD';
  }

  return 'BASIC';
}

/** Lấy tất cả features của plan (gồm kế thừa) */
export function getPlanFeatures(planKey: PlanKey): PlanFeature[] {
  const planOrder: PlanKey[] = ['BASIC', 'STANDARD', 'PREMIUM'];
  const idx = planOrder.indexOf(planKey);
  if (idx === -1) return [];

  const features: PlanFeature[] = [];
  for (let i = 0; i <= idx; i++) {
    features.push(...SUBSCRIPTION_PLANS[planOrder[i]].features);
  }
  return features;
}

/** Lấy features KHÔNG thuộc plan (cần nâng cấp) */
export function getLockedFeatures(planKey: PlanKey): PlanFeature[] {
  const planOrder: PlanKey[] = ['BASIC', 'STANDARD', 'PREMIUM'];
  const idx = planOrder.indexOf(planKey);
  if (idx === -1 || idx >= planOrder.length - 1) return [];

  const features: PlanFeature[] = [];
  for (let i = idx + 1; i < planOrder.length; i++) {
    features.push(...SUBSCRIPTION_PLANS[planOrder[i]].features);
  }
  return features;
}

/** Kiểm tra account đã được gán đủ permissions cho feature chưa */
export function isFeatureFullyAssigned(feature: PlanFeature, assignedPermIds: Set<string>, permCodeToId: Map<string, string>): boolean {
  return feature.permissions.every(code => {
    const id = permCodeToId.get(code);
    return id && assignedPermIds.has(id);
  });
}
