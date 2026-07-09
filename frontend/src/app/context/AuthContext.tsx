import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

import { setToken, getToken, clearToken } from '../api/client';
import { authApi, employeeApi } from '../api/services';

import type {
  User,
  AuthMode,
  Employee,
  EmployeeLoginResponse,
} from '../types';

const EMPLOYEE_TOKEN_KEY = 'fnb_employee_token';

function getEmployeeToken() { return localStorage.getItem(EMPLOYEE_TOKEN_KEY); }
function setEmployeeToken(token: string) { localStorage.setItem(EMPLOYEE_TOKEN_KEY, token); }
function clearEmployeeToken() { localStorage.removeItem(EMPLOYEE_TOKEN_KEY); }

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  authMode: AuthMode;
  user: User | null;

  employee: Employee | null;
  employeePermissions: string[];

  setUser: (user: User | null) => void;

  login: (email: string, password: string) => Promise<User>;
  employeeLoginByPin: (employeeCode: string, pinCode: string) => Promise<EmployeeLoginResponse>;

  logout: () => void;
  logoutEmployee: () => void;

  isEmployeeMode: boolean;

  hasPermission: (permission?: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizePermissions = (permissions: unknown): string[] => {
  if (!Array.isArray(permissions)) return [];
  return permissions
    .map((p: any) => {
      if (typeof p === 'string') return p;
      return p?.code;
    })
    .filter(Boolean);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(
    !!getToken() || !!getEmployeeToken()
  );

  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (getEmployeeToken()) return 'pos_machine';
    return 'account';
  });

  const [user, setUser] = useState<User | null>(null);

  const [employee, setEmployee] = useState<Employee | null>(() => {
    try { return JSON.parse(localStorage.getItem('fnb_employee_info') || 'null'); }
    catch { return null; }
  });

  const [employeePermissions, setEmployeePermissions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fnb_employee_permissions') || '[]'); }
    catch { return []; }
  });

  const permissionSet = useMemo(() => {
    const allPermissions = [
      ...normalizePermissions(user?.permissions),
      ...normalizePermissions(employeePermissions),
    ];
    return new Set(allPermissions);
  }, [user, employeePermissions]);

  const hasPermission = useCallback(
    (permission?: string): boolean => {
      if (!permission) return true;
      return permissionSet.has(permission);
    },
    [permissionSet]
  );

  const login = async (email: string, password: string) => {
    const { token, user: loggedUser } = await authApi.login(email, password);

    setToken(token);
    setUser({
      ...loggedUser,
      permissions: normalizePermissions(loggedUser.permissions),
    });

    setIsAuthenticated(true);
    setAuthMode('account');

    return loggedUser;
  };

  const employeeLoginByPin = async (employeeCode: string, pinCode: string) => {
    const res = await employeeApi.loginByPin(employeeCode, pinCode);

    setEmployeeToken(res.token);

    setEmployee(res.employee);
    setEmployeePermissions(normalizePermissions(res.permissions));

    localStorage.setItem('fnb_employee_info', JSON.stringify(res.employee));
    localStorage.setItem('fnb_employee_permissions', JSON.stringify(res.permissions));

    setIsAuthenticated(true);
    setAuthMode('pos_machine');

    return res;
  };

  const logout = () => {
    if (authMode === 'pos_machine') {
      clearEmployeeToken();
      setEmployee(null);
      setEmployeePermissions([]);
      localStorage.removeItem('fnb_employee_info');
      localStorage.removeItem('fnb_employee_permissions');
    } else {
      clearToken();
      setUser(null);
    }
    setIsAuthenticated(false);
    setAuthMode('account');
  };

  const logoutEmployee = () => {
    clearEmployeeToken();

    setEmployee(null);
    setEmployeePermissions([]);

    localStorage.removeItem('fnb_employee_info');
    localStorage.removeItem('fnb_employee_permissions');

    setIsAuthenticated(false);
    setAuthMode('account');
  };

  const refreshPermissions = useCallback(async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser({
        ...currentUser,
        permissions: normalizePermissions(currentUser.permissions),
      });
    } catch { }
  }, []);

  useEffect(() => {
    const init = async () => {
      const userToken = getToken();
      const empToken = getEmployeeToken();

      if (empToken) {
        try {
          const storedInfo = localStorage.getItem('fnb_employee_info');
          const storedPerms = localStorage.getItem('fnb_employee_permissions');
          if (storedInfo) {
            setEmployee(JSON.parse(storedInfo));
            if (storedPerms) setEmployeePermissions(JSON.parse(storedPerms));
            setIsAuthenticated(true);
            setAuthMode('pos_machine');
          }
        } catch {
          clearEmployeeToken();
          setIsAuthenticated(false);
        } finally {
          setIsReady(true);
        }
        return;
      }

      if (userToken) {
        try {
          const currentUser = await authApi.getMe();
          setUser({
            ...currentUser,
            permissions: normalizePermissions(currentUser.permissions),
          });
          setIsAuthenticated(true);
          setAuthMode('account');
        } catch {
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
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated,
        authMode,

        user,
        employee,
        employeePermissions,

        setUser,
        login,
        employeeLoginByPin,

        logout,
        logoutEmployee,

        isEmployeeMode: authMode === 'pos_machine',

        hasPermission,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
