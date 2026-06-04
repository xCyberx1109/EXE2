import { Link, Outlet, useLocation, Navigate } from 'react-router';
import { Menu, X, Loader2, LogOut, User, Building2, Smartphone, UtensilsCrossed, Package, TrendingUp, LayoutDashboard, Users, Settings, ClipboardList, ChefHat, Shield, MapPin, Grid3X3, Clock } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { APP_MENU, type AppMenuItem } from '../../shared/permissions/menuConfig';

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, Smartphone, UtensilsCrossed, Package, TrendingUp,
  Building2, Users, Settings, ClipboardList, ChefHat, Shield, MapPin, Grid3X3, Clock,
};

function getDefaultRoute(hasPermission: (p: string) => boolean): string {
  for (const group of APP_MENU) {
    if (!group.children) continue;
    for (const child of group.children) {
      if (!child.requiredPermission || hasPermission(child.requiredPermission)) {
        return child.href;
      }
    }
  }
  return '/app/profile';
}

function isAllowedPath(path: string, flatItems: AppMenuItem[]): boolean {
  if (path === '/app' || path === '/app/profile') return true;
  return flatItems.some((item) => path === item.href || path.startsWith(item.href + '/'));
}



export function Layout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isReady, isAuthenticated, isDeviceMode, user, logout, hasPermission } = useAuth();

  const { visibleGroups, flatMenuItems } = useMemo(() => {
    const flatItems: AppMenuItem[] = [];
    const groups = APP_MENU
      .map(group => {
        if (!group.children) return group;
        const filtered = group.children.filter(child => {
          const allowed = !child.requiredPermission || hasPermission(child.requiredPermission);
          console.log(`[Sidebar] "${child.name}" requiredPermission="${child.requiredPermission}" allowed=${allowed}`);
          return allowed;
        });
        return { ...group, children: filtered };
      })
      .filter(group => !group.children || group.children.length > 0);

    for (const group of groups) {
      if (group.children) {
        for (const child of group.children) {
          flatItems.push(child);
        }
      }
    }
    return { visibleGroups: groups, flatMenuItems: flatItems };
  }, [hasPermission]);

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

  if (user && !isAllowedPath(location.pathname, flatMenuItems)) {
    return <Navigate to={getDefaultRoute(hasPermission)} replace />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
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
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {visibleGroups.map((group) => {
              if (!group.children) return null;
              return (
                <div key={group.name} className="mb-4">
                  <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {group.name}
                  </p>
                  {group.children.map((item) => {
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
                </div>
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
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
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

      {/* Main content - scrollable */}
      <div className="flex-1 lg:pl-64 pt-14 lg:pt-0 h-full overflow-y-auto overflow-x-hidden">
        <main className="p-6 min-h-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}