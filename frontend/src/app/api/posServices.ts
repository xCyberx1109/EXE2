import { apiFetch } from './client';
import type {
  PosMode,
  PosDeviceV2, CreatePosDeviceResponse,
  DeviceRegeneratePinResponse, DeviceRevokeResponse, DeviceResetResponse,
  PosMachine, PosMachineDetail, PosMachineTemplate,
  PosMachineCreateResponse, PosMachineLoginResponse, LoginByPinResult,
} from '../types';

// ======== POS v2 Device Management API ========
export const posDevicesV2Api = {
  list: () =>
    apiFetch<PosDeviceV2[]>('/pos-v2/devices'),

  create: (body: { name: string; template: PosMachineTemplate }) =>
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
    apiFetch<DeviceResetResponse>('/pos-v2/devices/reset', {
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

// ======== POS Machine API (runtime device management) ========
export const posMachineApi = {
  listActive: () =>
    apiFetch<PosMachine[]>('/pos-machine/active', { auth: false }),

  list: () =>
    apiFetch<PosMachine[]>('/pos-machine'),

  get: (id: string) =>
    apiFetch<PosMachineDetail>(`/pos-machine/${id}`),

  create: (body: { name: string; template: PosMachineTemplate }) =>
    apiFetch<PosMachineCreateResponse>('/pos-machine', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: { name?: string; template?: PosMachineTemplate }) =>
    apiFetch<PosMachine>(`/pos-machine/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  resetPin: (id: string) =>
    apiFetch<{ id: string; pinCode: string }>(`/pos-machine/${id}/reset-pin`, {
      method: 'PUT',
    }),

  toggleLock: (id: string) =>
    apiFetch<PosMachine>(`/pos-machine/${id}/toggle-lock`, {
      method: 'PUT',
    }),

  delete: (id: string) =>
    apiFetch<null>(`/pos-machine/${id}`, { method: 'DELETE' }),

  updatePermissions: (id: string, permissionIds: string[]) =>
    apiFetch<null>(`/pos-machine/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: permissionIds }),
    }),

  /** Official POS Machine login — requires machineId and pinCode */
  login: (pinCode: string, machineId?: string) =>
    apiFetch<PosMachineLoginResponse>('/pos-machine/login', {
      method: 'POST',
      body: JSON.stringify({ pinCode, machineId }),
      auth: false,
    }),

  /** PIN-only login — no machine selection needed */
  loginByPin: (pinCode: string) =>
    apiFetch<LoginByPinResult>('/pos-machine/login-by-pin', {
      method: 'POST',
      body: JSON.stringify({ pinCode }),
      auth: false,
    }),
};

// Device token helpers (used by device auth flows)
const POS_TOKEN_KEY = 'fnb_pos_token';
export const getPosToken = () => localStorage.getItem(POS_TOKEN_KEY);
export const setPosToken = (token: string) => localStorage.setItem(POS_TOKEN_KEY, token);
export const clearPosToken = () => localStorage.removeItem(POS_TOKEN_KEY);
export const clearAllPosStorage = () => { clearPosToken(); };
