import { apiFetch, ordersFetch } from './client';
import type {
  MenuItem,
  InventoryItem,
  DashboardData,
  TopSellingItem,
  InventoryStats,
  PosOrder,
  DailyOrdersResponse,
  User,
  Branch,
  CategoryItem,
  TableItem,
  DeleteDependencyReport,
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

/** Lấy auth headers từ user token hoặc POS device token */
function getAuthHeaders(): Record<string, string> {
  const userToken = localStorage.getItem('fnb_auth_token');
  const posToken = getPosToken();
  const token = userToken || posToken;
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

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
  list: (params?: { branchId?: string }) => {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    const query = q.toString();
    const headers = getAuthHeaders();
    return apiFetch<CategoryItem[]>(`/categories${query ? `?${query}` : ''}`, { auth: false, headers });
  },

  get: (id: string) =>
    apiFetch<CategoryItem>(`/categories/${id}`),

  create: (body: { name: string; description?: string; sortOrder?: number; active?: boolean }) =>
    apiFetch<CategoryItem>('/categories', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: { name?: string; description?: string; sortOrder?: number; active?: boolean }) =>
    apiFetch<CategoryItem>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  delete: (id: string) =>
    apiFetch<null>(`/categories/${id}`, { method: 'DELETE' }),
};

// --- Menu ---
export const menuApi = {
  list: (params?: { search?: string; category?: string; available?: string; branchId?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category && params.category !== 'all') q.set('category', params.category);
    if (params?.available) q.set('available', params.available);
    if (params?.branchId) q.set('branchId', params.branchId);
    const query = q.toString();
    const headers = getAuthHeaders();
    return apiFetch<MenuItem[]>(`/menu-items${query ? `?${query}` : ''}`, { auth: false, headers });
  },

  getById: (id: string) =>
    apiFetch<MenuItem>(`/menu-items/${id}`),

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
    apiFetch<import('../types').DeleteDependencyReport>(`/ingredients/${id}`, { method: 'DELETE' }),

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

// --- Dashboard ---
export const dashboardApi = {
  get: () => apiFetch<DashboardData>('/dashboard'),
  getV2: (chartRange?: string) => {
    const q = chartRange ? `?chartRange=${chartRange}` : '';
    return apiFetch<import('../types').DashboardDataV2>(`/dashboard${q}`);
  },
};

// --- Branches ---
export type BranchPayload = Pick<
  Branch,
  'name' | 'address' | 'phone' | 'plan' | 'subscriptionStatus' | 'subscriptionStart' | 'subscriptionEnd' | 'active'
> & {
  email: string;
  fullName?: string;
};

export type CreateBranchResult = {
  email: string;
  inviteLink: string;
};

export const branchApi = {
  list: () => apiFetch<Branch[]>('/branches'),

  create: (body: BranchPayload) =>
    apiFetch<CreateBranchResult>('/branches', { method: 'POST', body: JSON.stringify(body) }),

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
      inviteLink?: string;
    }>(`/branches/${id}/reset-password`, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined,
    }),
};

// --- Invite (Set Password) ---
export const inviteApi = {
  verify: (token: string) =>
    apiFetch<{ valid: boolean; email?: string; fullName?: string }>(
      `/invite/verify?token=${encodeURIComponent(token)}`,
      { auth: false }
    ),

  setPassword: (token: string, password: string) =>
    apiFetch<null>(
      '/invite/set-password',
      { method: 'POST', body: JSON.stringify({ token, password }), auth: false }
    ),
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

  listPos: () => {
    return apiFetch<TableItem[]>('/tables/pos/list', { auth: false, headers: getAuthHeaders() });
  },

  assignOrder: (tableId: string, orderId: string) =>
    apiFetch<TableItem>(`/tables/${tableId}/assign-order`, { method: 'POST', body: JSON.stringify({ orderId }) }),

  release: (tableId: string) =>
    apiFetch<TableItem>(`/tables/${tableId}/release`, { method: 'POST' }),

  updateStatus: (tableId: string, status: string) =>
    apiFetch<TableItem>(`/tables/${tableId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  checkIn: (tableId: string) => {
    return apiFetch<TableItem>(`/tables/${tableId}/check-in`, { method: 'POST', auth: false, headers: getAuthHeaders() });
  },
};

// --- Orders ---
export const ordersApi = {
  list: () => ordersFetch<PosOrder[]>(),
  create: (body: { table: number; items: unknown[]; time?: string; tableId?: string }) =>
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

  /** Chi tiết đơn hàng */
  getDetail: (orderId: string) =>
    apiFetch<import('../types').OrderDetailSimple>(`/orders/${orderId}`),

  /** Lịch sử đơn hàng */
  history: (params?: { startDate?: string; endDate?: string; status?: string; source?: string }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.status) q.set('status', params.status);
    if (params?.source) q.set('source', params.source);
    const query = q.toString();
    return apiFetch<import('../types').OrderDetail[]>(`/orders/history${query ? `?${query}` : ''}`);
  },

  getActiveByTable: (tableId: string) =>
    apiFetch<import('../types').OrderDetail | null>(`/orders/by-table/${tableId}`),

  createPos: (body: { table: string; tableId: string; items: Array<{ menuItemId: string; quantity: number }>; orderType: string }) => {
    return apiFetch<import('../types').PosOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
      headers: getAuthHeaders(),
    });
  },

  /** Thanh toán - hoàn tất đơn và giải phóng bàn (không xóa) */
  completePayment: (tableNumber: string | number, paymentMethod: string = 'CASH') => {
    return apiFetch<import('../types').PosOrder[]>('/orders/complete-payment', {
      method: 'POST',
      body: JSON.stringify({ table: tableNumber, paymentMethod }),
      auth: false,
      headers: getAuthHeaders(),
    });
  },
};

// --- Order Queue POS ---
export const ordersQueueApi = {
  list: (params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    const query = q.toString();
    return apiFetch<import('../types').OrderDetail[]>(`/orders/queue${query ? `?${query}` : ''}`);
  },
  create: (body: { items: Array<{ menuItemId: string; quantity: number }> }) => {
    return apiFetch<import('../types').OrderDetail>('/orders/queue', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  update: (id: string, body: { items: Array<{ menuItemId: string; quantity: number }>; discount?: number }) => {
    return apiFetch<import('../types').OrderDetail>(`/orders/queue/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  cancel: (id: string) => {
    return apiFetch<import('../types').OrderDetail>(`/orders/queue/${id}/cancel`, {
      method: 'POST',
    });
  },
  pay: (id: string, paymentMethod: string = 'CASH') => {
    return apiFetch<import('../types').OrderDetail>(`/orders/queue/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  },
};
