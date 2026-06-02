import { createElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { MenuManagement } from './pages/MenuManagement';
import { InventoryManagement } from './pages/InventoryManagement';
import { RevenueManagement } from './pages/RevenueManagement';
import { MenuQR } from "./pages/QRMenu";
import { LoginPage } from './pages/LoginPage';
import { BranchManagement } from './pages/BranchManagement';
import { ProfilePage } from './pages/ProfilePage';
import { PermissionManagement } from './pages/PermissionManagement';
import { PosV2Dashboard } from './pages/PosV2Dashboard';
import { PosDeviceManagerPage } from './pages/PosDeviceManagerPage';
import { TableManagement } from './pages/TableManagement';

// === Device-Aware POS Modules ===
import { ProtectedRoute } from '../shared/permissions/ProtectedRoute';
import { PosLayout } from '../modules/pos/PosLayout';
import { KitchenQueue } from '../modules/kitchen/KitchenQueue';
import { CashierPOS } from '../modules/cashier/CashierPOS';
import { WaiterPOS } from '../modules/waiter/WaiterPOS';
import { KioskPOS } from '../modules/kiosk/KioskPOS';
import { CustomerDisplay } from '../modules/customerDisplay/CustomerDisplay';

import { useAuth } from './context/AuthContext';
import type { PosDeviceTypeV2, DevicePermission } from '../shared/types/pos';

function getAccountRedirectPath(user: { permissions?: string[]; role: string }): string {
  const perms = user.permissions || [];
  if (perms.includes('BRANCH_VIEW') || perms.includes('REPORT_VIEW')) {
    return '/app';
  }
  if (perms.includes('POS_CREATE_ORDER') || perms.includes('POS_OPEN')) {
    return '/pos/order';
  }
  return '/app';
}

const DEVICE_ROUTES: Record<string, string> = {
  CASHIER: '/pos/order',
  KITCHEN: '/pos/kitchen-queue',
  WAITER: '/pos/waiter-order',
  KIOSK: '/pos/kiosk',
  CUSTOMER_DISPLAY: '/pos/display',
  MANAGER: '/pos/order',
};

function RootRedirect() {
  const auth = useAuth();
  
  if (!auth.isReady) {
    return createElement('div', {
      className: 'min-h-screen flex items-center justify-center bg-gray-50 text-gray-500',
      children: [
        createElement(Loader2, { className: 'w-8 h-8 animate-spin mr-2', key: 'spinner' }),
        'Đang kết nối server...',
      ],
    });
  }

  if (!auth.isAuthenticated) {
    return createElement(Navigate, { to: '/login', replace: true });
  }

  if (auth.authMode === 'account' && auth.user) {
    return createElement(Navigate, { to: getAccountRedirectPath(auth.user), replace: true });
  }

  if (auth.authMode === 'device' && auth.deviceInfo) {
    return createElement(Navigate, { to: DEVICE_ROUTES[auth.deviceInfo.type] || '/pos-v2/dashboard', replace: true });
  }

  return createElement(Navigate, { to: '/login', replace: true });
}

function PosModule() {
  return createElement(PosLayout);
}

const deviceRouteConfig = {
  CASHIER: { types: ['CASHIER' as const], perms: ['order:create' as const], rbacPerms: ['POS_CREATE_ORDER'] },
  KITCHEN: { types: ['KITCHEN' as const], perms: ['kitchen:view_queue' as const], rbacPerms: ['POS_OPEN'] },
  WAITER: { types: ['WAITER' as const, 'TABLET' as const], perms: ['order:create' as const], rbacPerms: ['POS_CREATE_ORDER'] },
  KIOSK: { types: ['KIOSK' as const], perms: ['order:create' as const] },
  DISPLAY: { types: ['CUSTOMER_DISPLAY' as const], perms: ['order:read' as const] },
  REPORTS: { types: ['MANAGER' as const], perms: ['reports:read' as const], rbacPerms: ['REPORT_VIEW'] },
};

function withGuard(
  Component: React.ComponentType,
  config: {
    types?: PosDeviceTypeV2[];
    perms?: DevicePermission[];
    moduleName?: string;
    rbacPerms?: string[];
  }
) {
  return createElement(ProtectedRoute, {
    allowedTypes: config.types,
    requiredPermissions: config.perms,
    requiredRBACPermissions: config.rbacPerms,
    moduleName: config.moduleName,
    children: createElement(Component),
  });
}

export const router = createBrowserRouter([
  {
    path: '/qrmenu',
    Component: MenuQR,
  },
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/pos-v2/dashboard',
    Component: PosV2Dashboard,
  },
  // === POS Routes (supports device + account CASHIER/KITCHEN) ===
  {
    path: '/pos',
    Component: PosModule,
    children: [
      { index: true, element: createElement(Navigate, { to: '/pos-v2/dashboard', replace: true }) },
      // Cashier routes
      { path: 'order', element: withGuard(CashierPOS, deviceRouteConfig.CASHIER) },
      { path: 'payment', element: withGuard(CashierPOS, { types: ['CASHIER', 'MANAGER'], perms: ['payment:process'], rbacPerms: ['POS_CREATE_ORDER'] }) },
      { path: 'receipt', element: withGuard(CashierPOS, { types: ['CASHIER', 'MANAGER'], perms: ['receipt:print'], rbacPerms: ['POS_CREATE_ORDER'] }) },
      { path: 'bill-split', element: withGuard(CashierPOS, { types: ['CASHIER', 'MANAGER'], perms: ['bill:split'], rbacPerms: ['POS_CREATE_ORDER'] }) },
      { path: 'customer', element: withGuard(CashierPOS, { types: ['CASHIER', 'WAITER', 'MANAGER'], perms: ['customer:read'], rbacPerms: ['POS_CREATE_ORDER'] }) },
      // Kitchen routes
      { path: 'kitchen-queue', element: withGuard(KitchenQueue, deviceRouteConfig.KITCHEN) },
      { path: 'kitchen-timeline', element: withGuard(KitchenQueue, { types: ['KITCHEN', 'MANAGER'], perms: ['kitchen:view_queue'], rbacPerms: ['POS_OPEN'], moduleName: 'order-timeline' }) },
      // Waiter routes
      { path: 'waiter-order', element: withGuard(WaiterPOS, deviceRouteConfig.WAITER) },
      { path: 'waiter-menu', element: withGuard(WaiterPOS, { types: ['WAITER', 'TABLET', 'CASHIER'], perms: ['menu:read'] }) },
      // Kiosk routes
      { path: 'kiosk', element: withGuard(KioskPOS, deviceRouteConfig.KIOSK) },
      // Customer display
      { path: 'display', element: withGuard(CustomerDisplay, deviceRouteConfig.DISPLAY) },
      // Manager reports
      { path: 'reports', element: withGuard(CashierPOS, deviceRouteConfig.REPORTS) },
    ],
  },
  // Redirect old POS routes
  {
    path: '/pos-v2/setup',
    element: createElement(Navigate, { to: '/login', replace: true }),
  },
  {
    path: '/pos-v2/login',
    element: createElement(Navigate, { to: '/login', replace: true }),
  },
  {
    path: '/pos/login',
    element: createElement(Navigate, { to: '/login', replace: true }),
  },
  {
    path: '/pos/dashboard',
    element: createElement(Navigate, { to: '/pos-v2/dashboard', replace: true }),
  },
  {
    path: '/pos/setup',
    element: createElement(Navigate, { to: '/login', replace: true }),
  },
  {
    path: '/',
    Component: RootRedirect,
  },
  // Admin/Manager pages (protected by Layout)
  {
    path: '/app',
    Component: Layout,
    children: [
      { index: true, element: withGuard(Dashboard, { rbacPerms: ['REPORT_VIEW'] }) },
      { path: 'branches', element: withGuard(BranchManagement, { rbacPerms: ['BRANCH_VIEW'] }) },
      { path: 'pos-devices', element: createElement(Navigate, { to: '/app/pos-devices-v2', replace: true }) },
      { path: 'pos-devices-v2', element: withGuard(PosDeviceManagerPage, { rbacPerms: ['POS_DEVICE_VIEW'] }) },
      { path: 'menu', element: withGuard(MenuManagement, { rbacPerms: ['MENU_MANAGE'] }) },
      { path: 'inventory', element: withGuard(InventoryManagement, { rbacPerms: ['INVENTORY_VIEW'] }) },
      { path: 'revenue', element: withGuard(RevenueManagement, { rbacPerms: ['REPORT_VIEW'] }) },
      { path: 'staff', element: withGuard(() => createElement('div', null, 'Staff Management - Coming Soon'), { rbacPerms: ['STAFF_VIEW'] }) },
      { path: 'permissions', element: withGuard(PermissionManagement, { rbacPerms: ['PERMISSION_VIEW'] }) },
      { path: 'tables', element: withGuard(TableManagement, { rbacPerms: ['TABLE_VIEW'] }) },
      { path: 'profile', Component: ProfilePage },
    ],
  },
]);