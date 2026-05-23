import { apiFetch } from './client';
import type {
  PosDevice, PosDeviceCreatePayload, PosLoginResponse, PosProfile, ResetPinResponse,
} from '../types';

const POS_TOKEN_KEY = 'fnb_pos_token';
const POS_DEVICE_CODE_KEY = 'fnb_pos_device_code';

export const getPosToken = () => localStorage.getItem(POS_TOKEN_KEY);
export const setPosToken = (token: string) => localStorage.setItem(POS_TOKEN_KEY, token);
export const clearPosToken = () => localStorage.removeItem(POS_TOKEN_KEY);

export const getPosDeviceCode = () => localStorage.getItem(POS_DEVICE_CODE_KEY);
export const setPosDeviceCode = (code: string) => localStorage.setItem(POS_DEVICE_CODE_KEY, code);
export const clearPosDeviceCode = () => localStorage.removeItem(POS_DEVICE_CODE_KEY);

export const clearAllPosStorage = () => {
  clearPosToken();
  clearPosDeviceCode();
};

// POS Auth API (dùng token riêng)
function posFetch<T>(path: string, options: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getPosToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return apiFetch<T>(path, { ...rest, headers });
}

export const posAuthApi = {
  login: (deviceCode: string, pin: string) =>
    posFetch<PosLoginResponse>('/pos/auth/login', {
      method: 'POST',
      body: JSON.stringify({ deviceCode, pin }),
      auth: false,
    }),

  logout: () =>
    posFetch<null>('/pos/auth/logout', { method: 'POST' }),

  ping: () =>
    posFetch<{ lastActive: string }>('/pos/auth/ping', { method: 'POST' }),

  profile: () =>
    posFetch<PosProfile>('/pos/auth/profile'),
};

// POS Device Management API (dùng admin token)
export const posDeviceApi = {
  list: () =>
    apiFetch<PosDevice[]>('/pos/devices'),

  create: (body: PosDeviceCreatePayload) =>
    apiFetch<PosDevice>('/pos/devices', { method: 'POST', body: JSON.stringify(body) }),

  toggle: (id: string, active: boolean) =>
    apiFetch<PosDevice>(`/pos/devices/${id}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ active }),
    }),

  delete: (id: string) =>
    apiFetch<null>(`/pos/devices/${id}`, { method: 'DELETE' }),

  get: (id: string) =>
    apiFetch<PosDevice>(`/pos/devices/${id}`),

  resetPin: (deviceId: string) =>
    apiFetch<ResetPinResponse>('/pos/devices/reset-pin', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    }),
};
