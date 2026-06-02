import type { AccountRole } from '../../app/types';

export type { AccountRole } from '../../app/types';

export interface AppMenuItem {
  name: string;
  href: string;
  icon: string;
  permission?: string;
}

export const APP_MENU: AppMenuItem[] = [
  { name: 'Tổng quan', href: '/app', icon: 'LayoutDashboard', permission: 'REPORT_VIEW' },
  { name: 'Thiết bị POS', href: '/app/pos-devices-v2', icon: 'Smartphone', permission: 'POS_DEVICE_VIEW' },
  { name: 'Quản lý Menu', href: '/app/menu', icon: 'UtensilsCrossed', permission: 'MENU_MANAGE' },
  { name: 'Tồn kho', href: '/app/inventory', icon: 'Package', permission: 'INVENTORY_VIEW' },
  { name: 'Quản lý nhân viên', href: '/app/staff', icon: 'Users', permission: 'STAFF_VIEW' },
  { name: 'Phân quyền', href: '/app/permissions', icon: 'Shield', permission: 'PERMISSION_VIEW' },
  { name: 'Quản lý Chi nhánh', href: '/app/branches', icon: 'MapPin', permission: 'BRANCH_VIEW' },
  { name: 'Quản lý bàn', href: '/app/tables', icon: 'Grid3X3', permission: 'TABLE_VIEW' },
];

// Remove legacy MENU_BY_ROLE as we use account-based permissions now
export const MENU_BY_ROLE = {};