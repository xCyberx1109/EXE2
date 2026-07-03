import type { PosMachineTemplate } from '../../app/types';

/**
 * POS_TEMPLATE_PERMISSIONS
 * Single source of truth: TEMPLATE → permissions mapping.
 * Permissions control UI rendering, route guards, and API access.
 *
 * ⚠️  Keep in sync with backend: posMachine.service.js → POS_TEMPLATE_PERMISSIONS
 */
export const POS_TEMPLATE_PERMISSIONS: Record<PosMachineTemplate, string[]> = {
  // ── CASHIER ─────────────────────────────────────────────────────────────
  // Mục tiêu: Tạo/cập nhật/hủy đơn, thanh toán, xem menu, xem khách hàng, xem bàn
  CASHIER: [
    'ORDER_VIEW',
    'ORDER_CREATE',
    'ORDER_UPDATE',
    'POS_CREATE_ORDER',
    'POS_CANCEL_ORDER',
    'TABLE_VIEW',
    'TABLE_UPDATE',
    'MENU_VIEW',
    'CUSTOMER_VIEW',
    'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
    'POS_ORDER_QUEUE_VIEW',
    'POS_ORDER_QUEUE_CREATE',
    'POS_ORDER_QUEUE_UPDATE',
    'POS_ORDER_QUEUE_DELETE',
    'POS_ORDER_QUEUE_PAY',
  ],

  // ── KITCHEN ─────────────────────────────────────────────────────────────
  // Mục tiêu: Xem đơn cần làm, cập nhật trạng thái chế biến, xem menu
  KITCHEN: [
    'ORDER_VIEW',
    'MENU_VIEW',
    'POS_ORDER_QUEUE_VIEW',
    'POS_ORDER_QUEUE_UPDATE',
  ],

  // ── CASHIER_KITCHEN ──────────────────────────────────────────────────────
  // Kết hợp toàn bộ quyền CASHIER + KITCHEN (union, deduped)
  CASHIER_KITCHEN: [
    'ORDER_VIEW',
    'ORDER_CREATE',
    'ORDER_UPDATE',
    'POS_CREATE_ORDER',
    'POS_CANCEL_ORDER',
    'TABLE_VIEW',
    'TABLE_UPDATE',
    'MENU_VIEW',
    'CUSTOMER_VIEW',
    'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
    'POS_ORDER_QUEUE_VIEW',
    'POS_ORDER_QUEUE_CREATE',
    'POS_ORDER_QUEUE_UPDATE',
    'POS_ORDER_QUEUE_DELETE',
    'POS_ORDER_QUEUE_PAY',
  ],

  // ── BILLIARD ─────────────────────────────────────────────────────────────
  // Mục tiêu: Xem bàn, chọn bàn, chơi ngay, kết thúc phiên, thanh toán, gọi đồ, in hóa đơn
  // Không được phép: Thêm/Sửa/Xóa bàn, Chỉnh sửa bố cục, Thay đổi giá giờ
  BILLIARD: [
    'BILLIARD_TABLE_VIEW',
    'BILLIARD_SESSION_VIEW',
    'BILLIARD_SESSION_START',
    'BILLIARD_SESSION_CHECKIN',
    'BILLIARD_SESSION_FINISH',
    'BILLIARD_ORDER_VIEW',
    'BILLIARD_ORDER_CREATE',
    'BILLIARD_ORDER_UPDATE',
    'BILLIARD_ORDER_ADD_ITEM',
    'BILLIARD_PAY_VIEW',
    'BILLIARD_PAY_PROCESS',
    'MENU_VIEW',
    'CUSTOMER_VIEW',
    'CUSTOMER_CREATE',
  ],

  // ── RESTAURANT ───────────────────────────────────────────────────────────
  // Mục tiêu: Xem/mở/quản lý bàn nhà hàng, gọi món, cập nhật, thanh toán
  RESTAURANT: [
    'RESTAURANT_TABLE_VIEW',
    'RESTAURANT_TABLE_CREATE',
    'RESTAURANT_TABLE_UPDATE',
    'RESTAURANT_TABLE_LAYOUT_EDIT',
    'RESTAURANT_TABLE_TRANSFER',
    'RESTAURANT_TABLE_MERGE',
    'RESTAURANT_TABLE_SPLIT',
    'RESTAURANT_ORDER_VIEW',
    'RESTAURANT_ORDER_CREATE',
    'RESTAURANT_ORDER_UPDATE',
    'RESTAURANT_ORDER_ADD_ITEM',
    'RESTAURANT_PAY_VIEW',
    'RESTAURANT_PAY_PROCESS',
    'MENU_VIEW',
    'CUSTOMER_VIEW',
    'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
  ],

  CUSTOM: [],
};

/** Resolve permissions from template */
export function getPermissionsByTemplate(template: PosMachineTemplate): string[] {
  return POS_TEMPLATE_PERMISSIONS[template] || [];
}
