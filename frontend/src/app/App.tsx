import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import { AppErrorBoundary } from '@/components/ErrorBoundary';

function AppContent() {
  const { isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-lg font-medium">Đang khởi tạo hệ thống...</p>
        <p className="text-sm text-gray-400 mt-2">Vui lòng chờ trong giây lát...</p>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
