import { useAuth } from '../../app/context/AuthContext';

export function PosCustomersPage() {
  const { hasPermission } = useAuth();
  if (!hasPermission('CUSTOMER_VIEW')) {
    return <div className="h-full flex items-center justify-center text-muted-foreground">Bạn không có quyền xem khách hàng</div>;
  }
  return (
    <div className="h-full space-y-4">
      <h2 className="text-xl font-bold text-foreground">Khách hàng</h2>
      <p className="text-muted-foreground">Tính năng quản lý khách hàng đang phát triển</p>
    </div>
  );
}
