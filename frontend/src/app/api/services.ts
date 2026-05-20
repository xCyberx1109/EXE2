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
} from '../types';

// --- Auth ---
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: { id: string; email: string; fullName: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }), auth: false }
    ),
};

// --- Menu ---
export const menuApi = {
  list: (params?: { search?: string; category?: string; available?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category && params.category !== 'all') q.set('category', params.category);
    if (params?.available) q.set('available', params.available);
    const query = q.toString();
    return apiFetch<MenuItem[]>(`/menu-items${query ? `?${query}` : ''}`, { auth: false });
  },

  topSelling: (limit = 10) =>
    apiFetch<TopSellingItem[]>(`/menu-items/top-selling?limit=${limit}`, { auth: false }),

  create: (body: Partial<MenuItem>) =>
    apiFetch<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<MenuItem>) =>
    apiFetch<MenuItem>(`/menu-items/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  toggleAvailability: (id: string) =>
    apiFetch<MenuItem>(`/menu-items/${id}/availability`, { method: 'PATCH' }),

  delete: (id: string) =>
    apiFetch<null>(`/menu-items/${id}`, { method: 'DELETE' }),
};

// --- Inventory ---
export const inventoryApi = {
  list: (params?: { search?: string; lowStock?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.lowStock) q.set('lowStock', 'true');
    const query = q.toString();
    return apiFetch<InventoryItem[]>(`/ingredients${query ? `?${query}` : ''}`, { auth: false });
  },

  stats: () => apiFetch<InventoryStats>('/ingredients/stats', { auth: false }),

  create: (body: Partial<InventoryItem>) =>
    apiFetch<InventoryItem>('/ingredients', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<InventoryItem>) =>
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
    apiFetch<RevenueRecord[]>(`/revenue/daily?range=${range}`, { auth: false }),

  summary: (range: '7days' | '14days' | '30days') =>
    apiFetch<RevenueSummary>(`/revenue/summary?range=${range}`, { auth: false }),

  topItems: (limit = 10) =>
    apiFetch<TopSellingItem[]>(`/revenue/top-items?limit=${limit}`, { auth: false }),
};

// --- Dashboard ---
export const dashboardApi = {
  get: () => apiFetch<DashboardData>('/dashboard', { auth: false }),
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
    return apiFetch<DailyOrdersResponse>(`/orders/daily${query ? `?${query}` : ''}`, { auth: false });
  },

};
