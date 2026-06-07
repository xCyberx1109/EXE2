import bcrypt from 'bcrypt';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import {
  PosDeviceType,
  SubscriptionStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  OrderType,
  InventoryTransactionType,
  AccountStatus,
} from '@prisma/client';
import {
  categories,
  menuItems,
  ingredients,
  menuIngredientLinks,
  features,
  permissions,
  subscriptionPlans,
} from './data.js';

const SALT_ROUNDS = 10;
const DEFAULT_ACCOUNT_ID = 'account-default-001';

/**
 * Chạy concurrent Promise.all với giới hạn số lượng parallel.
 * Tránh gửi quá nhiều query cùng lúc gây exhaustion connection pool.
 */
async function mapConcurrent(items, fn, concurrency = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/** Seed đầy đủ database */
export async function seedDatabase() {
  console.log('→ Đang seed database...');

  // =========================
  // SYNC CORE DATA (Always sync)
  // =========================
  const featureMap = await syncFeatures();
  const permissionMap = await syncPermissions();
  const planMap = await syncSubscriptionPlans();

  // =========================
  // ACCOUNT / TENANT
  // =========================
  const defaultAccount = await getOrCreateDefaultAccount();
  const accountId = defaultAccount.id;

  // =========================
  // SUBSCRIPTION
  // =========================
  const subscriptionStart = new Date();
  const subscriptionEnd = new Date(subscriptionStart);
  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 5);

  await prisma.subscription.upsert({
    where: { id: `sub-${accountId}` },
    update: {
      planId: planMap['basic'],
      status: SubscriptionStatus.ACTIVE,
      endDate: subscriptionEnd,
    },
    create: {
      id: `sub-${accountId}`,
      branchId: accountId,
      planId: planMap['basic'],
      status: SubscriptionStatus.ACTIVE,
      startDate: subscriptionStart,
      endDate: subscriptionEnd,
      autoRenew: true,
    },
  });
  console.log(`  ✓ Subscription created`);

  // =========================
  // POS DEVICE
  // =========================
  const cashierPos = await prisma.posDevice.upsert({
    where: { deviceCode: 'POS-CASHIER-01' },
    update: {
      branchId: accountId,
      name: 'POS Thu ngân',
      type: PosDeviceType.CASHIER,
      mode: 'CASHIER',
      devicePin: '111111',
      active: true,
    },
    create: {
      branchId: accountId,
      name: 'POS Thu ngân',
      deviceCode: 'POS-CASHIER-01',
      type: PosDeviceType.CASHIER,
      mode: 'CASHIER',
      devicePin: '111111',
      active: true,
    },
  });

  await prisma.posDevice.upsert({
    where: { deviceCode: 'POS-KITCHEN-01' },
    update: {
      branchId: accountId,
      name: 'POS Bếp',
      type: PosDeviceType.TABLET,
      mode: 'KITCHEN',
      devicePin: '222222',
      active: true,
    },
    create: {
      branchId: accountId,
      name: 'POS Bếp',
      deviceCode: 'POS-KITCHEN-01',
      type: PosDeviceType.TABLET,
      mode: 'KITCHEN',
      devicePin: '222222',
      active: true,
    },
  });

  await prisma.posDevice.upsert({
    where: { deviceCode: 'POS-HYBRID-01' },
    update: {
      branchId: accountId,
      name: 'POS Hybrid',
      type: PosDeviceType.TABLET,
      mode: 'HYBRID',
      devicePin: '333333',
      active: true,
    },
    create: {
      branchId: accountId,
      name: 'POS Hybrid',
      deviceCode: 'POS-HYBRID-01',
      type: PosDeviceType.TABLET,
      mode: 'HYBRID',
      devicePin: '333333',
      active: true,
    },
  });

  const posDeviceId = cashierPos.id;

  // =========================
  // ADMIN (ACCOUNT)
  // =========================
  const hashedPassword = await bcrypt.hash(config.seed.adminPassword, SALT_ROUNDS);

  const admin = await prisma.account.upsert({
    where: { email: config.seed.adminEmail },
    update: { status: AccountStatus.ACTIVE },
    create: {
      email: config.seed.adminEmail,
      password: hashedPassword,
      fullName: config.seed.adminName,
      status: AccountStatus.ACTIVE,
    },
  });

  // Grant all permissions to admin (batch với concurrency)
  const permEntries = Object.entries(permissionMap);
  await mapConcurrent(permEntries, async ([permCode, permId]) => {
    await prisma.accountPermission.upsert({
      where: { accountId_permissionId: { accountId: admin.id, permissionId: permId } },
      update: {},
      create: { accountId: admin.id, permissionId: permId },
    });
  }, 10);

  // MANAGER DEMO
  const managerPassword = await bcrypt.hash('Manager@123', SALT_ROUNDS);
  const manager = await prisma.account.upsert({
    where: { email: 'manager@store.com' },
    update: {},
    create: {
      email: 'manager@store.com',
      password: managerPassword,
      fullName: 'Quản lý chi nhánh',
      status: AccountStatus.ACTIVE,
    },
  });

  const managerPerms = [
    'ORDER_VIEW', 'ORDER_MANAGE', 'order:cancel',
    'payment:collect',
    'MENU_VIEW', 'MENU_MANAGE',
    'INVENTORY_VIEW', 'INVENTORY_MANAGE',
    'CUSTOMER_VIEW', 'CUSTOMER_MANAGE',
  ];

  await mapConcurrent(managerPerms, async (permCode) => {
    if (permissionMap[permCode]) {
      await prisma.accountPermission.upsert({
        where: { accountId_permissionId: { accountId: manager.id, permissionId: permissionMap[permCode] } },
        update: {},
        create: { accountId: manager.id, permissionId: permissionMap[permCode] },
      });
    }
  }, 10);

  console.log(`  ✓ Admin + Manager accounts with permissions`);

  // =========================
  // CATEGORIES
  // =========================
  const categoryMap = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { accountId_slug: { accountId: accountId, slug: cat.slug } },
      update: { description: cat.description },
      create: { ...cat, accountId: accountId },
    });
    categoryMap[cat.name] = created.id;
  }

  // =========================
  // MENU ITEMS
  // =========================
  const menuMap = {};
  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name, accountId: accountId },
    });

    const created = existing
      ? await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            categoryId: categoryMap[item.category],
            price: item.price,
            cost: item.cost,
            description: item.description,
            imageUrl: item.imageUrl,
            available: true,
          },
        })
      : await prisma.menuItem.create({
          data: {
            name: item.name,
            categoryId: categoryMap[item.category],
            price: item.price,
            cost: item.cost,
            description: item.description,
            imageUrl: item.imageUrl,
            available: true,
            accountId: accountId,
          },
        });

    menuMap[item.name] = created.id;
  }

  // =========================
  // INGREDIENTS
  // =========================
  const ingredientMap = {};
  for (const ing of ingredients) {
    const existing = await prisma.ingredient.findFirst({
      where: { name: ing.name, accountId: accountId },
    });

    const created = existing
      ? await prisma.ingredient.update({
          where: { id: existing.id },
          data: {
            unit: ing.unit,
            quantity: ing.quantity,
            warningQuantity: ing.minQuantity ?? 0,
            price: ing.price,
            supplier: ing.supplier,
            available: true,
            lastUpdated: new Date(),
          },
        })
      : await prisma.ingredient.create({
          data: {
            name: ing.name,
            unit: ing.unit,
            quantity: ing.quantity,
            warningQuantity: ing.minQuantity ?? 0,
            price: ing.price,
            supplier: ing.supplier,
            available: true,
            accountId: accountId,
            lastUpdated: new Date(),
          },
        });

    ingredientMap[ing.name] = created.id;
  }

  // =========================
  // MENU - INGREDIENT LINKS
  // =========================
  for (const link of menuIngredientLinks) {
    const menuItemId = menuMap[link.menuItem];
    const ingredientId = ingredientMap[link.ingredient];
    if (!menuItemId || !ingredientId) continue;

    const existing = await prisma.menuItemIngredient.findFirst({
      where: { menuItemId, ingredientId },
    });

    if (existing) {
      await prisma.menuItemIngredient.update({
        where: { id: existing.id },
        data: { amount: link.amount },
      });
    } else {
      await prisma.menuItemIngredient.create({
        data: { menuItemId, ingredientId, amount: link.amount },
      });
    }
  }

  // =========================
  // SAMPLE ORDERS
  // =========================
  await seedSampleOrders(admin.id, accountId, posDeviceId);

  // =========================
  // INVENTORY TRANSACTIONS
  // =========================
  await seedInventoryTransactions(ingredientMap, admin.id, accountId);

  // =========================
  // CUSTOMER DEMO
  // =========================
  await seedDemoCustomers(accountId);

  console.log('✓ Seed database hoàn tất');
  console.log(`  Admin: ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
}

/**
 * Đồng bộ danh sách permissions — dùng mapConcurrent để tránh pool exhaustion.
 * Không grant permissions ở đây (đã xử lý ở seedDatabase).
 */
export async function syncPermissions() {
  console.log('→ Đồng bộ permissions...');
  const permissionMap = {};

  const results = await mapConcurrent(permissions, async (perm) => {
    const created = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        name: perm.name,
        module: perm.module,
        isSystem: perm.isSystem || false,
      },
      create: perm,
    });
    return { code: perm.code, id: created.id };
  }, 10);

  for (const r of results) {
    permissionMap[r.code] = r.id;
  }
  console.log(`  ✓ ${permissions.length} permissions synchronized`);

  return permissionMap;
}

/**
 * Đồng bộ features với concurrency control.
 */
export async function syncFeatures() {
  console.log('→ Đồng bộ features...');
  const featureMap = {};

  const results = await mapConcurrent(features, async (feat) => {
    const created = await prisma.feature.upsert({
      where: { code: feat.code },
      update: {
        name: feat.name,
        module: feat.module,
        isCore: feat.isCore,
        sortOrder: feat.sortOrder,
      },
      create: feat,
    });
    return { code: feat.code, id: created.id };
  }, 10);

  for (const r of results) {
    featureMap[r.code] = r.id;
  }
  console.log(`  ✓ ${features.length} features synchronized`);
  return featureMap;
}

/**
 * Đồng bộ subscription plans với concurrency control.
 */
export async function syncSubscriptionPlans() {
  console.log('→ Đồng bộ subscription plans...');
  const planMap = {};

  const results = await mapConcurrent(subscriptionPlans, async (plan) => {
    const created = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        price: plan.price,
      },
      create: {
        code: plan.code,
        name: plan.name,
        price: plan.price,
        billingInterval: plan.billingInterval,
      },
    });
    return { code: plan.code, id: created.id };
  }, 10);

  for (const r of results) {
    planMap[r.code] = r.id;
  }
  console.log(`  ✓ ${subscriptionPlans.length} plans synchronized`);
  return planMap;
}

/** Run seed if empty — dùng cho CLI, không gọi từ server runtime */
export async function runSeedIfEmpty() {
  const userCount = await prisma.account.count();
  if (userCount === 0) {
    await seedDatabase();
  } else {
    console.log('→ Database đã có dữ liệu, bỏ qua auto-seed');
  }
}

async function getOrCreateDefaultAccount() {
  return { id: DEFAULT_ACCOUNT_ID };
}

/** SAMPLE ORDERS */
async function seedSampleOrders(createdBy, accountId, posDeviceId) {
  const existingOrders = await prisma.order.count({
    where: { status: OrderStatus.COMPLETED, accountId: accountId },
  });

  if (existingOrders > 0) return;

  const menuEntries = await prisma.menuItem.findMany({ where: { accountId: accountId } });

  for (const item of menuEntries) {
    for (let b = 0; b < 3; b++) {
      const batchQty = 10;
      const subtotal = Number(item.price) * batchQty;
      const cost = Number(item.cost) * batchQty;
      const tax = subtotal * 0.1;

      await prisma.order.create({
        data: {
          accountId: accountId,
          posDeviceId,
          orderNumber: `SEED-${item.name}-${b}-${Date.now()}`,
          tableNumber: `Bàn ${(b % 5) + 1}`,
          status: OrderStatus.COMPLETED,
          paymentMethod: PaymentMethod.CASH,
          paymentStatus: PaymentStatus.PAID,
          orderType: OrderType.DINE_IN,
          subtotal,
          tax,
          total: subtotal + tax,
          cost,
          profit: subtotal - cost,
          createdBy,
          completedAt: new Date(),
          items: {
            create: [{
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              cost: item.cost,
              quantity: batchQty,
              total: Number(item.price) * batchQty,
            }],
          },
          payments: {
            create: [{
              amount: subtotal + tax,
              method: PaymentMethod.CASH,
              status: PaymentStatus.PAID,
            }],
          },
        },
      });
    }
  }
}

/** INVENTORY */
async function seedInventoryTransactions(ingredientMap, createdBy, accountId) {
  const existing = await prisma.inventoryTransaction.count({ where: { accountId } });
  if (existing > 0) return;

  const firstIngredient = Object.values(ingredientMap)[0];
  if (!firstIngredient) return;

  console.log("[INVENTORY TRANSACTION CREATE]", JSON.stringify({
    ingredientId: firstIngredient,
    accountId,
    type: 'IMPORT',
    quantity: 50,
  }, null, 2));

  await prisma.inventoryTransaction.create({
    data: {
      ingredientId: firstIngredient,
      accountId,
      type: InventoryTransactionType.IMPORT,
      quantity: 50,
      note: 'Nhập kho ban đầu',
      createdBy,
    },
  });
}

/** DEMO CUSTOMERS */
async function seedDemoCustomers(accountId) {
  const existing = await prisma.customer.count({ where: { branchId: accountId } });
  if (existing > 0) return;

  await prisma.customer.create({
    data: {
      branchId: accountId,
      name: 'Nguyễn Văn A',
      phone: '0901234567',
      email: 'nguyenvana@example.com',
      totalSpent: 1250000,
      visitCount: 15,
      points: 2500,
      tier: 'GOLD',
    },
  });

  await prisma.customer.create({
    data: {
      branchId: accountId,
      name: 'Trần Thị B',
      phone: '0907654321',
      email: 'tranthib@example.com',
      totalSpent: 450000,
      visitCount: 8,
      points: 900,
      tier: 'SILVER',
    },
  });

  console.log('  ✓ Demo customers added');
}
