import { apiFetch, ordersFetch } from './client';
import type {
  MenuItem,
  InventoryItem,
  RevenueRecord,
  RevenueSummary,
  DashboardData,
  TopSellingItem,
  InventoryStats,
  PosOrder,
  DailyOrdersResponse,
  User,
  Branch,
  CategoryItem,
  TableItem,
} from '../types';

// Payload used by menu create/update. Recipe rows are persisted to MenuItemIngredient.
export type MenuItemPayload = Partial<Omit<MenuItem, 'ingredients'>> & {
  ingredients?: Array<{ ingredientId: string; amount: number }>;
};

// --- Auth ---
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: User }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }), auth: false }
    ),
  getMe: () =>
    apiFetch<User>('/auth/me', { auth: true }),

  updateMe: (body: { fullName?: string; email?: string }) =>
    apiFetch<User>('/auth/me', { method: 'PUT', body: JSON.stringify(body), auth: true }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiFetch<null>('/auth/change-password', { method: 'PUT', body: JSON.stringify(body), auth: true }),

  resetMyPassword: () =>
    apiFetch<{ email: string }>('/auth/reset-my-password', { method: 'POST', auth: true }),
};

const POS_TOKEN_KEY = 'fnb_pos_token';
function getPosToken() { return localStorage.getItem(POS_TOKEN_KEY); }

function deviceFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getPosToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return apiFetch<T>(path, { ...options, headers });
}

export const deviceAuthApi = {
  loginWithPin: (body: { setupPin: string; fingerprint?: string; deviceName?: string }) =>
    apiFetch<import('../types').DeviceLoginResponse>(
      '/auth/pos/login',
      { method: 'POST', body: JSON.stringify(body), auth: false }
    ),

  refreshToken: (refreshToken: string) =>
    deviceFetch<import('../types').DeviceRefreshResponse>(
      '/auth/pos/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }) },
    ),

  logout: () =>
    deviceFetch<null>('/auth/pos/logout', { method: 'POST' }),

  getSessions: () =>
    deviceFetch<import('../types').DeviceSessionInfo[]>('/auth/pos/sessions'),

  revokeSession: (sessionId: string) =>
    deviceFetch<null>(`/auth/pos/sessions/${sessionId}`, { method: 'DELETE' }),
};

// --- Categories ---
export const categoryApi = {
  list: () => apiFetch<{ id: string; name: string; slug: string; description: string; itemCount: number }[]>('/categories'),
};

// --- Menu ---
export const menuApi = {
  list: (params?: { search?: string; category?: string; available?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category && params.category !== 'all') q.set('category', params.category);
    if (params?.available) q.set('available', params.available);
    const query = q.toString();
    return apiFetch<MenuItem[]>(`/menu-items${query ? `?${query}` : ''}`);
  },

  topSelling: (limit = 10) =>
    apiFetch<TopSellingItem[]>(`/menu-items/top-selling?limit=${limit}`),

  create: (body: MenuItemPayload) =>
    apiFetch<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: MenuItemPayload) =>
    apiFetch<MenuItem>(`/menu-items/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  toggleAvailability: (id: string) =>
    apiFetch<MenuItem>(`/menu-items/${id}/availability`, { method: 'PATCH' }),

  delete: (id: string) =>
    apiFetch<null>(`/menu-items/${id}`, { method: 'DELETE' }),
};

// --- Inventory ---
export const inventoryApi = {
  list: (params?: { search?: string; lowStock?: boolean; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.lowStock) q.set('lowStock', 'true');
    if (params?.status) q.set('status', params.status);
    const query = q.toString();
    return apiFetch<InventoryItem[]>(`/ingredients${query ? `?${query}` : ''}`);
  },

  stats: () => apiFetch<InventoryStats>('/ingredients/stats'),

  create: (body: Record<string, unknown>) =>
    apiFetch<InventoryItem>('/ingredients', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Record<string, unknown>) =>
    apiFetch<InventoryItem>(`/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (id: string) =>
    apiFetch<null>(`/ingredients/${id}`, { method: 'DELETE' }),

  stockIn: (id: string, quantity: number, note?: string) =>
    apiFetch<{ ingredient: InventoryItem }>(`/ingredients/${id}/stock-in`, {
      method: 'POST',
      body: JSON.stringify({ quantity, note }),
    }),

  stockOut: (id: string, quantity: number, note?: string) =>
    apiFetch<{ ingredient: InventoryItem }>(`/ingredients/${id}/stock-out`, {
      method: 'POST',
      body: JSON.stringify({ quantity, note }),
    }),
};

