import { createElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { WorkspaceLayout } from './components/WorkspaceLayout';
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
import { PosMachineLoginPage } from './pages/PosMachineLoginPage';
import NotFound from '../pages/NotFound';

import { ProtectedRoute } from '../shared/permissions/ProtectedRoute';
import { OrderQueuePOS } from './pages/OrderQueuePOS';
import { CategoryManagement } from './pages/CategoryManagement';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { BilliardManagement } from './pages/BilliardManagement';
import { BilliardLayout } from './pages/BilliardLayout';
import { RestaurantManagement } from './pages/RestaurantManagement';

import { useAuth } from './context/AuthContext';
import { APP_MENU } from '../shared/permissions/menuConfig';

// ─────────────────────────────────────────────────────────────────────────────
// RootRedirect: điều hướng từ "/" theo auth state
// ─────────────────────────────────────────────────────────────────────────────
function RootRedirect() {
  const auth = useAuth();

  if (!auth.isReady) return null;

  if (!auth.isAuthenticated) {
    return createElement(Navigate, { to: '/login', replace: true });
  }

  // Employee: redirect to first module they have access to
  if (auth.isEmployeeMode) {
    for (const group of APP_MENU) {
      if (!group.children) continue;
      for (const child of group.children) {
        if (!child.requiredPermission || auth.hasPermission(child.requiredPermission)) {
          return createElement(Navigate, { to: child.href, replace: true });
        }
      }
    }
    return createElement(Navigate, { to: '/app/profile', replace: true });
  }

  return createElement(Navigate, { to: '/app', replace: true });
}

function withGuard(
  Component: React.ComponentType,
  config: {
    rbacPerms?: string[];
  }
) {
  return createElement(ProtectedRoute, {
    requiredRBACPermissions: config.rbacPerms,
    children: createElement(Component),
  });
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
      // Admin/manager pages
      {
        path: '/app',
        children: [
          // Default layout for standard pages (Dashboard, Menu, Inventory, etc.)
          {
            Component: Layout,
            children: [
              { index: true, element: withGuard(Dashboard, { rbacPerms: ['DASHBOARD_VIEW'] }) },
              { path: 'branch', element: withGuard(BranchManagement, { rbacPerms: ['BRANCH_VIEW'] }) },
              { path: 'categories', element: withGuard(CategoryManagement, { rbacPerms: ['CATEGORY_VIEW'] }) },
              { path: 'menu', element: withGuard(MenuManagement, { rbacPerms: ['MENU_MANAGEMENT_VIEW'] }) },
              { path: 'inventory', element: withGuard(InventoryManagement, { rbacPerms: ['INVENTORY_VIEW'] }) },
              { path: 'staff', element: withGuard(EmployeeManagement, { rbacPerms: ['STAFF_VIEW'] }) },
              { path: 'settings', element: withGuard(() => createElement('div', null, 'Cài đặt hệ thống - Sắp ra mắt'), { rbacPerms: ['SETTINGS_VIEW'] }) },
              { path: 'permissions', element: withGuard(PermissionManagement, { rbacPerms: ['PERMISSION_VIEW'] }) },
              { path: 'order-queue', element: withGuard(OrderQueuePOS, { rbacPerms: ['POS_ORDER_QUEUE_VIEW'] }) },
              { path: 'orders/history', element: withGuard(OrderHistoryPage, { rbacPerms: ['ORDER_HISTORY_VIEW'] }) },
              { path: 'orders/:orderId', element: withGuard(OrderDetailPage, { rbacPerms: ['ORDER_HISTORY_VIEW'] }) },
              { path: 'profile', Component: ProfilePage },
            ],
          },
          // Workspace layout for billiard — fully independent layout chain
          {
            path: 'billiard',
            Component: WorkspaceLayout,
            children: [
              { index: true, element: withGuard(BilliardManagement, { rbacPerms: ['BILLIARD_TABLE_VIEW'] }) },
              { path: 'layout', element: withGuard(BilliardLayout, { rbacPerms: ['BILLIARD_TABLE_LAYOUT_EDIT'] }) },
            ],
          },
          // Workspace layout for restaurant — fully independent layout chain
          {
            path: 'restaurant',
            Component: WorkspaceLayout,
            children: [
              { index: true, element: withGuard(RestaurantManagement, { rbacPerms: ['RESTAURANT_TABLE_VIEW'] }) },
            ],
          },
        ],
      },
      { path: '*', element: createElement(NotFound) },
    ],
  },
]);
