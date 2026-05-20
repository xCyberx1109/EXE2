import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { setToken, getToken, clearToken } from '../api/client';
import { authApi } from '../api/services';

import { User } from '../types';

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  hasRole: (roles: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    const { token, user: loggedUser } = await authApi.login(email, password);
    setToken(token);
    setUser(loggedUser);
    setIsAuthenticated(true);
    return loggedUser;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  const hasRole = (roles: string | string[]) => {
    if (!user) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.role);
  };

  useEffect(() => {
    const init = async () => {
      if (getToken()) {
        try {
          const currentUser = await authApi.getMe();
          setUser(currentUser);
          setIsAuthenticated(true);
        } catch (err) {
          console.error('Lỗi verify token:', err);
          clearToken();
          setIsAuthenticated(false);
        } finally {
          setIsReady(true);
        }
        return;
      }
      setIsReady(true);
    };
    init();
  }, []);

  return (
    <AuthContext.Provider value={{ isReady, isAuthenticated, user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
