import { apiFetch, ordersFetch } from './client';
import type {
  MenuItem,
  InventoryItem,
  SellableItem,
  DashboardData,
  TopSellingItem,
  InventoryStats,
  PosOrder,
  DailyOrdersResponse,
  User,
  Branch,
  BranchInvitation,
  TableItem,
  DeleteDependencyReport,
  InventoryIssue,
  Employee, EmployeeFormData, EmployeeCreateResponse, EmployeeLogsResponse, EmployeeLoginResponse,
  BranchBankAccount,
  PermissionTemplatesResponse,
  PaginatedResponse,
} from '../types';

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }

  const result = query.toString();
  return result ? `?${result}` : '';
}

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

  forgotPassword: (email: string) =>
    apiFetch<null>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }), auth: false }),

  resetPassword: (token: string, password: string) =>
    apiFetch<null>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }), auth: false }),

  getPaymentInfo: () =>
    apiFetch<BranchBankAccount | null>('/auth/me/payment', { auth: true }),

  updatePaymentInfo: (body: { bankCode: string; bankName: string; accountNumber: string; accountHolder: string }) =>
    apiFetch<BranchBankAccount>('/auth/me/payment', {
      method: 'PUT',
      body: JSON.stringify(body),
      auth: true,
    }),
};

const POS_TOKEN_KEY = 'fnb_pos_token';
function getPosToken() { return localStorage.getItem(POS_TOKEN_KEY); }

/** Lấy auth headers từ user token hoặc POS device token hoặc employee token */
function getAuthHeaders(): Record<string, string> {
  const userToken = localStorage.getItem('fnb_auth_token');
  const posToken = getPosToken();
  const empToken = localStorage.getItem('fnb_employee_token');
  const token = empToken || userToken || posToken;
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

};

