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
import { authApi } from '../api/services';
import {
  getPosToken,
  setPosToken,
  clearAllPosStorage,
} from '../api/posServices';

import type {
  User,
  AuthMode,
  DeviceLoginResponse,
  DevicePermission,
  DeviceFeatures,
  PosDeviceTypeV2,
} from '../types';

import { deviceAuthApi } from '../api/services';

const STORAGE_KEYS = {
  DEVICE_INFO: 'fnb_device_info',
  BRANCH_INFO: 'fnb_branch_info',
  DEVICE_PERMISSIONS: 'fnb_device_permissions',
  DEVICE_FEATURES: 'fnb_device_features',
  ENABLED_FEATURES: 'fnb_enabled_features',
  FINGERPRINT: 'fnb_device_fingerprint',
} as const;

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  authMode: AuthMode;
  user: User | null;

  deviceInfo: DeviceLoginResponse['device'] | null;
  branchInfo: DeviceLoginResponse['branch'] | null;

  devicePermissions: DevicePermission[];
  deviceFeatures: DeviceFeatures | null;
  enabledFeatures: string[];

  deviceType: PosDeviceTypeV2 | null;

  setUser: (user: User | null) => void;

  login: (email: string, password: string) => Promise<User>;
  loginWithDevicePin: (
    setupPin: string,
    fingerprint?: string,
    deviceName?: string
  ) => Promise<DeviceLoginResponse>;

  logout: () => void;
  logoutDevice: () => Promise<void>;

  hasDevicePermission: (permission: DevicePermission) => boolean;
  hasAnyDevicePermission: (permissions: DevicePermission[]) => boolean;
  hasDeviceFeature: (feature: string) => boolean;

  isDeviceMode: boolean;

  hasPermission: (permission?: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* =========================
   NORMALIZE PERMISSIONS
========================= */
const normalizePermissions = (permissions: unknown): string[] => {
  if (!Array.isArray(permissions)) return [];

  return permissions
    .map((p: any) => {
      if (typeof p === 'string') return p;
      return p?.code;
    })
    .filter(Boolean);
};

/* =========================
   FINGERPRINT
========================= */
function generateFingerprint(): string {
  let fp = localStorage.getItem(STORAGE_KEYS.FINGERPRINT);

  if (!fp) {
    const nav = window.navigator;
    const screen = window.screen;

    const raw = [
      nav.userAgent,
      nav.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('||');

    fp = btoa(encodeURIComponent(raw)).slice(0, 64);
    localStorage.setItem(STORAGE_KEYS.FINGERPRINT, fp);
  }

  return fp;
}

/* =========================
   RESTORE STORAGE
========================= */
function restoreFromStorage() {
  try {
    return {
      deviceInfo: JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICE_INFO) || 'null'),
      branchInfo: JSON.parse(localStorage.getItem(STORAGE_KEYS.BRANCH_INFO) || 'null'),
      devicePermissions: JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICE_PERMISSIONS) || '[]'),
      deviceFeatures: JSON.parse(localStorage.getItem(STORAGE_KEYS.DEVICE_FEATURES) || 'null'),
      enabledFeatures: JSON.parse(localStorage.getItem(STORAGE_KEYS.ENABLED_FEATURES) || '[]'),
    };
  } catch {
    return {
      deviceInfo: null,
      branchInfo: null,
      devicePermissions: [],
      deviceFeatures: null,
      enabledFeatures: [],
    };
  }
}

