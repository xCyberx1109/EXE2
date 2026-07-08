import { createElement, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';

import { Layout } from './components/Layout';
import { WorkspaceLayout } from './components/WorkspaceLayout';

import { Dashboard } from './pages/Dashboard';
import { MenuManagement } from './pages/MenuManagement';
import { InventoryManagement } from './pages/InventoryManagement';
import { MenuQR } from './pages/QRMenu';
import { QrTablePrintPage } from './pages/QrTablePrintPage';

import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { SetupBranchPage } from './pages/SetupBranchPage';

import { BranchManagement } from './pages/BranchManagement';
import { ProfilePage } from './pages/ProfilePage';
import { PermissionManagement } from './pages/PermissionManagement';
import { PosMachineLoginPage } from './pages/PosMachineLoginPage';
import { OrderQueuePOS } from './pages/OrderQueuePOS';
import { EmployeeManagement } from './pages/EmployeeManagement';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { BilliardManagement } from './pages/BilliardManagement';
import { BilliardLayout } from './pages/BilliardLayout';
import { RestaurantManagement } from './pages/RestaurantManagement';

import NotFound from '../pages/NotFound';

import { ProtectedRoute } from '../shared/permissions/ProtectedRoute';
import { APP_MENU } from '../shared/permissions/menuConfig';
import { useAuth } from './context/AuthContext';

/**
 * Điều hướng từ đường dẫn "/" dựa trên trạng thái đăng nhập.
 */
function RootRedirect() {
  const auth = useAuth();

  if (!auth.isReady) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return createElement(Navigate, {
      to: '/login',
      replace: true,
    });
  }

  /*
   * Nhân viên được chuyển tới chức năng đầu tiên
   * mà họ có quyền truy cập.
   */
  if (auth.isEmployeeMode) {
    for (const group of APP_MENU) {
      for (const child of group.children) {
        const hasAccess =
          !child.requiredPermission ||
          auth.hasPermission(child.requiredPermission);

        if (hasAccess) {
          return createElement(Navigate, {
            to: child.href,
            replace: true,
          });
        }
      }
    }

    return createElement(Navigate, {
      to: '/app/profile',
      replace: true,
    });
  }

  return createElement(Navigate, {
    to: '/app',
    replace: true,
  });
}

/**
 * Bọc một trang bằng ProtectedRoute.
 */
function withGuard(
  Component: ComponentType,
  config: {
    rbacPerms?: string[];
  },
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
      /*
       * Trang public dành cho khách quét QR.
       * Không đặt bên trong /app vì khách không cần đăng nhập.
       */
      {
        path: '/qrmenu',
        Component: MenuQR,
      },

      /*
       * Các trang xác thực.
       */
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
        path: '/setup-branch',
        Component: SetupBranchPage,
      },
      {
        path: '/pos-machine/login',
        Component: PosMachineLoginPage,
      },

      /*
       * Điều hướng mặc định.
       */
      {
        path: '/',
        Component: RootRedirect,
      },

      /*
       * Các trang dành cho chủ tài khoản, quản lý và nhân viên.
       */
      {
        path: '/app',

        children: [
          /*
           * Layout tiêu chuẩn:
           * Dashboard, thực đơn, QR, kho, nhân viên...
           */
          {
            Component: Layout,

            children: [
              {
                index: true,
                element: withGuard(Dashboard, {
                  rbacPerms: ['DASHBOARD_VIEW'],
                }),
              },
              {
                path: 'branch',
                element: withGuard(BranchManagement, {
                  rbacPerms: ['BRANCH_VIEW'],
                }),
              },
              {
                path: 'menu',
                element: withGuard(MenuManagement, {
                  rbacPerms: ['MENU_MANAGEMENT_VIEW'],
                }),
              },

              /*
               * Trang tạo, xem và in QR cho từng bàn.
               * URL đầy đủ: /app/qr-table-print
               */
              {
                path: 'qr-table-print',
                element: withGuard(QrTablePrintPage, {
                  rbacPerms: ['RESTAURANT_TABLE_VIEW'],
                }),
              },

              {
                path: 'inventory',
                element: withGuard(InventoryManagement, {
                  rbacPerms: ['INVENTORY_VIEW'],
                }),
              },
              {
                path: 'staff',
                element: withGuard(EmployeeManagement, {
                  rbacPerms: ['STAFF_VIEW'],
                }),
              },
              {
                path: 'settings',
                element: withGuard(
                  () =>
                    createElement(
                      'div',
                      null,
                      'Cài đặt hệ thống - Sắp ra mắt',
                    ),
                  {
                    rbacPerms: ['SETTINGS_VIEW'],
                  },
                ),
              },
              {
                path: 'permissions',
                element: withGuard(PermissionManagement, {
                  rbacPerms: ['PERMISSION_VIEW'],
                }),
              },
              {
                path: 'order-queue',
                element: withGuard(OrderQueuePOS, {
                  rbacPerms: ['POS_ORDER_QUEUE_VIEW'],
                }),
              },
              {
                path: 'orders/history',
                element: withGuard(OrderHistoryPage, {
                  rbacPerms: ['ORDER_HISTORY_VIEW'],
                }),
              },
              {
                path: 'orders/:orderId',
                element: withGuard(OrderDetailPage, {
                  rbacPerms: ['ORDER_HISTORY_VIEW'],
                }),
              },
              {
                path: 'profile',
                Component: ProfilePage,
              },
            ],
          },

          /*
           * Không gian quản lý bàn bi-a.
           */
          {
            path: 'billiard',
            Component: WorkspaceLayout,

            children: [
              {
                index: true,
                element: withGuard(BilliardManagement, {
                  rbacPerms: ['BILLIARD_TABLE_VIEW'],
                }),
              },
              {
                path: 'layout',
                element: withGuard(BilliardLayout, {
                  rbacPerms: ['BILLIARD_TABLE_LAYOUT_EDIT'],
                }),
              },
            ],
          },

          /*
           * Không gian quản lý bàn nhà hàng.
           */
          {
            path: 'restaurant',
            Component: WorkspaceLayout,

            children: [
              {
                index: true,
                element: withGuard(RestaurantManagement, {
                  rbacPerms: ['RESTAURANT_TABLE_VIEW'],
                }),
              },
            ],
          },
        ],
      },

      /*
       * Không tìm thấy đường dẫn.
       */
      {
        path: '*',
        element: createElement(NotFound),
      },
    ],
  },
]);