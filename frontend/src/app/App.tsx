import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CategoryProvider } from './context/CategoryContext';
import { Loader2 } from 'lucide-react';
import { AppErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/app/components/ui/sonner';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { APP_NAME } from '@/shared/constants';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ThemeProvider } from 'next-themes';
import { useTheme } from 'next-themes';

function AppContent() {
  const { isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium">Đang khởi tạo {APP_NAME}...</p>
        <p className="text-sm text-muted-foreground mt-2">Vui lòng chờ trong giây lát...</p>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

function ThemedToastContainer() {
  const { resolvedTheme } = useTheme();
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      closeOnClick
      pauseOnHover
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
      <AppErrorBoundary>
        <AuthProvider>
          <CategoryProvider>
            <AppContent />
          </CategoryProvider>
          <Toaster position="top-right" richColors />
          <ThemedToastContainer />
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
