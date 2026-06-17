import { createElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { MenuManagement } from './pages/MenuManagement';
import { InventoryManagement } from './pages/InventoryManagement';
import { MenuQR } from "./pages/QRMenu";
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { BranchManagement } from './pages/BranchManagement';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { PermissionManagement } from './pages/PermissionManagement';
import { PosV2Dashboard } from './pages/PosV2Dashboard';
import { PosDeviceManagerPage } from './pages/PosDeviceManagerPage';
import NotFound from '../pages/NotFound';

// === Device-Aware POS Modules ===
import { ProtectedRoute } from '../shared/permissions/ProtectedRoute';
import { PosLayout } from '../modules/pos/PosLayout';
import { KitchenQueue } from '../modules/kitchen/KitchenQueue';
import { CashierPOS } from '../modules/cashier/CashierPOS';
import { WaiterPOS } from '../modules/waiter/WaiterPOS';
import { KioskPOS } from '../modules/kiosk/KioskPOS';
import { CustomerDisplay } from '../modules/customerDisplay/CustomerDisplay';
import { OrderQueuePOS } from './pages/OrderQueuePOS';
import { CategoryManagement } from './pages/CategoryManagement';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { BilliardManagement } from './pages/BilliardManagement';
import { BilliardLayout } from './pages/BilliardLayout';

import { useAuth } from './context/AuthContext';
import type { PosDeviceTypeV2, DevicePermission } from '../shared/types/pos';

function RootRedirect() {
  const auth = useAuth();

  if (!auth.isReady) return null;

  if (!auth.isAuthenticated) {
    return createElement(Navigate, { to: '/login', replace: true });
  }

  if (auth.authMode === 'account' && auth.user) {
    return createElement(Navigate, { to: '/app', replace: true });
  }

  if (auth.authMode === 'device' && auth.deviceInfo) {
    const DEVICE_ROUTES: Record<string, string> = {
      CASHIER: '/pos/order-queue',
      KITCHEN: '/pos/kitchen-queue',
      WAITER: '/pos/waiter-order',
      KIOSK: '/pos/kiosk',
      CUSTOMER_DISPLAY: '/pos/display',
      MANAGER: '/pos/order-queue',
    };
    return createElement(Navigate, { to: DEVICE_ROUTES[auth.deviceInfo.type] || '/pos-v2/dashboard', replace: true });
  }

  return createElement(Navigate, { to: '/login', replace: true });
}

const deviceRouteConfig = {
  CASHIER: {
    types: ['CASHIER' as const],
    perms: ['order:create' as const],
    rbacPerms: ['ORDER_CREATE' as const]
  },

  KITCHEN: {
    types: ['KITCHEN' as const],
    perms: ['kitchen:view_queue' as const],
    rbacPerms: ['kitchen:view_queue' as const]
  },

  WAITER: {
    types: ['WAITER' as const, 'TABLET' as const],
    perms: ['POS_CREATE_ORDER' as const],
    rbacPerms: ['POS_CREATE_ORDER' as const]
  },

  KIOSK: {
    types: ['KIOSK' as const],
    perms: ['POS_CREATE_ORDER' as const],
    rbacPerms: ['POS_CREATE_ORDER' as const]
  },

  DISPLAY: {
    types: ['CUSTOMER_DISPLAY' as const],
    perms: ['POS_CREATE_ORDER' as const],
  },

  REPORTS: {
    types: ['MANAGER' as const],
    perms: ['REPORT_VIEW' as const],
    rbacPerms: ['REPORT_VIEW' as const]
  },
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

// POS Module wrapper
function PosModule() {
  return createElement(PosLayout);
}

export const router = createBrowserRouter([
  {
    errorElement: createElement(NotFound),
    children: [
      {
        path: '/qrmenu',
        Component: MenuQR,
      },
      {
        path: '/login',
        Component: LoginPage,
      },
      {
        path: '/forgot-password',
        Component: ForgotPasswordPage,
      },
      {
        path: '/reset-password',
        Component: ResetPasswordPage,
      },
      {
        path: '/set-password',
        Component: SetPasswordPage,
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
          { path: 'payment', element: withGuard(CashierPOS, { types: ['CASHIER', 'MANAGER'], perms: ['payment:process'], rbacPerms: ['payment:collect'] }) },
          { path: 'receipt', element: withGuard(CashierPOS, { types: ['CASHIER', 'MANAGER'], perms: ['receipt:print'], rbacPerms: ['payment:collect'] }) },
          { path: 'bill-split', element: withGuard(CashierPOS, { types: ['CASHIER', 'MANAGER'], perms: ['bill:split'], rbacPerms: ['payment:collect'] }) },
          { path: 'customer', element: withGuard(CashierPOS, { types: ['CASHIER', 'WAITER', 'MANAGER'], perms: ['customer:read'], rbacPerms: ['customer:view'] }) },
          // Order Queue POS
          { path: 'order-queue', element: withGuard(OrderQueuePOS, { rbacPerms: ['POS_ORDER_QUEUE_VIEW'] }) },
          // Kitchen routes
          { path: 'kitchen-queue', element: withGuard(KitchenQueue, deviceRouteConfig.KITCHEN) },
          { path: 'kitchen-timeline', element: withGuard(KitchenQueue, { types: ['KITCHEN', 'MANAGER'], perms: ['kitchen:view_queue'], rbacPerms: ['kitchen:view_queue'], moduleName: 'order-timeline' }) },
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
          { index: true, element: withGuard(Dashboard, { rbacPerms: ['DASHBOARD_VIEW'] }) },
          { path: 'branch', element: withGuard(BranchManagement, { rbacPerms: ['BRANCH_VIEW'] }) },
          { path: 'categories', element: withGuard(CategoryManagement, { rbacPerms: ['CATEGORY_VIEW'] }) },
          { path: 'pos-devices', element: createElement(Navigate, { to: '/app/pos-devices-v2', replace: true }) },
          { path: 'pos-devices-v2', element: withGuard(PosDeviceManagerPage, { rbacPerms: ['POS_DEVICE_VIEW'] }) },
          { path: 'menu', element: withGuard(MenuManagement, { rbacPerms: ['MENU_VIEW'] }) },
          { path: 'inventory', element: withGuard(InventoryManagement, { rbacPerms: ['INVENTORY_VIEW'] }) },
          { path: 'staff', element: withGuard(() => createElement('div', null, 'Quản lý nhân viên - Sắp ra mắt'), { rbacPerms: ['SETTINGS_VIEW'] }) },
          { path: 'settings', element: withGuard(() => createElement('div', null, 'Cài đặt hệ thống - Sắp ra mắt'), { rbacPerms: ['SETTINGS_VIEW'] }) },
          { path: 'permissions', element: withGuard(PermissionManagement, { rbacPerms: ['PERMISSION_VIEW'] }) },
          { path: 'order-queue', element: withGuard(OrderQueuePOS, { rbacPerms: ['POS_ORDER_QUEUE_VIEW'] }) },
          { path: 'orders/history', element: withGuard(OrderHistoryPage, { rbacPerms: ['ORDER_HISTORY_VIEW'] }) },
          { path: 'orders/:orderId', element: withGuard(OrderDetailPage, { rbacPerms: ['ORDER_HISTORY_VIEW'] }) },
          { path: 'billiard', element: withGuard(BilliardManagement, { rbacPerms: ['BILLIARD_TABLE_VIEW'] }) },
          { path: 'billiard/layout', element: withGuard(BilliardLayout, { rbacPerms: ['BILLIARD_TABLE_LAYOUT_EDIT'] }) },
          { path: 'profile', Component: ProfilePage },
        ],
      },
      { path: '*', element: createElement(NotFound) },
    ],
  },
]);