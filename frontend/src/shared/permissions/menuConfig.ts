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
    name: 'Dashboard',
    children: [
      { name: 'Tổng quan', href: '/app', icon: 'LayoutDashboard', requiredPermission: 'DASHBOARD_VIEW' },
    ],
  },
  {
    name: 'Thực đơn',
    children: [
      { name: 'Menu', href: '/app/menu', icon: 'UtensilsCrossed', requiredPermission: 'MENU_VIEW' },
      { name: 'Categories', href: '/app/categories', icon: 'Grid3X3', requiredPermission: 'CATEGORY_VIEW' },
    ],
  },
  {
    name: 'Kho & Đơn hàng',
    children: [
      { name: 'Kho', href: '/app/inventory', icon: 'Package', requiredPermission: 'INVENTORY_VIEW' },
      { name: 'Lịch sử đơn hàng', href: '/app/orders/history', icon: 'Clock', requiredPermission: 'ORDER_HISTORY_VIEW' },
      { name: 'Khách hàng', href: '/app/customers', icon: 'Users', requiredPermission: 'CUSTOMER_VIEW' },
    ],
  },
  {
    name: 'Quản trị',
    children: [
      { name: 'Phân quyền', href: '/app/permissions', icon: 'Settings', requiredPermission: 'PERMISSION_VIEW' },
      { name: 'Branch Management', href: '/app/branch', icon: 'Building2', requiredPermission: 'BRANCH_VIEW' },
    ],
  },
  {
    name: 'Thiết bị',
    children: [
      { name: 'Thiết bị POS', href: '/app/pos-devices-v2', icon: 'Smartphone', requiredPermission: 'POS_DEVICE_VIEW' },
    ],
  },
  {
    name: 'Bi-a',
    children: [
      { name: 'Quản lý bàn bi-a', href: '/app/billiard', icon: 'CircleDot', requiredPermission: 'BILLIARD_TABLE_VIEW' },
    ],
  },
  {
    name: 'POS',
    children: [
      { name: 'Order Queue', href: '/app/order-queue', icon: 'ClipboardList', requiredPermission: 'POS_ORDER_QUEUE_VIEW' },
    ],
  },
];
