import { apiFetch } from './client';
import type {
  PosMode,
  PosDeviceV2, CreatePosDeviceResponse,
  StaffLoginResponse, ActiveStaff, OpenShiftRequest, CloseShiftRequest,
  ShiftResponse, CurrentShift, DeviceRegeneratePinResponse, DeviceRevokeResponse,
} from '../types';

const POS_TOKEN_KEY = 'fnb_pos_token';

export const getPosToken = () => localStorage.getItem(POS_TOKEN_KEY);
export const setPosToken = (token: string) => localStorage.setItem(POS_TOKEN_KEY, token);
export const clearPosToken = () => localStorage.removeItem(POS_TOKEN_KEY);

export const clearAllPosStorage = () => {
  clearPosToken();
};

// ======== POS v2 API Services ========

function posV2Fetch<T>(path: string, options: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getPosToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return apiFetch<T>(path, { ...rest, headers });
}

export const posDevicesV2Api = {
  list: () =>
    apiFetch<PosDeviceV2[]>('/pos-v2/devices'),

  create: (body: { name: string; type: string; mode?: PosMode }) =>
    apiFetch<CreatePosDeviceResponse>('/pos-v2/devices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  regeneratePin: (deviceId: string) =>
    apiFetch<DeviceRegeneratePinResponse>('/pos-v2/devices/regenerate-pin', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    }),

  reset: (deviceId: string) =>
    apiFetch<DeviceRegeneratePinResponse>('/pos-v2/devices/reset', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    }),

  revoke: (deviceId: string, reason?: string) =>
    apiFetch<DeviceRevokeResponse>('/pos-v2/devices/revoke', {
      method: 'POST',
      body: JSON.stringify({ deviceId, reason }),
    }),

  get: (id: string) =>
    apiFetch<PosDeviceV2>(`/pos-v2/devices/${id}`),

  toggle: (id: string, active: boolean) =>
    apiFetch<PosDeviceV2>(`/pos-v2/devices/${id}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ active }),
    }),

  delete: (id: string) =>
    apiFetch<null>(`/pos-v2/devices/${id}`, { method: 'DELETE' }),

  updateMode: (id: string, mode: PosMode) =>
    apiFetch<PosDeviceV2>(`/pos-v2/devices/${id}/mode`, {
      method: 'PUT',
      body: JSON.stringify({ mode }),
    }),

  logs: (id: string) =>
    apiFetch<Array<{ id: string; action: string; details: unknown; createdAt: string }>>(
      `/pos-v2/devices/${id}/logs`,
    ),
};

export const staffAuthApi = {
  loginPin: (pinCode: string) =>
    posV2Fetch<StaffLoginResponse>('/pos-v2/staff-auth/login-pin', {
      method: 'POST',
      body: JSON.stringify({ pinCode }),
    }),

  logout: (accountId?: string) =>
    posV2Fetch<null>('/pos-v2/staff-auth/logout', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    }),

  switchStaff: (pinCode: string) =>
    posV2Fetch<StaffLoginResponse>('/pos-v2/staff-auth/switch', {
      method: 'POST',
      body: JSON.stringify({ pinCode }),
    }),

  activeStaff: () =>
    posV2Fetch<ActiveStaff[]>('/pos-v2/staff-auth/active'),
};

export const shiftApi = {
  open: (body: OpenShiftRequest) =>
    posV2Fetch<ShiftResponse>('/pos-v2/shifts/open', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  close: (body: CloseShiftRequest) =>
    posV2Fetch<ShiftResponse>('/pos-v2/shifts/close', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  current: () =>
    posV2Fetch<CurrentShift | null>('/pos-v2/shifts/current'),

  history: (params?: { limit?: number; offset?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.status) q.set('status', params.status);
    return posV2Fetch<{ shifts: ShiftResponse[]; total: number }>(
      `/pos-v2/shifts/history?${q}`,
    );
  },

  get: (id: string) =>
    posV2Fetch<ShiftResponse>(`/pos-v2/shifts/${id}`),
};

// Legacy device auth (kept for backward compat)
export const legacyDeviceAuthApi = {
  refresh: () =>
    posV2Fetch<{ deviceToken: string; expiresAt: string }>('/pos-v2/device-auth/refresh', {
      method: 'POST',
    }),

  logout: () =>
    posV2Fetch<null>('/pos-v2/device-auth/logout', { method: 'POST' }),
};

// Unified device auth API (uses new /auth/pos/* endpoints)
export const deviceAuthApi = {
  refresh: (refreshToken?: string) =>
    apiFetch<{ deviceToken: string; refreshToken: string; expiresAt: string }>(
      '/auth/pos/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refreshToken || getPosToken() }),
        auth: false,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getPosToken()}` },
      } as RequestInit & { auth?: boolean }
    ),
  logout: () =>
    apiFetch<null>('/auth/pos/logout', {
      method: 'POST', auth: false,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getPosToken()}` },
    } as RequestInit & { auth?: boolean }),
};
