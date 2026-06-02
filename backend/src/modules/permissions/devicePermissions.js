export const PosDeviceType = Object.freeze({
  CASHIER: 'CASHIER',
  KITCHEN: 'KITCHEN',
  WAITER: 'WAITER',
  KIOSK: 'KIOSK',
  CUSTOMER_DISPLAY: 'CUSTOMER_DISPLAY',
  MANAGER: 'MANAGER',
  TABLET: 'TABLET',
});

export const DEVICE_PERMISSIONS = Object.freeze({
  [PosDeviceType.CASHIER]: [
    'order:create',
    'order:read',
    'order:update',
    'order:cancel',
    'payment:process',
    'payment:refund',
    'receipt:print',
    'bill:split',
    'bill:print',
    'customer:create',
    'customer:read',
    'menu:read',
    'table:read',
    'table:update',
    'shift:open',
    'shift:close',
    'shift:view',
  ],
  [PosDeviceType.KITCHEN]: [
    'kitchen:view_queue',
    'kitchen:update_status',
    'order:read',
    'kot:read',
    'kot:update',
    'menu:read',
  ],
  [PosDeviceType.WAITER]: [
    'order:create',
    'order:read',
    'order:update',
    'table:read',
    'table:update',
    'customer:read',
    'customer:create',
    'menu:read',
  ],
  [PosDeviceType.KIOSK]: [
    'order:create',
    'menu:read',
    'payment:qr',
    'customer:create',
  ],
  [PosDeviceType.CUSTOMER_DISPLAY]: [
    'order:read',
    'kitchen:view_status',
  ],
  [PosDeviceType.MANAGER]: [
    'order:create',
    'order:read',
    'order:update',
    'order:cancel',
    'payment:process',
    'payment:refund',
    'receipt:print',
    'bill:split',
    'bill:print',
    'customer:create',
    'customer:read',
    'customer:update',
    'menu:create',
    'menu:read',
    'menu:update',
    'inventory:read',
    'inventory:update',
    'reports:read',
    'shift:open',
    'shift:close',
    'shift:view',
    'staff:manage',
    'kitchen:view_queue',
    'kitchen:update_status',
    'table:read',
    'table:update',
    'device:manage',
  ],
  [PosDeviceType.TABLET]: [
    'order:create',
    'order:read',
    'order:update',
    'table:read',
    'table:update',
    'customer:read',
    'customer:create',
    'menu:read',
  ],
});

export const DEVICE_FEATURES = Object.freeze({
  [PosDeviceType.CASHIER]: {
    modules: ['pos-order', 'payment', 'receipt', 'bill-split', 'customer', 'menu-browser'],
    routes: ['/pos/order', '/pos/payment', '/pos/receipt', '/pos/bill-split', '/pos/customer'],
    hide: ['kitchen', 'admin', 'reports', 'inventory', 'staff'],
  },
  [PosDeviceType.KITCHEN]: {
    modules: ['kitchen-queue', 'order-timeline', 'cooking-status'],
    routes: ['/pos/kitchen-queue'],
    hide: ['payment', 'revenue', 'customer-management', 'admin', 'reports'],
  },
  [PosDeviceType.WAITER]: {
    modules: ['table-order', 'menu-browser', 'customer', 'order-cart'],
    routes: ['/pos/waiter-order'],
    hide: ['payment', 'kitchen', 'admin', 'reports', 'inventory'],
  },
  [PosDeviceType.KIOSK]: {
    modules: ['self-order', 'menu-browser', 'qr-payment'],
    routes: ['/pos/kiosk'],
    hide: ['payment-cash', 'admin', 'kitchen', 'reports'],
  },
  [PosDeviceType.CUSTOMER_DISPLAY]: {
    modules: ['order-display', 'kitchen-status'],
    routes: ['/pos/display'],
    hide: ['all-interactive'],
  },
  [PosDeviceType.MANAGER]: {
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
  [PosDeviceType.TABLET]: {
    modules: ['table-order', 'menu-browser', 'customer', 'order-cart'],
    routes: ['/pos/waiter-order'],
    hide: ['payment', 'kitchen', 'admin', 'reports', 'inventory'],
  },
});

export function getPermissionsForDeviceType(deviceType) {
  return DEVICE_PERMISSIONS[deviceType] || [];
}

export function getFeaturesForDeviceType(deviceType) {
  return DEVICE_FEATURES[deviceType] || { modules: [], routes: [], hide: [] };
}

export function getEnabledFeaturesForDeviceType(deviceType) {
  const features = DEVICE_FEATURES[deviceType];
  if (!features) return [];
  return features.modules;
}

export function hasPermission(deviceType, permission) {
  const perms = DEVICE_PERMISSIONS[deviceType];
  if (!perms) return false;
  return perms.includes(permission);
}

export function hasAnyPermission(deviceType, permissions) {
  return permissions.some((p) => hasPermission(deviceType, p));
}

export function hasAllPermissions(deviceType, permissions) {
  return permissions.every((p) => hasPermission(deviceType, p));
}

export function getDeviceCapabilities(deviceType) {
  return {
    permissions: getPermissionsForDeviceType(deviceType),
    features: getFeaturesForDeviceType(deviceType),
    enabledFeatures: getEnabledFeaturesForDeviceType(deviceType),
  };
}
