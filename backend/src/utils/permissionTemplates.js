export const PERMISSION_TEMPLATES = {
  CASHIER: {
    name: 'Thu ngân',
    permissionCodes: [
      'POS_OPEN', 'POS_CLOSE',
      'POS_CANCEL_ORDER',
      'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_DELETE', 'POS_ORDER_QUEUE_PAY',
      'TABLE_VIEW',
      'ORDER_CREATE', 'ORDER_UPDATE',
    ],
  },
  KITCHEN: {
    name: 'Bếp',
    permissionCodes: [
      'ORDER_VIEW',
    ],
  },
  RESTAURANT: {
    name: 'Nhà hàng',
    permissionCodes: [
      'RESTAURANT_TABLE_VIEW',
      'RESTAURANT_TABLE_TRANSFER', 'RESTAURANT_TABLE_MERGE', 'RESTAURANT_TABLE_SPLIT',
      'RESTAURANT_ORDER_VIEW', 'RESTAURANT_ORDER_CREATE',
      'RESTAURANT_ORDER_UPDATE', 'RESTAURANT_ORDER_ADD_ITEM',
      'RESTAURANT_PAY_VIEW', 'RESTAURANT_PAY_PROCESS',
    ],
  },
  BILLIARD: {
    name: 'Bida',
    permissionCodes: [
      'BILLIARD_TABLE_VIEW',
      'BILLIARD_SESSION_VIEW', 'BILLIARD_SESSION_START', 'BILLIARD_SESSION_CHECKIN',
      'BILLIARD_SESSION_FINISH',
      'BILLIARD_RESERVATION_VIEW', 'BILLIARD_RESERVATION_CREATE', 'BILLIARD_RESERVATION_CANCEL',
      'BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE',
      'BILLIARD_ORDER_DELETE',
      'BILLIARD_PAY_VIEW', 'BILLIARD_PAY_PROCESS',
    ],
  },
  WAREHOUSE_STAFF: {
    name: 'Nhân viên kho',
    permissionCodes: [
      'INVENTORY_VIEW',
      'INVENTORY_IMPORT',
      'INVENTORY_EXPORT',
    ],
  },
};

export function getTemplateNames() {
  return Object.entries(PERMISSION_TEMPLATES).map(([key, tpl]) => ({
    key,
    name: tpl.name,
    permissionCodes: tpl.permissionCodes,
  }));
}

export function getPermissionsForTemplates(templateKeys) {
  const codeSet = new Set();
  for (const key of templateKeys) {
    const tpl = PERMISSION_TEMPLATES[key];
    if (tpl) {
      for (const code of tpl.permissionCodes) {
        codeSet.add(code);
      }
    }
  }
  return [...codeSet];
}
