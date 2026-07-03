import { Link, Outlet, useLocation, Navigate } from 'react-router';
import { Menu, X, Loader2, LogOut, User, Building2, Smartphone, UtensilsCrossed, Package, TrendingUp, LayoutDashboard, Users, Settings, ClipboardList, ChefHat, Shield, MapPin, Grid3X3, Clock, CircleDot, PanelLeftClose, PanelLeft, Sun, Moon } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { APP_MENU, type AppMenuItem } from '../../shared/permissions/menuConfig';

import { useTheme } from 'next-themes';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';

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
  const { isReady, isAuthenticated, isDeviceMode, user, employee, logout, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), []);

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

  if (!isAllowedPath(location.pathname, flatMenuItems)) {
    return <Navigate to={getDefaultRoute(hasPermission)} replace />;
  }

  const displayName = user?.fullName || employee?.fullName || 'Nhân viên';
  const displayEmail = user?.email || (employee ? 'Nhân viên POS' : '');

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 z-40 bg-card border-b border-border">
        <div className="flex items-center h-full px-2 gap-1">
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="lg:hidden p-2 rounded-md hover:bg-accent text-foreground"
          >
            {mobileMenuOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </button>

          {/* Desktop toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex p-2 rounded-md hover:bg-accent text-foreground/80 hover:text-foreground transition-colors"
            title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            {sidebarCollapsed ? <PanelLeft className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </button>

          {/* Logo */}
            <Link to="/app" className="flex-shrink-0">
            <img
              src="/Logo.png"
              alt="POSitive Logo"
              className="h-7 w-auto object-contain"
            />
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-md hover:bg-accent text-foreground/80 hover:text-foreground transition-colors"
            title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          >
            {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>

          {/* User avatar with dropdown */}
          {(user || employee) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors flex-shrink-0">
                  <User className="size-3 text-primary" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-1.5 py-1.5">
                  <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{displayEmail}</p>
                </div>
                <DropdownMenuSeparator />
                {user && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/app/profile" className="cursor-pointer">
                        <User className="size-3.5 mr-1.5" />
                        Hồ sơ
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive">
                  <LogOut className="size-3.5 mr-1.5" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* ── Mobile overlay ────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Body: Sidebar + Main ──────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden shrink-0 transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-20' : 'w-72'
          } fixed left-0 top-14 bottom-0 z-30 lg:static lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
          <div className="flex flex-col h-full">
            <TooltipProvider delayDuration={0}>
              <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
                {visibleGroups.map((group) => {
                  if (!group.children) return null;
                  return (
                    <div key={group.name} className="mb-2">
                      {!sidebarCollapsed && (
                        <p className="px-2 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.name}
                        </p>
                      )}
                      {group.children.map((item) => {
                        const isActive = location.pathname === item.href;
                        const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                        const link = (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                              } ${sidebarCollapsed ? 'justify-center' : ''}`}
                          >
                            <Icon className="size-[18px] flex-shrink-0" />
                            {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                          </Link>
                        );
                        if (sidebarCollapsed) {
                          return (
                            <Tooltip key={item.name}>
                              <TooltipTrigger asChild>
                                {link}
                              </TooltipTrigger>
                              <TooltipContent side="right" className="z-50">
                                {item.name}
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        return link;
                      })}
                    </div>
                  );
                })}
              </nav>
            </TooltipProvider>

            {/* Sidebar spacer */}
            <div className="p-2 border-t border-sidebar-border" />
          </div>
        </aside>

        {/* Main content */}
        <main
          className="
flex-1
min-h-0
overflow-hidden
"
        >
          <div
            className="
h-full
px-3
pt-1.5
pb-3
overflow-hidden
"
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
