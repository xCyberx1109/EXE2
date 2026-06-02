import type { DevicePermission, DeviceFeatures, PosDeviceTypeV2 } from '../../app/types';

export const PosDeviceType: Record<string, PosDeviceTypeV2> = {
  CASHIER: 'CASHIER',
  KITCHEN: 'KITCHEN',
  WAITER: 'WAITER',
  KIOSK: 'KIOSK',
  CUSTOMER_DISPLAY: 'CUSTOMER_DISPLAY',
  MANAGER: 'MANAGER',
  TABLET: 'TABLET',
};

export const DEVICE_PERMISSIONS: Record<PosDeviceTypeV2, DevicePermission[]> = {
  CASHIER: [
    'order:create', 'order:read', 'order:update', 'order:cancel',
    'payment:process', 'payment:refund',
    'receipt:print', 'bill:split', 'bill:print',
    'customer:create', 'customer:read',
    'menu:read',
    'table:read', 'table:update',
    'shift:open', 'shift:close', 'shift:view',
  ],
  KITCHEN: [
    'kitchen:view_queue', 'kitchen:update_status',
    'order:read', 'kot:read', 'kot:update', 'menu:read',
  ],
  WAITER: [
    'order:create', 'order:read', 'order:update',
    'table:read', 'table:update',
    'customer:read', 'customer:create', 'menu:read',
  ],
  KIOSK: [
    'order:create', 'menu:read', 'payment:qr', 'customer:create',
  ],
  CUSTOMER_DISPLAY: [
    'order:read', 'kitchen:view_status',
  ],
  MANAGER: [
    'order:create', 'order:read', 'order:update', 'order:cancel',
    'payment:process', 'payment:refund',
    'receipt:print', 'bill:split', 'bill:print',
    'customer:create', 'customer:read', 'customer:update',
    'menu:create', 'menu:read', 'menu:update',
    'inventory:read', 'inventory:update',
    'reports:read',
    'shift:open', 'shift:close', 'shift:view',
    'staff:manage', 'device:manage',
    'kitchen:view_queue', 'kitchen:update_status',
    'table:read', 'table:update',
  ],
  TABLET: [
    'order:create', 'order:read', 'order:update',
    'table:read', 'table:update',
    'customer:read', 'customer:create', 'menu:read',
  ],
};

export const DEVICE_FEATURES: Record<PosDeviceTypeV2, DeviceFeatures> = {
  CASHIER: {
    modules: ['pos-order', 'payment', 'receipt', 'bill-split', 'customer', 'menu-browser'],
    routes: ['/pos/order', '/pos/payment', '/pos/receipt', '/pos/bill-split', '/pos/customer'],
    hide: ['kitchen', 'admin', 'reports', 'inventory', 'staff'],
  },
  KITCHEN: {
    modules: ['kitchen-queue', 'order-timeline', 'cooking-status'],
    routes: ['/pos/kitchen-queue'],
    hide: ['payment', 'revenue', 'customer-management', 'admin', 'reports'],
  },
  WAITER: {
    modules: ['table-order', 'menu-browser', 'customer', 'order-cart'],
    routes: ['/pos/waiter-order'],
    hide: ['payment', 'kitchen', 'admin', 'reports', 'inventory'],
  },
  KIOSK: {
    modules: ['self-order', 'menu-browser', 'qr-payment'],
    routes: ['/pos/kiosk'],
    hide: ['payment-cash', 'admin', 'kitchen', 'reports'],
  },
  CUSTOMER_DISPLAY: {
    modules: ['order-display', 'kitchen-status'],
    routes: ['/pos/display'],
    hide: ['all-interactive'],
  },
  MANAGER: {
    modules: [
      'pos-order', 'payment', 'receipt', 'bill-split', 'customer',
      'kitchen-queue', 'reports', 'inventory', 'staff', 'menu-management',
      'shift', 'device-management',
    ],
    routes: [
      '/pos/order', '/pos/payment', '/pos/receipt', '/pos/bill-split',
      '/pos/customer', '/pos/kitchen-queue', '/pos/reports',
    ],
    hide: [],
  },
  TABLET: {
    modules: ['table-order', 'menu-browser', 'customer', 'order-cart'],
    routes: ['/pos/waiter-order'],
    hide: ['payment', 'kitchen', 'admin', 'reports', 'inventory'],
  },
};

export function getDeviceTypeLabel(type: PosDeviceTypeV2): string {
  const labels: Record<PosDeviceTypeV2, string> = {
    CASHIER: 'Thu ngân',
    KITCHEN: 'Bếp',
    WAITER: 'Phục vụ bàn',
    KIOSK: 'KIOSK tự đặt',
    CUSTOMER_DISPLAY: 'Màn hình khách',
    MANAGER: 'Quản lý',
    TABLET: 'Máy tính bảng',
  };
  return labels[type] || type;
}

export function getDeviceTypeIcon(type: PosDeviceTypeV2): string {
  const icons: Record<PosDeviceTypeV2, string> = {
    CASHIER: 'cash-register',
    KITCHEN: 'utensils-crossed',
    WAITER: 'notebook-pen',
    KIOSK: 'monitor',
    CUSTOMER_DISPLAY: 'tv',
    MANAGER: 'building-2',
    TABLET: 'tablet',
  };
  return icons[type] || 'smartphone';
}
