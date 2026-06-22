import { useMemo } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import { POS_MACHINE_TEMPLATES } from '../../app/types';
import { APP_NAME } from '../../shared/constants';
import { LogOut, ShoppingCart, ChefHat, CircleDot, ClipboardList, Users } from 'lucide-react';

interface PosNavFeature {
  label: string;
  path: string;
  icon: any;
  requiredPermission: string;
}

const FEATURE_MAP: PosNavFeature[] = [
  { label: 'Tạo đơn', path: '/pos-machine/order', icon: ShoppingCart, requiredPermission: 'ORDER_CREATE' },
  { label: 'Order Queue', path: '/pos-machine/order-queue', icon: ClipboardList, requiredPermission: 'POS_ORDER_QUEUE_VIEW' },
  { label: 'Bàn', path: '/pos-machine/tables', icon: ClipboardList, requiredPermission: 'TABLE_VIEW' },
  { label: 'Bếp', path: '/pos-machine/kitchen', icon: ChefHat, requiredPermission: 'POS_ORDER_QUEUE_VIEW' },
  { label: 'Bi-a', path: '/pos-machine/billiard', icon: CircleDot, requiredPermission: 'BILLIARD_TABLE_VIEW' },
  { label: 'Khách hàng', path: '/pos-machine/customers', icon: Users, requiredPermission: 'CUSTOMER_VIEW' },
];

export function PosMachineLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isReady, isAuthenticated, isPosMachineMode,
    posMachineInfo, posMachineTemplate, hasPermission,
    logoutPosMachine,
  } = useAuth();

  const visibleFeatures = useMemo(() => {
    return FEATURE_MAP.filter((f) => hasPermission(f.requiredPermission));
  }, [hasPermission]);

  if (!isReady || !isAuthenticated || !isPosMachineMode) {
    return null;
  }

  const templateLabel = posMachineTemplate
    ? POS_MACHINE_TEMPLATES[posMachineTemplate] || posMachineTemplate
    : 'POS Machine';
  const machineName = posMachineInfo?.name || '';

  const handleLogout = () => {
    logoutPosMachine();
    navigate('/pos-machine/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-20">
        <div className="max-w-full mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-foreground">{machineName || APP_NAME}</h1>
              <p className="text-xs text-muted-foreground">{templateLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-accent text-primary rounded-full font-medium">
              {posMachineTemplate}
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

      {visibleFeatures.length > 0 && (
        <div className="bg-card border-b border-border">
          <div className="max-w-full mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-2">
              {visibleFeatures.map((feature) => {
                const isActive = location.pathname === feature.path || location.pathname.startsWith(feature.path + '/');
                const Icon = feature.icon;
                return (
                  <Link
                    key={feature.path}
                    to={feature.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {feature.label}
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
