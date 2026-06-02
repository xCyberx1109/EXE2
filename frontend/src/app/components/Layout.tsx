import { Link, Outlet, useLocation, Navigate } from 'react-router';
import { Menu, X, Loader2, LogOut, User, Building2, Smartphone, UtensilsCrossed, Package, TrendingUp, LayoutDashboard, Users, Settings, ClipboardList, ChefHat, Shield, MapPin, Grid3X3 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { APP_MENU, type AppMenuItem } from '../../shared/permissions/menuConfig';

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, Smartphone, UtensilsCrossed, Package, TrendingUp,
  Building2, Users, Settings, ClipboardList, ChefHat, Shield, MapPin, Grid3X3,
};

function getDefaultRoute(hasPermission: (p: string) => boolean): string {
  const firstAllowed = APP_MENU.find(item => !item.permission || hasPermission(item.permission));
  return firstAllowed?.href || '/app/profile';
}

function isAllowedPath(path: string, menuItems: AppMenuItem[]): boolean {
  if (path === '/app') return true;
  if (path === '/app/profile') return true;
  if (path.startsWith('/app/pos-devices') || path.startsWith('/app/pos')) return true;
  return menuItems.some((item) => path === item.href || path.startsWith(item.href + '/'));
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Super Admin',
  MANAGER: 'Quản lý',
  CASHIER: 'Thu ngân',
  KITCHEN: 'Bếp',
};

export function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isReady, isAuthenticated, isDeviceMode, user, logout, hasPermission } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang kết nối server...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isDeviceMode) {
    return <Navigate to="/pos-v2/dashboard" replace />;
  }

  const menuItems = APP_MENU.filter(item => !item.permission || hasPermission(item.permission));

  if (user && !isAllowedPath(location.pathname, menuItems)) {
    return <Navigate to={getDefaultRoute(hasPermission)} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-40">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-lg">Quản lý F&B</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Quản lý F&B</h1>
            <p className="text-sm text-gray-500 mt-1">Hệ thống quản lý nhà hàng</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = ICON_MAP[item.icon] || LayoutDashboard;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info + Logout */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            {user && (
              <Link
                to="/app/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[user.role] || user.role}</p>
                </div>
              </Link>
            )}

            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
            <div className="text-xs text-gray-400 px-2">
              <p>© 2026 F&B Management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64 pt-14 lg:pt-0">
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}