/* =========================
   CLEAR STORAGE
========================= */
function clearAllStorage() {
  Object.values(STORAGE_KEYS).forEach((key) =>
    localStorage.removeItem(key)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(
    !!getToken() || !!getPosToken()
  );

  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (getToken()) return 'account';
    if (getPosToken()) return 'device';
    return 'account';
  });

  const [user, setUser] = useState<User | null>(null);

  const restored =
    isAuthenticated && authMode === 'device' ? restoreFromStorage() : null;

  const [deviceInfo, setDeviceInfo] = useState(
    restored?.deviceInfo || null
  );

  const [branchInfo, setBranchInfo] = useState(
    restored?.branchInfo || null
  );

  const [devicePermissions, setDevicePermissions] = useState<DevicePermission[]>(
    restored?.devicePermissions || []
  );

  const [deviceFeatures, setDeviceFeatures] = useState<DeviceFeatures | null>(
    restored?.deviceFeatures || null
  );

  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(
    restored?.enabledFeatures || []
  );

  const deviceType = deviceInfo?.type as PosDeviceTypeV2 | null;

  /* =========================
     PERMISSION SET (FIX CORE BUG)
  ========================= */
  const permissionSet = useMemo(() => {
    return new Set(
      normalizePermissions(user?.permissions)
    );
  }, [user]);

  /* =========================
     PERMISSION CHECK
  ========================= */
  const hasPermission = useCallback(
    (permission?: string): boolean => {
      console.log("[CHECK PERMISSION]", permission);
      console.log("[USER PERMISSIONS]", Array.from(permissionSet));
      if (!permission) return true;

      if (permissionSet.has('ADMIN_ALL')) return true;

      return permissionSet.has(permission);
    },
    [permissionSet]
  );

  /* =========================
     DEVICE PERMISSION
  ========================= */
  const hasDevicePermission = (permission: DevicePermission) => {
    return devicePermissions.includes(permission);
  };

  const hasAnyDevicePermission = (permissions: DevicePermission[]) => {
    return permissions.some((p) =>
      devicePermissions.includes(p)
    );
  };

  const hasDeviceFeature = (feature: string) => {
    return enabledFeatures.includes(feature);
  };

  /* =========================
     LOGIN ACCOUNT
  ========================= */
  const login = async (email: string, password: string) => {
    const { token, user: loggedUser } = await authApi.login(email, password);

    setToken(token);

    setUser({
      ...loggedUser,
      permissions: normalizePermissions(loggedUser.permissions),
    });

    setIsAuthenticated(true);
    setAuthMode('account');

    clearAllPosStorage();
    clearAllStorage();

    return loggedUser;
  };

  /* =========================
     DEVICE LOGIN
  ========================= */
  const loginWithDevicePin = async (
    setupPin: string,
    fingerprint?: string,
    deviceName?: string
  ) => {
    const fp = fingerprint || generateFingerprint();
    const name = deviceName || `POS-${fp.slice(0, 8)}`;

    const result = await deviceAuthApi.loginWithPin({
      setupPin,
      fingerprint: fp,
      deviceName: name,
    });

    setPosToken(result.deviceToken);

    setDeviceInfo(result.device);
    setBranchInfo(result.branch);
    setDevicePermissions(result.permissions || []);
    setDeviceFeatures(result.features || null);
    setEnabledFeatures(result.enabledFeatures || []);

    setIsAuthenticated(true);
    setAuthMode('device');

    clearToken();
    return result;
  };

  /* =========================
     LOGOUT
  ========================= */
  const logout = () => {
    clearToken();

    setUser(null);
    setDeviceInfo(null);
    setBranchInfo(null);
    setDevicePermissions([]);
    setDeviceFeatures(null);
    setEnabledFeatures([]);

    setIsAuthenticated(false);
    setAuthMode('account');

    clearAllStorage();
  };

  const logoutDevice = useCallback(async () => {
    try {
      if (getPosToken()) {
        await deviceAuthApi.logout();
      }
    } catch { }

    clearAllPosStorage();
    clearAllStorage();

    setDeviceInfo(null);
    setBranchInfo(null);
    setDevicePermissions([]);
    setDeviceFeatures(null);
    setEnabledFeatures([]);

    setIsAuthenticated(false);
    setAuthMode('account');
  }, []);

  /* =========================
     REFRESH PERMISSIONS
  ========================= */
  const refreshPermissions = useCallback(async () => {
    try {
      const currentUser = await authApi.getMe();

      setUser({
        ...currentUser,
        permissions: normalizePermissions(currentUser.permissions),
      });
    } catch { }
  }, []);

  /* =========================
     INIT
  ========================= */
  useEffect(() => {
    const init = async () => {
      const userToken = getToken();
      const posToken = getPosToken();

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

      if (posToken) {
        try {
          const sessions = await deviceAuthApi.getSessions();

          if (sessions?.length > 0) {
            const stored = restoreFromStorage();

            if (stored.deviceInfo?.id) {
              setDeviceInfo(stored.deviceInfo);
              setBranchInfo(stored.branchInfo);
              setDevicePermissions(stored.devicePermissions);
              setDeviceFeatures(stored.deviceFeatures);
              setEnabledFeatures(stored.enabledFeatures);
            }

            setIsAuthenticated(true);
            setAuthMode('device');
          }
        } catch {
          clearAllPosStorage();
          clearAllStorage();
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
        deviceInfo,
        branchInfo,

        devicePermissions,
        deviceFeatures,
        enabledFeatures,
        deviceType,

        setUser,
        login,
        loginWithDevicePin,

        logout,
        logoutDevice,

        hasDevicePermission,
        hasAnyDevicePermission,
        hasDeviceFeature,

        isDeviceMode: authMode === 'device',

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