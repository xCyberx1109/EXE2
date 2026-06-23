import { Link, Outlet, useLocation, Navigate } from 'react-router';
import { Menu, X, Loader2, LogOut, User, Building2, Smartphone, UtensilsCrossed, Package, TrendingUp, LayoutDashboard, Users, Settings, ClipboardList, ChefHat, Shield, MapPin, Grid3X3, Clock, CircleDot } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { APP_MENU, type AppMenuItem } from '../../shared/permissions/menuConfig';
import { APP_NAME } from '../../shared/constants';
import { useTheme } from 'next-themes';
import { PosMachineHeader } from './PosMachineHeader';

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, Smartphone, UtensilsCrossed, Package, TrendingUp,
  Building2, Users, Settings, ClipboardList, ChefHat, Shield, MapPin, Grid3X3, Clock, CircleDot,
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
  const { isReady, isAuthenticated, isDeviceMode, isPosMachineMode, user, logout, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { visibleGroups, flatMenuItems } = useMemo(() => {
    const flatItems: AppMenuItem[] = [];
    const groups = APP_MENU
      .map(group => {
        if (!group.children) return group;
        const filtered = group.children.filter(child => {
          const allowed = !child.requiredPermission || hasPermission(child.requiredPermission);
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
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang kết nối server...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isDeviceMode) {
    return <Navigate to="/login" replace />;
  }

  if (isPosMachineMode) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <PosMachineHeader />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  if (user && !isAllowedPath(location.pathname, flatMenuItems)) {
    return <Navigate to={getDefaultRoute(hasPermission)} replace />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b border-border px-4 py-3 z-40">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-lg text-foreground">{APP_NAME}</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md hover:bg-accent text-foreground"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-sidebar-border">
              <div>
                <h1 className="text-xl font-bold text-sidebar-foreground">{APP_NAME}</h1>
                <p className="text-sm text-sidebar-foreground/60 mt-1">Hệ thống quản lý {APP_NAME}</p>
              </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {visibleGroups.map((group) => {
              if (!group.children) return null;
              return (
                <div key={group.name} className="mb-4">
                  <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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

          {/* User info + Dropdown */}
          <div ref={profileRef} className="p-4 border-t border-sidebar-border relative">
            {user && (
              <>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 w-full px-2 rounded-lg hover:bg-sidebar-accent transition-colors"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{user.fullName}</p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute left-full bottom-0 ml-3 w-56 rounded-lg border border-border bg-card shadow-xl overflow-hidden z-50">
                    <div className="px-3 py-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/app/profile"
                      onClick={() => { setMobileMenuOpen(false); setProfileOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      Hồ sơ
                    </Link>
                    <button
                      onClick={() => {
                        const modes = ["light", "dark", "system"];
                        const idx = modes.indexOf(theme ?? "light");
                        setTheme(modes[(idx + 1) % modes.length]);
                      }}
                      className="flex items-center justify-between w-full px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <span className="text-muted-foreground">Giao diện</span>
                      <span className="font-medium capitalize">{theme ?? "system"}</span>
                    </button>
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="text-xs text-muted-foreground px-2 mt-3">
              <p>© 2026 {APP_NAME}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content - scrollable */}
      <div className="flex-1 lg:pl-64 pt-14 lg:pt-0 h-full overflow-y-auto overflow-x-hidden">
        <main className="p-6 h-full min-h-0 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}