// --- Menu ---
export const menuApi = {
  list: (params?: { page?: number; limit?: number; search?: string; available?: string; accountId?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.available) q.set('available', params.available);
    if (params?.accountId) q.set('accountId', params.accountId);
    const query = q.toString();
    const headers = getAuthHeaders();
    return apiFetch<PaginatedResponse<MenuItem> | MenuItem[]>(`/menu-items${query ? `?${query}` : ''}`, { auth: false, headers });
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

// --- QR gọi món theo bàn ---
export type QrOrderItem = {
  id: string;
  menuItemId: string | null;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type QrCurrentOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  items: QrOrderItem[];
  foodTotal: number;
  grandTotal: number;
  guestCount?: number;
};

export const qrMenuApi = {
  listTableLinks: () =>
    apiFetch<
      Array<{
        tableId: string;
        tableCode: string;
        tableName: string | null;
        token: string;
      }>
    >('/qr-menu/tables'),

  resolve: (token: string) =>
    apiFetch<{
      table: {
        id: string;
        tableCode: string;
        tableName: string | null;
        capacity: number;
      };
      menuItems: MenuItem[];
      currentOrder: QrCurrentOrder | null;
    }>(`/qr-menu/public?t=${encodeURIComponent(token)}`, {
      auth: false,
    }),

  submit: (
    token: string,
    body: {
      guestCount?: number;
      items: Array<{
        menuItemId: string;
        quantity: number;
      }>;
    },
  ) =>
    apiFetch<{
      table: {
        id: string;
        tableCode: string;
        tableName: string | null;
      };
      order: QrCurrentOrder;
    }>(`/qr-menu/public/order?t=${encodeURIComponent(token)}`, {
      method: 'POST',
      body: JSON.stringify(body),
      auth: false,
    }),
};


// --- Inventory ---
export const inventoryApi = {
  list: (params?: { page?: number; limit?: number; search?: string; lowStock?: boolean; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.lowStock) q.set('lowStock', 'true');
    if (params?.status) q.set('status', params.status);
    const query = q.toString();
    return apiFetch<PaginatedResponse<InventoryItem> | InventoryItem[]>(`/ingredients${query ? `?${query}` : ''}`);
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

  listSellable: () =>
    apiFetch<SellableItem[]>('/inventory/sellable'),

  bulkImport: (body: { items: Array<{ ingredientId: string; quantity: number }>; reason: string }) =>
    apiFetch<{ transactions: any[] }>('/inventory/import', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  bulkExport: (body: { items: Array<{ ingredientId: string; quantity: number }>; reason: string }) =>
    apiFetch<{ transactions: any[] }>('/inventory/export', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listTransactions: (params?: { page?: number; limit?: number; type?: string; search?: string }) => {
    const q = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return apiFetch<import('../types').PaginatedResponse<import('../types').InventoryTransaction>>(`/inventory/transactions${q}`);
  },
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
  permissions?: string[];
};

export type CreateBranchResult = {
  email: string;
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
      accountId: string;
      accountName: string;
      accountEmail: string;
      accountFullName: string;
      inviteLink?: string;
    }>(`/branches/${id}/reset-password`, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined,
    }),
};

// --- Branch Invitations ---
export const invitationApi = {
  create: (body: { email: string; plan: string }) =>
    apiFetch<{ id: string; email: string }>('/branch-invitations', { method: 'POST', body: JSON.stringify(body) }),

  list: () => apiFetch<BranchInvitation[]>('/branch-invitations'),

  verify: (token: string) =>
    apiFetch<{ valid: boolean; email: string; packageId: string; packageName: string; planCode: string }>(
      `/branch-invitations/verify?token=${encodeURIComponent(token)}`,
      { auth: false }
    ),

  accept: (body: {
    token: string;
    branchName: string;
    address: string;
    phone: string;
    password: string;
    bankName: string;
    bankCode: string;
    accountHolder: string;
    accountNumber: string;
  }) =>
    apiFetch<{ email: string }>(
      '/branch-invitations/accept',
      { method: 'POST', body: JSON.stringify(body), auth: false }
    ),

  resend: (id: string) =>
    apiFetch<{ id: string }>(`/branch-invitations/${id}/resend`, { method: 'POST' }),

  cancel: (id: string) =>
    apiFetch<{ id: string }>(`/branch-invitations/${id}/cancel`, { method: 'POST' }),
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
  list: (params?: { page?: number; limit?: number }) => {
    const q = buildQueryString(params);
    return apiFetch<PaginatedResponse<TableItem> | TableItem[]>(`/tables${q}`);
  },

  get: (id: string) => apiFetch<TableItem>(`/tables/${id}`),

  create: (body: { tableCode: string; tableName?: string; capacity: number; status?: string; hourlyRate?: number }) =>
    apiFetch<TableItem>('/tables', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: { tableCode?: string; tableName?: string; capacity?: number; status?: string; hourlyRate?: number }) =>
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
    const s = status ? status.toUpperCase() : '';
    if (s && s !== 'ALL') q.set('status', s);
    const query = q.toString();
    return apiFetch<DailyOrdersResponse>(`/orders/daily${query ? `?${query}` : ''}`);
  },

  /** Chi tiết đơn hàng */
  getDetail: (orderId: string) =>
    apiFetch<import('../types').OrderDetailSimple>(`/orders/${orderId}`),

  /** Lịch sử đơn hàng */
  history: (params?: { startDate?: string; endDate?: string; status?: string; source?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.status) q.set('status', params.status.toUpperCase());
    if (params?.source) q.set('source', params.source);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const query = q.toString();
    return apiFetch<import('../types').OrderDetail[] | import('../types').PaginatedResponse<import('../types').OrderDetail>>(`/orders/history${query ? `?${query}` : ''}`);
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

};

// --- Order Queue POS ---
export const ordersQueueApi = {
  list: (params?: { search?: string; status?: string; paymentStatus?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    const status = params?.status ? params.status.toUpperCase() : '';
    if (status && status !== 'ALL') q.set('status', status);
    if (params?.paymentStatus) q.set('paymentStatus', params.paymentStatus.toUpperCase());
    const query = q.toString();
    return apiFetch<import('../types').OrderDetail[]>(`/orders/queue${query ? `?${query}` : ''}`);
  },
  create: (body: { items: Array<{ menuItemId: string; quantity: number }> }) => {
    return apiFetch<import('../types').OrderDetail>('/orders/queue', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  update: (id: string, body: { items?: Array<{ menuItemId: string; quantity: number }>; discount?: number; status?: string; note?: string }) => {
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
    return apiFetch<import('../types').OrderDetail | { inventoryIssues: InventoryIssue[]; orderId: string }>(`/orders/queue/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  },
};

// --- Billiard ---
export interface BilliardTable {
  id: string;
  accountId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  tableType: 'POOL' | 'SNOOKER' | 'VIP';
  posX: number;
  posY: number;
  xPercent: number;
  yPercent: number;
  hourlyRate: number;
  status: import('../types').TableStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BilliardPlaySession {
  id: string;
  tableId: string;
  startTime: string | null;
  expectedEndTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  tableFee: number;
  status: 'PLAYING' | 'COMPLETED' | 'CANCELLED';
}

export interface BilliardReservation {
  id: string;
  tableId: string;
  branchId: string;
  customerName: string;
  phone: string | null;
  reservationTime: string;
  durationMinutes: number;
  note: string | null;
  status: 'PENDING' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
}

export type BilliardTableWithSession = BilliardTable & {
  currentSession?: BilliardPlaySession | null;
  currentReservation?: BilliardReservation | null;
};

export interface BilliardOrderSummaryItem {
  id: string;
  menuItemId: string | null;
  inventoryId: string | null;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface BilliardOrderSummary {
  sessionId: string | null;
  orderId: string | null;
  orderNumber: string | null;
  items: BilliardOrderSummaryItem[];
  foodTotal: number;
  tableFee: number;
  playingCost: number;
  hourlyRate: number;
  serviceCharge: number;
  tax: number;
  grandTotal: number;
  startTime: string | null;
  tableStatus: string;
}

export const billiardApi = {
  listTables: () =>
    apiFetch<BilliardTableWithSession[]>('/billiard/tables', { auth: false, headers: getAuthHeaders() }),

  create: (body: { tableCode: string; tableName?: string; tableType: string; capacity?: number; posX?: number; posY?: number; hourlyRate?: number }) =>
    apiFetch<BilliardTable>('/billiard/tables', {
      method: 'POST',
      body: JSON.stringify({ ...body, capacity: body.capacity ?? 4 }),
    }),

  updateLayout: (tables: { id: string; posX: number; posY: number }[]) =>
    apiFetch<BilliardTable[]>('/billiard/tables/layout', {
      method: 'PUT',
      body: JSON.stringify({ tables }),
    }),

  playNow: (tableId: string, body: { durationMinutes?: number; customerName?: string; phone?: string }) =>
    apiFetch<{ session: BilliardPlaySession; order: import('../types').PosOrder }>(
      `/billiard/tables/${tableId}/play-now`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  reserve: (tableId: string, body: { customerName: string; phone?: string; reservationDate: string; note?: string }) =>
    apiFetch<BilliardReservation>(
      `/billiard/tables/${tableId}/reserve`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  checkIn: (tableId: string) =>
    apiFetch<{ session: BilliardPlaySession; order: import('../types').PosOrder; reservation: BilliardReservation }>(
      `/billiard/tables/${tableId}/check-in`,
      { method: 'POST' }
    ),

  cancelReservation: (tableId: string) =>
    apiFetch<{ id: string; status: string }>(
      `/billiard/tables/${tableId}/cancel-reservation`,
      { method: 'POST' }
    ),

  getCurrentSession: (tableId: string) =>
    apiFetch<BilliardPlaySession | null>(`/billiard/tables/${tableId}/current-session`, { auth: false, headers: getAuthHeaders() }),

  finishSession: (tableId: string) =>
    apiFetch<{ id: string; status: string }>(
      `/billiard/tables/${tableId}/finish-session`,
      { method: 'POST' }
    ),

  addOrderItem: (orderId: string, body: { menuItemId?: string; inventoryId?: string; quantity: number }) =>
    apiFetch<{ order: import('../types').OrderDetail; item: import('../types').OrderItemDetail }>(
      `/billiard/orders/${orderId}/items`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  batchAddOrderItems: (orderId: string, body: { items: Array<{ inventoryId: string; quantity: number }> }) =>
    apiFetch<BilliardOrderSummary>(
      `/billiard/orders/${orderId}/items/batch`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  updateOrderItem: (orderId: string, itemId: string, body: { quantity: number }) =>
    apiFetch<import('../types').OrderItemDetail>(
      `/billiard/orders/${orderId}/items/${itemId}`,
      { method: 'PUT', body: JSON.stringify(body) }
    ),

  removeOrderItem: (orderId: string, itemId: string) =>
    apiFetch<{ id: string; deleted: boolean }>(
      `/billiard/orders/${orderId}/items/${itemId}`,
      { method: 'DELETE' }
    ),

  getOrderSummary: (tableId: string) =>
    apiFetch<BilliardOrderSummary>(
      `/billiard/tables/${tableId}/order-summary`,
      { auth: false, headers: getAuthHeaders() }
    ),

  updateTable: (id: string, body: {
    tableCode?: string;
    tableName?: string;
    tableType?: string;
    capacity?: number;
    status?: string;
    posX?: number;
    posY?: number;
    hourlyRate?: number;
  }) =>
    apiFetch<import('../types').TableItem>(`/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

// --- Restaurant (unified via extended billiard module) ---
export interface RestaurantTableWithOrder {
  id: string;
  accountId: string;
  tableCode: string;
  tableName: string | null;
  capacity: number;
  tableType: 'RESTAURANT' | 'BILLIARD';
  posX: number;
  posY: number;
  xPercent: number;
  yPercent: number;
  status: import('../types').TableStatus;
  isMerged: boolean;
  mergedIntoTableId: string | null;
  isActive: boolean;
  currentOrder: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    items: Array<{
      id: string;
      menuItemId: string | null;
      name: string;
      price: number;
      quantity: number;
      lineTotal: number;
    }>;
    foodTotal: number;
    serviceCharge: number;
    tax: number;
    discount: number;
    grandTotal: number;
    guestCount: number;
    note: string | null;
    startTime: string | null;
    elapsedMinutes: number;
    mergedTableIds: string[] | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export const restaurantApi = {
  listTables: () =>
    apiFetch<RestaurantTableWithOrder[]>('/restaurant/tables'),

  createTable: (body: { tableCode: string; tableName?: string; capacity?: number; posX?: number; posY?: number }) =>
    apiFetch<RestaurantTableWithOrder>('/restaurant/tables', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateLayout: (tables: { id: string; posX: number; posY: number }[]) =>
    apiFetch<RestaurantTableWithOrder[]>('/restaurant/tables/layout', {
      method: 'PUT',
      body: JSON.stringify({ tables }),
    }),

  updateTable: (id: string, body: { tableCode?: string; tableName?: string; capacity?: number; posX?: number; posY?: number }) =>
    apiFetch<RestaurantTableWithOrder>(`/restaurant/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteTable: (id: string) =>
    apiFetch<null>(`/restaurant/tables/${id}`, { method: 'DELETE' }),

  createOrder: (tableId: string, body: { guestCount?: number; note?: string }) =>
    apiFetch<RestaurantTableWithOrder>(`/restaurant/tables/${tableId}/order`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  openOrder: (tableId: string, body: { guestCount?: number; note?: string }) =>
    apiFetch<RestaurantTableWithOrder>(`/restaurant/tables/${tableId}/open-order`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getTableOrder: (tableId: string) =>
    apiFetch<RestaurantTableWithOrder['currentOrder']>(`/restaurant/tables/${tableId}/order`),

  addOrderItem: (orderId: string, body: { menuItemId: string; quantity: number; note?: string }) =>
    apiFetch<{ item: import('../types').OrderItemDetail; order: import('../types').OrderDetail }>(
      `/restaurant/orders/${orderId}/items`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  batchAddOrderItems: (orderId: string, body: { items: Array<{ menuItemId: string; quantity: number }> }) =>
    apiFetch<import('../types').OrderDetail>(
      `/restaurant/orders/${orderId}/items/batch`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  updateOrderItem: (orderId: string, itemId: string, body: { quantity: number }) =>
    apiFetch<import('../types').OrderItemDetail>(
      `/restaurant/orders/${orderId}/items/${itemId}`,
      { method: 'PUT', body: JSON.stringify(body) }
    ),

  removeOrderItem: (orderId: string, itemId: string) =>
    apiFetch<{ id: string; deleted: boolean }>(
      `/restaurant/orders/${orderId}/items/${itemId}`,
      { method: 'DELETE' }
    ),

  transferOrder: (tableId: string, body: { targetTableId: string }) =>
    apiFetch<{ orderId: string; fromTableId: string; toTableId: string }>(
      `/restaurant/tables/${tableId}/transfer`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  mergeTables: (tableId: string, body: { targetTableId: string }) =>
    apiFetch<{ mergedIntoOrderId: string; fromTableId: string; toTableId: string }>(
      `/restaurant/tables/${tableId}/merge`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  splitOrder: (tableId: string, body: { targetTableId: string; items: Array<{ itemId: string; quantity: number }> }) =>
    apiFetch<{ sourceOrderId: string; targetOrderId: string; movedTotal: number }>(
      `/restaurant/tables/${tableId}/split`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  updateGuestCount: (tableId: string, guestCount: number) =>
    apiFetch<import('../types').OrderDetail>(
      `/restaurant/tables/${tableId}/guest-count`,
      { method: 'PUT', body: JSON.stringify({ guestCount }) }
    ),

  updateOrderNote: (orderId: string, note: string) =>
    apiFetch<import('../types').OrderDetail>(
      `/restaurant/orders/${orderId}/note`,
      { method: 'PUT', body: JSON.stringify({ note }) }
    ),
};

// ======== Employee API ========
export const employeeApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    const q = buildQueryString(params);
    return apiFetch<PaginatedResponse<Employee>>(`/employees${q}`);
  },

  get: (id: string) =>
    apiFetch<Employee>(`/employees/${id}`),

  create: (body: EmployeeFormData) =>
    apiFetch<EmployeeCreateResponse>('/employees', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resetPin: (id: string) =>
    apiFetch<{ employeeId: string; generatedPin: string }>(`/employees/${id}/reset-pin`, {
      method: 'POST',
    }),

  update: (id: string, body: Partial<EmployeeFormData>) =>
    apiFetch<Employee>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    apiFetch<null>(`/employees/${id}`, { method: 'DELETE' }),

  logs: (id: string, params?: { page?: number; limit?: number; action?: string; module?: string; startDate?: string; endDate?: string }) => {
    const query = buildQueryString(params);
    return apiFetch<EmployeeLogsResponse>(`/employees/${id}/logs${query}`);
  },

  getPermissionTemplates: () =>
    apiFetch<PermissionTemplatesResponse>('/employees/templates/list'),

  getPermissions: (id: string) =>
    apiFetch<{ permissions: string[]; permissionIds: string[] }>(`/employees/${id}/permissions`),

  updatePermissions: (id: string, permissionIds: string[]) =>
    apiFetch<null>(`/employees/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds }),
    }),

  loginByPin: (employeeCode: string, pinCode: string) =>
    apiFetch<EmployeeLoginResponse>('/employees/login-by-pin', {
      method: 'POST',
      body: JSON.stringify({ employeeCode, pinCode }),
      auth: false,
    }),
};

// ==================== PAYMENT FLOW (2-phase: initiate → confirm) ====================
export const paymentApi = {
  initiate: (orderId: string, body?: { paymentMethod?: string; amount?: number }) =>
    apiFetch<{
      id: string;
      orderNumber: string;
      amount: number;
      paymentContent: string;
      bankAccounts: Array<{ bankCode: string; bankName: string; accountNumber: string; accountHolder: string }>;
    }>(`/payment/orders/${orderId}/pay`, { method: 'POST', body: JSON.stringify(body || {}) }),

  confirm: (orderId: string, body?: { paymentMethod?: string; amount?: number }) =>
    apiFetch<{ id: string; paymentStatus: string; source: string }>(
      `/payment/orders/${orderId}/confirm`,
      { method: 'POST', body: JSON.stringify(body || {}) }
    ),

  cancel: (orderId: string) =>
    apiFetch<{ id: string; status: string }>(
      `/payment/orders/${orderId}/cancel`,
      { method: 'POST' }
    ),
};
