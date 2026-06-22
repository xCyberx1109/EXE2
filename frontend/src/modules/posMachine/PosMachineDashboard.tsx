import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';

const FEATURE_ROUTES = [
  { permission: 'ORDER_CREATE', route: '/pos-machine/order' },
  { permission: 'BILLIARD_TABLE_VIEW', route: '/pos-machine/billiard' },
  { permission: 'POS_ORDER_QUEUE_VIEW', route: '/pos-machine/order-queue' },
  { permission: 'TABLE_VIEW', route: '/pos-machine/tables' },
  { permission: 'CUSTOMER_VIEW', route: '/pos-machine/customers' },
];

export function PosMachineDashboard() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated, isPosMachineMode, hasPermission } = useAuth();

  useEffect(() => {
    if (!isReady || !isAuthenticated || !isPosMachineMode) return;

    const firstAvailable = FEATURE_ROUTES.find((f) => hasPermission(f.permission));
    if (firstAvailable) {
      navigate(firstAvailable.route, { replace: true });
    } else {
      navigate('/pos-machine/order-queue', { replace: true });
    }
  }, [isReady, isAuthenticated, isPosMachineMode, hasPermission, navigate]);

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      Đang chuyển hướng...
    </div>
  );
}
