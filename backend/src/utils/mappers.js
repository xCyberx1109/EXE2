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
  ingredients: item.ingredients ? item.ingredients.map(i => ({
    id: i.id,
    ingredientId: i.ingredientId,
    amount: Number(i.amount),
    ingredient: i.ingredient ? {
      id: i.ingredient.id,
      name: i.ingredient.name,
      unit: i.ingredient.unit
    } : null
  })) : [],
});

export const mapIngredient = (item) => ({
  id: item.id,
  name: item.name,
  unit: item.unit,
  quantity: Number(item.quantity),
  warningQuantity: Number(item.warningQuantity),
  price: Number(item.price),
  supplier: item.supplier,
  available: item.available !== false,
  lastUpdated: item.lastUpdated instanceof Date
    ? item.lastUpdated.toISOString().split('T')[0]
    : String(item.lastUpdated).split('T')[0],
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

export const mapAdjustmentRequest = (req) => ({
  id: req.id,
  ingredientId: req.ingredientId,
  ingredientName: req.ingredient?.name,
  ingredientUnit: req.ingredient?.unit,
  type: req.type,
  quantity: Number(req.quantity),
  beforeQuantity: Number(req.beforeQuantity),
  afterQuantity: Number(req.afterQuantity),
  estimatedValue: Number(req.estimatedValue),
  note: req.note,
  status: req.status,
  requestedBy: req.account ? { id: req.account.id, fullName: req.account.fullName } : null,
  reviewedBy: req.reviewer ? { id: req.reviewer.id, fullName: req.reviewer.fullName } : null,
  reviewedAt: req.reviewedAt,
  rejectionReason: req.rejectionReason,
  createdAt: req.createdAt,
});

export const mapIngredientBatch = (batch) => ({
  id: batch.id,
  ingredientId: batch.ingredientId,
  ingredientName: batch.ingredient?.name,
  ingredientUnit: batch.ingredient?.unit,
  batchCode: batch.batchCode,
  quantity: Number(batch.quantity),
  initialQuantity: Number(batch.initialQuantity),
  unitCost: batch.unitCost !== null && batch.unitCost !== undefined ? Number(batch.unitCost) : null,
  expiryDate: batch.expiryDate,
  receivedDate: batch.receivedDate,
  status: batch.status,
  note: batch.note,
  createdBy: batch.creator ? { id: batch.creator.id, fullName: batch.creator.fullName } : null,
  createdAt: batch.createdAt,
});

/** Chi tiết đơn hàng cho quản lý */
export const mapOrderDetail = (order) => {
  const isRestaurant = order.orderNumber?.startsWith('ORD-');
  return {
  id: order.id,
  orderNumber: order.orderNumber,
  tableNumber: order.tableNumber,
  status: order.status,
  paymentMethod: order.paymentMethod,
  subtotal: Number(order.subtotal),
  tax: isRestaurant ? 0 : Number(order.tax),
  total: isRestaurant
    ? Number(order.subtotal) - Number(order.discount || 0) + Number(order.serviceCharge || 0)
    : Number(order.total),
  cost: Number(order.cost),
  profit: Number(order.profit),
  discount: Number(order.discount || 0),
  rounding: Number(order.rounding || 0),
  serviceCharge: Number(order.serviceCharge || 0),
  note: order.note || null,
  source: order.source || null,
  guestCount: order.guestCount || null,
  orderType: order.orderType,
  createdAt: order.createdAt,
  completedAt: order.completedAt,
  items: order.items.map((item) => ({
    id: item.id,
    menuItemId: item.menuItemId,
    inventoryId: item.inventoryId,
    name: item.name,
    price: Number(item.price),
    cost: Number(item.cost),
    quantity: item.quantity,
    discount: Number(item.discount || 0),
    lineTotal: Number(item.price) * item.quantity,
    note: item.note || null,
    modifiers: item.modifiers ? item.modifiers.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      quantity: m.quantity,
    })) : [],
  })),
  itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  customer: order.customer ? {
    id: order.customer.id,
    fullName: order.customer.fullName,
    phone: order.customer.phone,
  } : null,
  payments: order.payments ? order.payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method,
    status: p.status,
    reference: p.reference,
    createdAt: p.createdAt,
  })) : [],
  table: order.table ? {
    id: order.table.id,
    tableCode: order.table.tableCode,
    tableName: order.table.tableName,
  } : null,
  createdBy: order.account ? {
    id: order.account.id,
    fullName: order.account.fullName,
  } : null,
  };
};

/** Format order cho POS frontend (GET /orders) */
export const mapPosOrder = (order) => {
  const items = order.items || [];
  const isRestaurant = order.orderNumber?.startsWith('ORD-');

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    table: order.tableNumber,
    tableNumber: order.tableNumber,
    tableId: order.tableId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: Number(order.subtotal || 0),
    tax: isRestaurant ? 0 : Number(order.tax || 0),
    total: isRestaurant
      ? Number(order.subtotal || 0) - Number(order.discount || 0) + Number(order.serviceCharge || 0)
      : Number(order.total || 0),
    cost: Number(order.cost || order.totalCost || 0),
    profit: Number(order.profit || 0),
    discount: Number(order.discount || 0),
    createdAt: order.createdAt,
    completedAt: order.completedAt,
    cashier: order.account?.fullName || order.cashier?.fullName || '',
    cashierName: order.account?.fullName || order.cashier?.fullName || '',
    orderType: order.orderType,
    note: order.note || '',
    items: items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      inventoryId: item.inventoryId,
      name: item.name,
      price: Number(item.price),
      cost: Number(item.cost),
      quantity: item.quantity,
      lineTotal: Number(item.price) * item.quantity,
      category: item.menuItem?.category?.name || '',
      description: item.menuItem?.description || '',
      available: true,
    })),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    time: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
  };
};

export const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
