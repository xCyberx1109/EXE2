import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { POSSystem } from './pages/POSSystem';
import { MenuManagement } from './pages/MenuManagement';
import { InventoryManagement } from './pages/InventoryManagement';
import { RevenueManagement } from './pages/RevenueManagement';
import { MenuQR } from "./pages/QRMenu";

export const router = createBrowserRouter([
  {
    path: '/qrmenu',
    Component: MenuQR,
  },
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'pos', Component: POSSystem },
      { path: 'menu', Component: MenuManagement },
      { path: 'inventory', Component: InventoryManagement },
      { path: 'revenue', Component: RevenueManagement },
    ],
  },
]);