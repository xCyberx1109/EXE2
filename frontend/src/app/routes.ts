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
import { ProfilePage } from './pages/ProfilePage';
import { PosDeviceManagement } from './pages/PosDeviceManagement';
import { PosLoginPage } from './pages/PosLoginPage';
import { PosDashboard } from './pages/PosDashboard';

function RootRedirect() {
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
  // POS Device Login (riêng biệt)
  {
    path: '/pos/login',
    Component: PosLoginPage,
  },
  {
    path: '/pos/dashboard',
    Component: PosDashboard,
  },
  {
    path: '/pos/setup',
    Component: PosLoginPage,
  },
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
      { path: 'pos-devices', Component: PosDeviceManagement },
      { path: 'menu', Component: MenuManagement },
      { path: 'inventory', Component: InventoryManagement },
      { path: 'revenue', Component: RevenueManagement },
      { path: 'profile', Component: ProfilePage },
    ],
  },
]);
