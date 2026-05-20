import { createElement } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { POSSystem } from './pages/POSSystem';
import { MenuManagement } from './pages/MenuManagement';
import { InventoryManagement } from './pages/InventoryManagement';
import { RevenueManagement } from './pages/RevenueManagement';
import { MenuQR } from "./pages/QRMenu";
import { LoginPage } from './pages/LoginPage';
import { BranchManagement } from './pages/BranchManagement';

function RootRedirect() {
  // routes.ts là file .ts (không dùng JSX), nên dùng createElement thay cho <Navigate />
  return createElement(Navigate, { to: '/login', replace: true });
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
  // Khi khởi động (/) luôn đưa về trang login
  {
    path: '/',
    Component: RootRedirect,
  },
  // Các trang quản trị sau khi đăng nhập
  {
    path: '/app',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'branches', Component: BranchManagement },
      { path: 'pos', Component: POSSystem },
      { path: 'menu', Component: MenuManagement },
      { path: 'inventory', Component: InventoryManagement },
      { path: 'revenue', Component: RevenueManagement },
    ],
  },
]);
