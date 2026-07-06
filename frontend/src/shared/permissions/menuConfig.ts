import { APP_NAME } from '../constants';

export interface AppMenuItem {
  name: string;
  href: string;
  icon: string;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
}

export const APP_MENU: AppMenuItem[] = [
  {
    name: 'Tổng quan',
    children: [
      { name: 'Tổng quan', href: '/app', icon: 'LayoutDashboard', requiredPermission: 'DASHBOARD_VIEW' },
    ],
  },
  {
    name: 'Thực đơn',
    children: [
      { name: 'Thực đơn', href: '/app/menu', icon: 'UtensilsCrossed', requiredPermission: 'MENU_MANAGEMENT_VIEW' },
    ],
  },
  {
    name: 'Kho & Đơn hàng',
    children: [
      { name: 'Kho', href: '/app/inventory', icon: 'Package', requiredPermission: 'INVENTORY_VIEW' },
      { name: 'Lịch sử đơn hàng', href: '/app/orders/history', icon: 'Clock', requiredPermission: 'ORDER_HISTORY_VIEW' },
    ],
  },
  {
    name: 'Quản trị',
    children: [
      { name: 'Phân quyền', href: '/app/permissions', icon: 'Settings', requiredPermission: 'PERMISSION_VIEW' },
      { name: 'Chi nhánh', href: '/app/branch', icon: 'Building2', requiredPermission: 'BRANCH_VIEW' },
    ],
  },
  {
    name: 'Nhân viên',
    children: [
      { name: 'Nhân viên', href: '/app/staff', icon: 'Users', requiredPermission: 'STAFF_VIEW' },
    ],
  },
  {
    name: 'Bàn',
    children: [
      { name: 'Quản lý bàn bi-a', href: '/app/billiard', icon: 'CircleDot', requiredPermission: 'BILLIARD_TABLE_VIEW' },
      { name: 'Quản lý bàn nhà hàng', href: '/app/restaurant', icon: 'UtensilsCrossed', requiredPermission: 'RESTAURANT_TABLE_VIEW' },
    ],
  },
  {
    name: 'POS',
    children: [
      { name: 'Điều phối đơn hàng', href: '/app/order-queue', icon: 'ClipboardList', requiredPermission: 'POS_ORDER_QUEUE_VIEW' },
    ],
  },
];
