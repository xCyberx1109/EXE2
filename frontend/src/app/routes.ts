import { createElement, Fragment } from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
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
import { PosDeviceManagerPage } from './pages/PosDeviceManagerPage';
import { PosMachineLoginPage } from './pages/PosMachineLoginPage';
import NotFound from '../pages/NotFound';

import { ProtectedRoute } from '../shared/permissions/ProtectedRoute';
import { OrderQueuePOS } from './pages/OrderQueuePOS';
import { CategoryManagement } from './pages/CategoryManagement';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { BilliardManagement } from './pages/BilliardManagement';
import { BilliardLayout } from './pages/BilliardLayout';
import { RestaurantManagement } from './pages/RestaurantManagement';

import { useAuth } from './context/AuthContext';
import { getRouteByTemplate, getRedirectIfWrongRoute } from '../shared/permissions/posTemplateRoutes';
import type { PosDeviceTypeV2, DevicePermission } from '../shared/types/pos';
import type { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// RootRedirect: điều hướng từ "/" theo auth state + template
// ─────────────────────────────────────────────────────────────────────────────
function RootRedirect() {
  const auth = useAuth();

  if (!auth.isReady) return null;

  if (!auth.isAuthenticated) {
    return createElement(Navigate, { to: '/login', replace: true });
  }

  if (auth.authMode === 'account' && auth.user) {
    return createElement(Navigate, { to: '/app', replace: true });
  }

  if (auth.authMode === 'device') {
    return createElement(Navigate, { to: '/pos-machine/login', replace: true });
  }

  if (auth.authMode === 'pos_machine' && auth.posMachineInfo) {
    const route = getRouteByTemplate(auth.posMachineTemplate);
    return createElement(Navigate, { to: route, replace: true });
  }

  return createElement(Navigate, { to: '/login', replace: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// PosTemplateGuard: kiểm tra template có được phép ở route hiện tại không
// Nếu sai template → redirect về route đúng
// Nếu không phải POS Machine mode → pass through (account user không bị chặn)
// ─────────────────────────────────────────────────────────────────────────────
function PosTemplateGuard({ children }: { children: ReactNode }) {
  const { authMode, posMachineTemplate } = useAuth();
  const location = useLocation();

  // Chỉ áp dụng cho POS Machine mode
  if (authMode !== 'pos_machine' || !posMachineTemplate) {
    return createElement(Fragment, null, children);
  }

  const redirect = getRedirectIfWrongRoute(posMachineTemplate, location.pathname);
  if (redirect) {
    console.log('[PosTemplateGuard] template:', posMachineTemplate, '→ wrong route', location.pathname, '→ redirect to', redirect);
    return createElement(Navigate, { to: redirect, replace: true });
  }

  return createElement(Fragment, null, children);
}

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

/** Wrap component với cả ProtectedRoute (RBAC) và PosTemplateGuard (template routing) */
function withPosGuard(
  Component: React.ComponentType,
  config: { rbacPerms?: string[] }
) {
  return createElement(
    PosTemplateGuard,
    null,
    createElement(ProtectedRoute, {
      requiredRBACPermissions: config.rbacPerms,
      children: createElement(Component),
    })
  );
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
        path: '/pos-machine/login',
        Component: PosMachineLoginPage,
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
          { path: 'order-queue', element: withPosGuard(OrderQueuePOS, { rbacPerms: ['POS_ORDER_QUEUE_VIEW'] }) },
          { path: 'orders/history', element: withGuard(OrderHistoryPage, { rbacPerms: ['ORDER_HISTORY_VIEW'] }) },
          { path: 'orders/:orderId', element: withGuard(OrderDetailPage, { rbacPerms: ['ORDER_HISTORY_VIEW'] }) },
          { path: 'billiard', element: withPosGuard(BilliardManagement, { rbacPerms: ['BILLIARD_TABLE_VIEW'] }) },
          { path: 'billiard/layout', element: withGuard(BilliardLayout, { rbacPerms: ['BILLIARD_TABLE_LAYOUT_EDIT'] }) },
          { path: 'restaurant', element: withPosGuard(RestaurantManagement, { rbacPerms: ['RESTAURANT_TABLE_VIEW'] }) },
          { path: 'profile', Component: ProfilePage },
        ],
      },
      { path: '*', element: createElement(NotFound) },
    ],
  },
]);
