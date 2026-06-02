/** Map DB models sang format frontend mockData */

export const mapMenuItem = (item) => ({
  id: item.id,
  name: item.name,
  category: item.category?.name ?? item.categoryName ?? '',
  categoryId: item.categoryId,
  price: Number(item.price),
  cost: Number(item.cost),
  description: item.description || '',
  available: item.available,
  imageUrl: item.imageUrl || null,
});

export const mapIngredient = (item) => ({
  id: item.id,
  name: item.name,
  unit: item.unit,
  quantity: Number(item.quantity),
  warningQuantity: Number(item.warningQuantity),
  price: Number(item.price),
  supplier: item.supplier,
  lastUpdated: item.lastUpdated instanceof Date
    ? item.lastUpdated.toISOString().split('T')[0]
    : String(item.lastUpdated).split('T')[0],
});

export const mapRevenueRecord = (report) => ({
  id: report.id,
  date: report.reportDate instanceof Date
    ? report.reportDate.toISOString().split('T')[0]
    : String(report.reportDate).split('T')[0],
  orderCount: report.orderCount,
  revenue: Number(report.revenue),
  cost: Number(report.cost),
  profit: Number(report.profit),
});

export const mapInventoryTransaction = (tx) => ({
  id: tx.id,
  ingredientId: tx.ingredientId,
  ingredientName: tx.ingredient?.name,
  type: tx.type,
  quantity: Number(tx.quantity),
  note: tx.note,
  createdAt: tx.createdAt,
  user: tx.account ? { id: tx.account.id, fullName: tx.account.fullName } : null,
});

/** Chi tiết đơn hàng cho quản lý */
export const mapOrderDetail = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  tableNumber: order.tableNumber,
  status: order.status,
  paymentMethod: order.paymentMethod,
  subtotal: Number(order.subtotal),
  tax: Number(order.tax),
  total: Number(order.total),
  cost: Number(order.cost),
  profit: Number(order.profit),
  createdAt: order.createdAt,
  completedAt: order.completedAt,
  items: order.items.map((item) => ({
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.name,
    price: Number(item.price),
    cost: Number(item.cost),
    quantity: item.quantity,
    lineTotal: Number(item.price) * item.quantity,
  })),
  itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
});

/** Format order cho POS frontend (GET /orders) */
export const mapPosOrder = (order) => ({
  id: order.id,
  table: order.tableNumber,
  items: order.items.map((item) => ({
    id: item.menuItemId || item.id,
    name: item.name,
    price: Number(item.price),
    cost: Number(item.cost),
    quantity: item.quantity,
    category: item.menuItem?.category?.name || '',
    description: item.menuItem?.description || '',
    available: true,
  })),
  time: order.createdAt.toISOString(),
  status: order.status.toLowerCase(),
  total: Number(order.total),
});

export const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
