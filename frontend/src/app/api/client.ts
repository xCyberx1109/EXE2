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

const FETCH_TIMEOUT = 10_000; // 10s

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const res = await fetch(`${API_PREFIX}${path}`, {
      ...rest,
      headers: reqHeaders,
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
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

/** Wrapper tiện lợi cho apiFetch */
export const api = {
  get: <T>(path: string, options?: RequestOptions) => 
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: any, options?: RequestOptions) => 
    apiFetch<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: any, options?: RequestOptions) => 
    apiFetch<T>(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: any, options?: RequestOptions) => 
    apiFetch<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, options?: RequestOptions) => 
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
