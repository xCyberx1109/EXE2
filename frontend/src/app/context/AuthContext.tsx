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
  clearAllPosStorage,
} from '../api/posServices';

import type {
  User,
  AuthMode,
  DeviceLoginResponse,
  DevicePermission,
  DeviceFeatures,
  PosDeviceTypeV2,
  PosMachineTemplate,
  PosMachineLoginResponse,
  LoginByPinResult,
} from '../types';

import { deviceAuthApi } from '../api/services';

const STORAGE_KEYS = {
  DEVICE_INFO: 'fnb_device_info',
  BRANCH_INFO: 'fnb_branch_info',
  DEVICE_PERMISSIONS: 'fnb_device_permissions',
  DEVICE_FEATURES: 'fnb_device_features',
  ENABLED_FEATURES: 'fnb_enabled_features',
  FINGERPRINT: 'fnb_device_fingerprint',
  POS_MACHINE_INFO: 'fnb_pos_machine_info',
  POS_MACHINE_MODULE: 'fnb_pos_machine_module',
  POS_MACHINE_PERMISSIONS: 'fnb_pos_machine_permissions',
} as const;

const POS_MACHINE_TOKEN_KEY = 'fnb_pos_machine_token';

function getPosMachineToken() { return localStorage.getItem(POS_MACHINE_TOKEN_KEY); }
function setPosMachineToken(token: string) { localStorage.setItem(POS_MACHINE_TOKEN_KEY, token); }
function clearPosMachineToken() { localStorage.removeItem(POS_MACHINE_TOKEN_KEY); }

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

  /** POS Machine auth state */
  posMachineInfo: PosMachineLoginResponse['machine'] | null;
  posMachineTemplate: PosMachineTemplate | null;
  posMachineModule: string | null;
  posMachineModules: string[];

  setUser: (user: User | null) => void;

  login: (email: string, password: string) => Promise<User>;
  loginWithPosPin: (pinCode: string, machineId?: string) => Promise<PosMachineLoginResponse>;
  loginByPin: (pinCode: string) => Promise<LoginByPinResult>;

  logout: () => void;
  logoutDevice: () => Promise<void>;
  logoutPosMachine: () => void;

  hasDevicePermission: (permission: DevicePermission) => boolean;
  hasAnyDevicePermission: (permissions: DevicePermission[]) => boolean;
  hasDeviceFeature: (feature: string) => boolean;

  isDeviceMode: boolean;
  isPosMachineMode: boolean;

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
    !!getToken() || !!getPosMachineToken()
  );

  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (getPosMachineToken()) return 'pos_machine';
    if (localStorage.getItem('fnb_auth_token')) return 'account';
    return 'account';
  });

  const [user, setUser] = useState<User | null>(null);

  const [deviceInfo, setDeviceInfo] = useState<DeviceLoginResponse['device'] | null>(null);

  const [branchInfo, setBranchInfo] = useState<DeviceLoginResponse['branch'] | null>(null);

  const [devicePermissions, setDevicePermissions] = useState<DevicePermission[]>([]);

  const [deviceFeatures, setDeviceFeatures] = useState<DeviceFeatures | null>(null);

  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);

  const deviceType = deviceInfo?.type as PosDeviceTypeV2 | null;

  /* =========================
     POS MACHINE STATE
  ========================= */
  const [posMachineInfo, setPosMachineInfo] = useState<PosMachineLoginResponse['machine'] | null>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.POS_MACHINE_INFO) || 'null'); }
    catch { return null; }
  });
  const [posMachineModule, setPosMachineModule] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.POS_MACHINE_MODULE)
  );
  const posMachineTemplate = posMachineInfo?.template as PosMachineTemplate | null;

  const posMachineModules = useMemo(() => {
    if (!posMachineModule) return [];
    const MODULE_MAP: Record<string, string[]> = {
      BILLIARD: ['BILLIARD_TABLE'],
      RESTAURANT: ['RESTAURANT_TABLE'],
      ORDER_QUEUE: ['ORDER_QUEUE'],
      ORDER: ['ORDER_QUEUE'],
      ORDER_DISPATCH: ['ORDER_QUEUE'],
    };
    return MODULE_MAP[posMachineModule] || [];
  }, [posMachineModule]);

  /* =========================
     PERMISSION SET (FIX CORE BUG)
  ========================= */
  const [posMachinePermissions, setPosMachinePermissions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.POS_MACHINE_PERMISSIONS) || '[]'); }
    catch { return []; }
  });
  
  const permissionSet = useMemo(() => {
    const allPermissions = [
      ...normalizePermissions(user?.permissions),
      ...normalizePermissions(posMachinePermissions)
    ];
    return new Set(allPermissions);
  }, [user, posMachinePermissions]);

  /* =========================
     PERMISSION CHECK
  ========================= */
  const hasPermission = useCallback(
    (permission?: string): boolean => {
      if (!permission) return true;


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
     POS MACHINE LOGIN (single official flow)
  ========================= */
  const loginWithPosPin = async (pinCode: string, machineId?: string) => {
    const { posMachineApi } = await import('../api/posServices');

    clearToken();
    clearAllPosStorage();
    clearAllStorage();

    const result = await posMachineApi.login(pinCode, machineId);

    setPosMachineToken(result.token);

    setPosMachineInfo(result.machine);
    setPosMachineModule(result.module);
    setPosMachinePermissions(normalizePermissions(result.permissions));

    localStorage.setItem(STORAGE_KEYS.POS_MACHINE_INFO, JSON.stringify(result.machine));
    if (result.module) localStorage.setItem(STORAGE_KEYS.POS_MACHINE_MODULE, result.module);
    if (result.permissions) localStorage.setItem(STORAGE_KEYS.POS_MACHINE_PERMISSIONS, JSON.stringify(result.permissions));

    setIsAuthenticated(true);
    setAuthMode('pos_machine');

    return result;
  };

  /* =========================
     POS MACHINE LOGIN BY PIN ONLY (auto-detect device)
  ========================= */
  const loginByPin = async (pinCode: string) => {
    const { posMachineApi } = await import('../api/posServices');

    const result = await posMachineApi.loginByPin(pinCode);

    if (!('requiresMachineSelection' in result)) {
      clearToken();
      clearAllPosStorage();
      clearAllStorage();

      setPosMachineToken(result.token);
      setPosMachineInfo(result.machine);
      setPosMachineModule(result.module);
      setPosMachinePermissions(normalizePermissions(result.permissions));

      localStorage.setItem(STORAGE_KEYS.POS_MACHINE_INFO, JSON.stringify(result.machine));
      if (result.module) localStorage.setItem(STORAGE_KEYS.POS_MACHINE_MODULE, result.module);
      if (result.permissions) localStorage.setItem(STORAGE_KEYS.POS_MACHINE_PERMISSIONS, JSON.stringify(result.permissions));

      setIsAuthenticated(true);
      setAuthMode('pos_machine');
    }

    return result;
  };

  /* =========================
     POS MACHINE LOGOUT
  ========================= */
  const logoutPosMachine = () => {
    clearPosMachineToken();

    setPosMachineInfo(null);
    setPosMachineModule(null);
    setPosMachinePermissions([]);

    localStorage.removeItem(STORAGE_KEYS.POS_MACHINE_INFO);
    localStorage.removeItem(STORAGE_KEYS.POS_MACHINE_MODULE);
    localStorage.removeItem(STORAGE_KEYS.POS_MACHINE_PERMISSIONS);

    setIsAuthenticated(false);
    setAuthMode('account');
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
      const userToken = localStorage.getItem('fnb_auth_token');
      const posMachineToken = getPosMachineToken();

      if (posMachineToken) {
        try {
          const storedInfo = localStorage.getItem(STORAGE_KEYS.POS_MACHINE_INFO);
          const storedModule = localStorage.getItem(STORAGE_KEYS.POS_MACHINE_MODULE);
          const storedPermissions = localStorage.getItem(STORAGE_KEYS.POS_MACHINE_PERMISSIONS);

          if (storedInfo) {
            setPosMachineInfo(JSON.parse(storedInfo));
            setPosMachineModule(storedModule);
            if (storedPermissions) {
              setPosMachinePermissions(JSON.parse(storedPermissions));
            }
            setIsAuthenticated(true);
            setAuthMode('pos_machine');
          }
        } catch {
          clearPosMachineToken();
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
        deviceInfo,
        branchInfo,

        devicePermissions,
        deviceFeatures,
        enabledFeatures,
        deviceType,

        posMachineInfo,
        posMachineTemplate,
        posMachineModule,
        posMachineModules,

        setUser,
        login,
        loginWithPosPin,
        loginByPin,

        logout,
        logoutDevice,
        logoutPosMachine,

        hasDevicePermission,
        hasAnyDevicePermission,
        hasDeviceFeature,

        isDeviceMode: authMode === 'device',
        isPosMachineMode: authMode === 'pos_machine',

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