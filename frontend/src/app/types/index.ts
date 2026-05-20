export interface MenuItem {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  price: number;
  cost: number;
  description: string;
  available: boolean;
  imageUrl?: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  price: number;
  supplier: string;
  lastUpdated: string;
}

export interface RevenueRecord {
  id: string;
  date: string;
  orderCount: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface TopSellingItem {
  menuItemId: string;
  quantity: number;
  name?: string;
  category?: string;
  price?: number;
}

export interface PosOrder {
  id: string;
  table: number;
  items: Array<MenuItem & { quantity: number }>;
  time: string;
  status?: string;
  total?: number;
}

export interface OrderItemDetail {
  id: string;
  menuItemId: string | null;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  tableNumber: number | null;
  status: string;
  paymentMethod: string | null;
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  profit: number;
  createdAt: string;
  completedAt: string | null;
  items: OrderItemDetail[];
  itemCount: number;
}

export interface DailyOrdersResponse {
  date: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    completedCount: number;
    pendingCount: number;
  };
  orders: OrderDetail[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DashboardData {
  stats: {
    totalRevenue: number;
    totalProfit: number;
    totalOrders: number;
    availableMenuItems: number;
    lowStockCount: number;
  };
  topMenuItems: TopSellingItem[];
  lowStockItems: InventoryItem[];
}

export interface RevenueSummary {
  totalRevenue: number;
  totalProfit: number;
  totalCost: number;
  totalOrders: number;
  avgOrderValue: number;
  profitMargin: number;
  avgRevenuePerDay: number;
  days: number;
}

export interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
}
