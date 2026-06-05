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
      { name: 'Đơn hàng', href: '/app/orders', icon: 'ClipboardList', requiredPermission: 'ORDER_VIEW' },
      { name: 'Lịch sử đơn hàng', href: '/app/orders/history', icon: 'Clock', requiredPermission: 'ORDER_HISTORY_VIEW' },
      { name: 'Bàn', href: '/app/tables', icon: 'MapPin', requiredPermission: 'TABLE_VIEW' },
      { name: 'Khách hàng', href: '/app/customers', icon: 'Users', requiredPermission: 'CUSTOMER_VIEW' },
    ],
  },
  {
    name: 'Báo cáo',
    children: [
      { name: 'Doanh thu', href: '/app/revenue', icon: 'TrendingUp', requiredPermission: 'REVENUE_VIEW' },
    ],
  },
  {
    name: 'Quản trị',
    children: [
      { name: 'Phân quyền', href: '/app/permissions', icon: 'Settings', requiredPermission: 'PERMISSION_VIEW' },
      { name: 'Tính năng', href: '/app/features', icon: 'ChefHat', requiredPermission: 'FEATURE_VIEW' },
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
    name: 'POS',
    children: [
      { name: `${APP_NAME} Order Queue`, href: '/app/order-queue', icon: 'ClipboardList', requiredPermission: 'POS_ORDER_QUEUE_VIEW' },
    ],
  },
];
