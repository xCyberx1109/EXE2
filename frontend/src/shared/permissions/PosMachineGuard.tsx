import { Navigate } from 'react-router';
import { useAuth } from '../../app/context/AuthContext';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface PosMachineGuardProps {
  children: ReactNode;
}

export function PosMachineGuard({ children }: PosMachineGuardProps) {
  const { isReady, isAuthenticated, isPosMachineMode } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <p className="text-lg font-medium">Đang tải...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isPosMachineMode) {
    return <Navigate to="/pos-machine/login" replace />;
  }

  return <>{children}</>;
}
