import type { PosMachineTemplate } from '../../app/types';

/**
 * Single source of truth: POS Machine Template → target route.
 *
 * CASHIER    → /app/order-queue  (Menu + Orders)
 * KITCHEN    → /app/order-queue  (Kitchen only)
 * BILLIARD   → /app/billiard
 * RESTAURANT → /app/restaurant
 * CUSTOM     → /app/order-queue  (fallback)
 */
export const POS_TEMPLATE_ROUTE: Record<PosMachineTemplate, string> = {
  CASHIER:    '/app/order-queue',
  KITCHEN:    '/app/order-queue',
  BILLIARD:   '/app/billiard',
  RESTAURANT: '/app/restaurant',
  CUSTOM:     '/app/order-queue',
};

/** Trả về route đích dựa trên template. Fallback về /app/order-queue. */
export function getRouteByTemplate(template: PosMachineTemplate | null | undefined): string {
  if (!template) return '/app/order-queue';
  return POS_TEMPLATE_ROUTE[template] ?? '/app/order-queue';
}

/**
 * Kiểm tra xem template có được phép truy cập route hiện tại không.
 * Dùng để redirect khi POS Machine truy cập sai route.
 *
 * @param template  - Template đang đăng nhập
 * @param pathname  - Route đang cố truy cập (e.g. '/app/order-queue')
 * @returns         - Route đúng nếu cần redirect, null nếu được phép
 */
export function getRedirectIfWrongRoute(
  template: PosMachineTemplate | null | undefined,
  pathname: string,
): string | null {
  if (!template) return null;

  const allowedRoute = getRouteByTemplate(template);

  // Cho phép nested routes (e.g. /app/billiard/layout)
  if (pathname.startsWith(allowedRoute)) return null;

  // Các template ORDER_QUEUE được phép ở /app/order-queue
  if (
    (template === 'CASHIER' || template === 'KITCHEN' || template === 'CUSTOM') &&
    pathname.startsWith('/app/order-queue')
  ) {
    return null;
  }

  return allowedRoute;
}
