import { API_PREFIX, API_BASE } from './config';
import type { ApiResponse } from '../types';

const TOKEN_KEY = 'fnb_auth_token';
const EMPLOYEE_TOKEN_KEY = 'fnb_employee_token';

/** Ưu tiên Employee token khi đã đăng nhập bằng PIN */
export const getToken = () =>
  localStorage.getItem(EMPLOYEE_TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
const clearLegacyTokenCookie = () => {
  document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMPLOYEE_TOKEN_KEY);
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

const FETCH_TIMEOUT = 30_000;
const RETRY_ATTEMPTS = 1;
const RETRY_DELAY = 500;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    const authHeader = token ? `Bearer ${token}` : undefined;
    if (authHeader) {
      (reqHeaders as Record<string, string>)['Authorization'] = authHeader;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
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
    } catch (err: any) {
      lastError = err;

      if (err.name === 'AbortError') {
        console.warn(`[API] Request aborted (attempt ${attempt + 1}/${RETRY_ATTEMPTS + 1}): ${path}`);
        if (attempt < RETRY_ATTEMPTS) {
          await delay(RETRY_DELAY * (attempt + 1));
          continue;
        }
        throw new ApiError(
          'Máy chủ không phản hồi, vui lòng thử lại',
          504,
          { retry: true }
        );
      }

      if (err instanceof TypeError && err.message === 'Failed to fetch' && attempt < RETRY_ATTEMPTS) {
        await delay(RETRY_DELAY * (attempt + 1));
        continue;
      }

      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new ApiError('Request failed', 500);
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
