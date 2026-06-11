import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import { getDeviceTypeLabel } from '../../shared/permissions/devicePermissions';
import { APP_NAME } from '../../shared/constants';
import { UtensilsCrossed, LogOut, ChefHat, ClipboardList, ShoppingCart, Monitor, Tv, Settings, Loader2, Bell, Clock, ArrowLeft } from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: any;
  module: string;
  requiredPermission?: string;
}

const DEVICE_NAV_ITEMS: Record<string, NavItem[]> = {
  CASHIER: [
    { label: 'Tạo đơn', path: '/pos/order', icon: ShoppingCart, module: 'pos-order', requiredPermission: 'order:create' },
    { label: 'Thanh toán', path: '/pos/payment', icon: ClipboardList, module: 'payment', requiredPermission: 'payment:process' },
    { label: 'Hóa đơn', path: '/pos/receipt', icon: UtensilsCrossed, module: 'receipt', requiredPermission: 'receipt:print' },
    { label: 'Chia bill', path: '/pos/bill-split', icon: ClipboardList, module: 'bill-split', requiredPermission: 'bill:split' },
    { label: 'Khách hàng', path: '/pos/customer', icon: Settings, module: 'customer', requiredPermission: 'customer:read' },
  ],
  KITCHEN: [
    { label: 'Hàng chờ', path: '/pos/kitchen-queue', icon: ChefHat, module: 'kitchen-queue', requiredPermission: 'kitchen:view_queue' },
    { label: 'Theo dõi món', path: '/pos/kitchen-timeline', icon: Clock, module: 'order-timeline', requiredPermission: 'kitchen:view_queue' },
  ],
  WAITER: [
    { label: 'Đặt món', path: '/pos/waiter-order', icon: ShoppingCart, module: 'table-order', requiredPermission: 'order:create' },
    { label: 'Menu', path: '/pos/waiter-menu', icon: UtensilsCrossed, module: 'menu-browser', requiredPermission: 'menu:read' },
  ],
  KIOSK: [
    { label: 'Đặt món', path: '/pos/kiosk', icon: Monitor, module: 'self-order', requiredPermission: 'order:create' },
  ],
  CUSTOMER_DISPLAY: [
    { label: 'Trạng thái đơn', path: '/pos/display', icon: Tv, module: 'order-display', requiredPermission: 'order:read' },
  ],
  MANAGER: [
    { label: 'Tạo đơn', path: '/pos/order', icon: ShoppingCart, module: 'pos-order', requiredPermission: 'order:create' },
    { label: 'Thanh toán', path: '/pos/payment', icon: ClipboardList, module: 'payment', requiredPermission: 'payment:process' },
    { label: 'Bếp', path: '/pos/kitchen-queue', icon: ChefHat, module: 'kitchen-queue', requiredPermission: 'kitchen:view_queue' },
    { label: 'Báo cáo', path: '/pos/reports', icon: Settings, module: 'reports', requiredPermission: 'reports:read' },
  ],
  TABLET: [
    { label: 'Đặt món', path: '/pos/waiter-order', icon: ShoppingCart, module: 'table-order', requiredPermission: 'order:create' },
    { label: 'Menu', path: '/pos/waiter-menu', icon: UtensilsCrossed, module: 'menu-browser', requiredPermission: 'menu:read' },
  ],
};

function PosNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady, isAuthenticated, authMode, deviceType, deviceInfo, branchInfo, logoutDevice, logout, hasDevicePermission, hasPermission, user } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
  }, [isReady, isAuthenticated, navigate]);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Đang tải...
      </div>
    );
  }

  const effectiveType = authMode === 'device' ? deviceType : 'CASHIER';
  const allNavItems = (effectiveType && DEVICE_NAV_ITEMS[effectiveType]) || [];
  const navItems = authMode === 'device'
    ? allNavItems.filter((item) => !item.requiredPermission || hasDevicePermission(item.requiredPermission as any))
    : allNavItems.filter((item) => {
        const allowed = !item.requiredPermission || hasPermission(item.requiredPermission);
        return allowed;
      });

  const deviceLabel = authMode === 'device' ? getDeviceTypeLabel(deviceType || 'CASHIER') : 'Thu ngân';
  const branchName = branchInfo?.name || '';

  const handleLogout = async () => {
    if (authMode === 'device') {
      await logoutDevice();
    } else {
      logout();
    }
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-20">
        <div className="max-w-full mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-foreground">{deviceLabel}</h1>
              {branchName && <p className="text-xs text-muted-foreground">{branchName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-accent text-primary rounded-full font-medium">
              {authMode === 'device' ? (deviceType || APP_NAME) : 'STAFF'}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {navItems.length > 1 && (
        <div className="bg-card border-b border-border">
          <div className="max-w-full mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}

export function PosLayout() {
  return <PosNavbar />;
}