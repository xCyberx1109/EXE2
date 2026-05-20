import { API_PREFIX, API_BASE } from './config';
import type { ApiResponse } from '../types';

const TOKEN_KEY = 'fnb_auth_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
const clearLegacyTokenCookie = () => {
  // Dọn cookie cũ (nếu trước đó đã từng lưu token trong cookie)
  document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  clearLegacyTokenCookie();
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = RequestInit & { auth?: boolean };

/** Gọi API chuẩn { success, message, data } */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const reqHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (auth) {
    const token = getToken();
    if (token) {
      (reqHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_PREFIX}${path}`, {
    ...rest,
    headers: reqHeaders,
  });

  const json = (await res.json()) as ApiResponse<T> | { success: false; message: string; error?: unknown };

  if (!res.ok || !json.success) {
    throw new ApiError(
      json.message || 'Có lỗi xảy ra',
      res.status,
      'error' in json ? json.error : undefined
    );
  }

  return json.data;
}

/** Fetch legacy POS /orders (JSON thuần, không envelope) */
export async function ordersFetch<T>(path = '', options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/orders${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok && res.status !== 204) {
    throw new ApiError('Không thể kết nối orders API', res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