// --- Revenue ---
export const revenueApi = {
  daily: (range: '7days' | '14days' | '30days') =>
    apiFetch<RevenueRecord[]>(`/revenue/daily?range=${range}`),

  summary: (range: '7days' | '14days' | '30days') =>
    apiFetch<RevenueSummary>(`/revenue/summary?range=${range}`),

  topItems: (limit = 10) =>
    apiFetch<TopSellingItem[]>(`/revenue/top-items?limit=${limit}`),
};

// --- Dashboard ---
export const dashboardApi = {
  get: () => apiFetch<DashboardData>('/dashboard'),
};

// --- Branches ---
export type BranchPayload = Pick<
  Branch,
  'name' | 'address' | 'phone' | 'plan' | 'subscriptionStatus' | 'subscriptionStart' | 'subscriptionEnd' | 'active'
> & {
  email: string;
  fullName?: string;
};

export const branchApi = {
  list: () => apiFetch<Branch[]>('/branches'),

  create: (body: BranchPayload) =>
    apiFetch<Branch>('/branches', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: BranchPayload) =>
    apiFetch<Branch>(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  lock: (id: string) =>
    apiFetch<{ id: string; active: boolean }>(`/branches/${id}/lock`, { method: 'PATCH' }),

  unlock: (id: string) =>
    apiFetch<{ id: string; active: boolean }>(`/branches/${id}/unlock`, { method: 'PATCH' }),

  delete: (id: string) =>
    apiFetch<null>(`/branches/${id}`, { method: 'DELETE' }),

  forceDelete: (id: string) =>
    apiFetch<{ branchName: string; stats: Record<string, { count: number }> }>(`/branches/${id}/force`, { method: 'DELETE' }),

  resetManagerPassword: (id: string, body?: { newPassword?: string }) =>
    apiFetch<{
      branchId: string;
      branchName: string;
      accountEmail: string;
      accountFullName: string;
    }>(`/branches/${id}/reset-password`, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined,
    }),
};

// --- Tables ---
export const tableApi = {
  list: () => apiFetch<TableItem[]>('/tables'),

  get: (id: string) => apiFetch<TableItem>(`/tables/${id}`),

  create: (body: { tableCode: string; tableName?: string; capacity: number; status?: string }) =>
    apiFetch<TableItem>('/tables', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: { tableCode?: string; tableName?: string; capacity?: number; status?: string }) =>
    apiFetch<TableItem>(`/tables/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (id: string) =>
    apiFetch<null>(`/tables/${id}`, { method: 'DELETE' }),
};

// --- Orders ---
export const ordersApi = {
  list: () => ordersFetch<PosOrder[]>(),
  create: (body: { table: number; items: unknown[]; time?: string }) =>
    ordersFetch<PosOrder>('', { method: 'POST', body: JSON.stringify(body) }),
  delete: (id: string) => ordersFetch<void>(`/${id}`, { method: 'DELETE' }),

  /** Đơn hàng trong ngày (API chuẩn) */
  listByDate: (date?: string, status?: string) => {
    const q = new URLSearchParams();
    if (date) q.set('date', date);
    if (status && status !== 'all') q.set('status', status);
    const query = q.toString();
    return apiFetch<DailyOrdersResponse>(`/orders/daily${query ? `?${query}` : ''}`);
  },

};
