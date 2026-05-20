import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { setToken, getToken, clearToken } from '../api/client';
import { authApi } from '../api/services';

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@store.com';
const DEFAULT_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Admin@123';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());

  const login = async (email: string, password: string) => {
    const { token } = await authApi.login(email, password);
    setToken(token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearToken();
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const init = async () => {
      if (getToken()) {
        setIsAuthenticated(true);
        setIsReady(true);
        return;
      }
      try {
        await login(DEFAULT_EMAIL, DEFAULT_PASSWORD);
      } catch (err) {
        console.warn('Auto-login thất bại. CRUD cần đăng nhập backend.', err);
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, []);

  return (
    <AuthContext.Provider value={{ isReady, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
