/**
 * Centralized query key factory for TanStack Query.
 *
 * Using a factory pattern ensures consistency and enables
 * precise cache invalidation across the application.
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  categories: {
    all: ['categories', 'list'] as const,
    list: (filters?: Record<string, string | number | boolean | undefined>) =>
      ['categories', 'list', filters] as const,
    detail: (id: string) => ['categories', 'detail', id] as const,
  },
  menu: {
    all: (filters?: Record<string, string | undefined>) =>
      ['menu', 'list', filters] as const,
    detail: (id: string) => ['menu', 'detail', id] as const,
    topSelling: (limit?: number) => ['menu', 'topSelling', limit] as const,
  },
  inventory: {
    all: (filters?: Record<string, string | undefined | boolean>) =>
      ['inventory', 'list', filters] as const,
    detail: (id: string) => ['inventory', 'detail', id] as const,
    stats: ['inventory', 'stats'] as const,
    transactions: ['inventory', 'transactions'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    v2: (chartRange?: string) => ['dashboard', 'v2', chartRange] as const,
  },
  tables: {
    all: ['tables'] as const,
    pos: ['tables', 'pos'] as const,
    detail: (id: string) => ['tables', 'detail', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    daily: (date?: string, status?: string) =>
      ['orders', 'daily', date, status] as const,
    history: (params?: Record<string, string | undefined>) =>
      ['orders', 'history', params] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    byTable: (tableId: string) => ['orders', 'byTable', tableId] as const,
    kitchenQueue: ['orders', 'kitchenQueue'] as const,
  },
  ordersQueue: {
    all: (params?: Record<string, string | undefined>) =>
      ['orders', 'queue', params] as const,
    detail: (id: string) => ['orders', 'queue', id] as const,
  },
  branches: {
    all: ['branches'] as const,
  },
  posDevices: {
    all: ['posDevices'] as const,
    detail: (id: string) => ['posDevices', id] as const,
    logs: (id: string) => ['posDevices', 'logs', id] as const,
  },
  permissions: {
    all: ['permissions'] as const,
    account: (id: string) => ['permissions', 'account', id] as const,
  },
  invite: {
    verify: (token: string) => ['invite', 'verify', token] as const,
  },
  employees: {
    all: ['employees'] as const,
    list: (filters?: Record<string, string | undefined>) =>
      ['employees', 'list', filters] as const,
    detail: (id: string) => ['employees', 'detail', id] as const,
    logs: (id: string, params?: Record<string, string | undefined>) =>
      ['employees', 'logs', id, params] as const,
  },
};
