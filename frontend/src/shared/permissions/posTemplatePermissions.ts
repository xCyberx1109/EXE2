import type { PosMachineTemplate } from '../../app/types';

/**
 * POS_TEMPLATE_PERMISSIONS
 * Single source of truth: TEMPLATE → permissions mapping.
 * Permissions control UI rendering, route guards, and API access.
 */
export const POS_TEMPLATE_PERMISSIONS: Record<PosMachineTemplate, string[]> = {
  CASHIER: [
    'ORDER_VIEW',
    'ORDER_CREATE',
    'ORDER_UPDATE',
    'POS_CREATE_ORDER',
    'POS_CANCEL_ORDER',
    'TABLE_VIEW',
    'TABLE_UPDATE',
    'CUSTOMER_VIEW',
    'CUSTOMER_CREATE',
  ],
  KITCHEN: [
    'ORDER_VIEW',
    'MENU_VIEW',
    'POS_ORDER_QUEUE_VIEW',
    'POS_ORDER_QUEUE_UPDATE',
  ],
  CASHIER_KITCHEN: [
    'ORDER_VIEW',
    'ORDER_CREATE',
    'ORDER_UPDATE',
    'POS_CREATE_ORDER',
    'POS_CANCEL_ORDER',
    'POS_ORDER_QUEUE_VIEW',
    'POS_ORDER_QUEUE_CREATE',
    'POS_ORDER_QUEUE_UPDATE',
    'POS_ORDER_QUEUE_PAY',
    'TABLE_VIEW',
    'TABLE_UPDATE',
    'CUSTOMER_VIEW',
    'CUSTOMER_CREATE',
  ],
  BILLIARD: [
    'BILLIARD_TABLE_VIEW',
    'BILLIARD_SESSION_VIEW',
    'BILLIARD_SESSION_START',
    'BILLIARD_SESSION_CHECKIN',
    'BILLIARD_SESSION_EXTEND',
    'BILLIARD_SESSION_FINISH',
    'BILLIARD_ORDER_VIEW',
    'BILLIARD_ORDER_CREATE',
    'BILLIARD_ORDER_UPDATE',
    'BILLIARD_ORDER_ADD_ITEM',
    'BILLIARD_PAY_VIEW',
    'BILLIARD_PAY_PROCESS',
    'RESTAURANT_TABLE_VIEW',
    'TABLE_VIEW',
    'CUSTOMER_VIEW',
    'CUSTOMER_CREATE',
  ],
  CUSTOM: [],
};

/** Resolve permissions from template */
export function getPermissionsByTemplate(template: PosMachineTemplate): string[] {
  return POS_TEMPLATE_PERMISSIONS[template] || [];
}
