import bcrypt from 'bcrypt';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import {
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
  subscriptionPlanFeatures,
} from './data.js';

const FEATURE_PERMISSIONS = [
  // POS_CASHIER
  { featureCode: 'pos_cashier', permissionCodes: ['POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER', 'POS_CANCEL_ORDER'] },
  // POS_KITCHEN
  { featureCode: 'pos_kitchen', permissionCodes: ['ORDER_VIEW', 'DASHBOARD_VIEW'] },
  // INVENTORY
  { featureCode: 'inventory', permissionCodes: ['INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE', 'INVENTORY_IMPORT', 'INVENTORY_EXPORT', 'INVENTORY_ADJUST'] },
  // MENU_MANAGEMENT
  { featureCode: 'menu_management', permissionCodes: ['MENU_VIEW', 'MENU_CREATE', 'MENU_UPDATE', 'MENU_DELETE', 'MENU_MANAGEMENT_VIEW'] },
  // CUSTOMER_LOYALTY
  { featureCode: 'customer_loyalty', permissionCodes: ['CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE'] },
  // ONLINE_ORDERING
  { featureCode: 'online_ordering', permissionCodes: ['ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_DELETE', 'ORDER_HISTORY_VIEW'] },
  // MULTI_BRANCH
  { featureCode: 'multi_branch', permissionCodes: ['BRANCH_VIEW', 'BRANCH_CREATE', 'BRANCH_UPDATE', 'BRANCH_DELETE', 'BRANCH_LOCK', 'BRANCH_UNLOCK', 'BRANCH_FORCE_DELETE'] },
  // KITCHEN_DISPLAY
  { featureCode: 'kitchen_display', permissionCodes: ['DASHBOARD_VIEW', 'ORDER_VIEW'] },
  // POS_ORDER_QUEUE
  { featureCode: 'pos_order_queue', permissionCodes: ['POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_DELETE', 'POS_ORDER_QUEUE_PAY'] },
  // VOUCHER (no dedicated permissions yet)
  { featureCode: 'voucher', permissionCodes: [] },
  // BILLIARD_TABLE
  { featureCode: 'billiard_table', permissionCodes: ['BILLIARD_TABLE_VIEW', 'BILLIARD_TABLE_CREATE', 'BILLIARD_TABLE_UPDATE', 'BILLIARD_TABLE_DELETE', 'BILLIARD_TABLE_LAYOUT_EDIT'] },
  // BILLIARD_SESSION
  { featureCode: 'billiard_session', permissionCodes: ['BILLIARD_SESSION_VIEW', 'BILLIARD_SESSION_START', 'BILLIARD_SESSION_CHECKIN', 'BILLIARD_SESSION_FINISH'] },
  // BILLIARD_RESERVATION
  { featureCode: 'billiard_reservation', permissionCodes: ['BILLIARD_RESERVATION_VIEW', 'BILLIARD_RESERVATION_CREATE', 'BILLIARD_RESERVATION_CANCEL'] },
  // BILLIARD_LAYOUT
  { featureCode: 'billiard_layout', permissionCodes: ['BILLIARD_TABLE_VIEW', 'BILLIARD_TABLE_LAYOUT_EDIT'] },
  // BILLIARD_REPORT
  { featureCode: 'billiard_report', permissionCodes: ['BILLIARD_REPORT_VIEW'] },
  // BILLIARD_ORDER
  { featureCode: 'billiard_order', permissionCodes: ['BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE', 'BILLIARD_ORDER_DELETE', 'BILLIARD_ORDER_ADD_ITEM'] },
  // BILLIARD_PAY
  { featureCode: 'billiard_pay', permissionCodes: ['BILLIARD_PAY_VIEW', 'BILLIARD_PAY_PROCESS'] },
  // STAFF_MANAGEMENT
  { featureCode: 'staff_management', permissionCodes: [
    'STAFF_VIEW', 'STAFF_CREATE', 'STAFF_UPDATE', 'STAFF_DELETE', 'STAFF_MANAGE',
    'STAFF_MANAGE_PIN', 'STAFF_RESET_PIN', 'STAFF_VIEW_PIN',
    'STAFF_VIEW_ACTIVITY', 'STAFF_VIEW_LOGIN_HISTORY', 'STAFF_VIEW_PERFORMANCE',
    'STAFF_SESSION_VIEW', 'STAFF_SESSION_FORCE_LOGOUT',
  ] },
];

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
  await syncFeaturePermissions(featureMap, permissionMap);
  const planMap = await syncSubscriptionPlans();
  await syncSubscriptionPlanFeatures(planMap, featureMap);

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
  // EMPLOYEES — PIN đăng nhập POS thuộc về Employee
  // =========================
  const emp1 = await prisma.employee.upsert({
    where: { accountId_employeeCode: { accountId, employeeCode: 'EMP-001' } },
    update: {},
    create: {
      accountId,
      employeeCode: 'EMP-001',
      fullName: 'Nhân viên thu ngân',
      phone: '0901111111',
      email: 'cashier@store.com',
      pinCode: await bcrypt.hash('111111', 10),
      status: 'ACTIVE',
    },
  });

  const emp2 = await prisma.employee.upsert({
    where: { accountId_employeeCode: { accountId, employeeCode: 'EMP-002' } },
    update: {},
    create: {
      accountId,
      employeeCode: 'EMP-002',
      fullName: 'Nhân viên bếp',
      phone: '0902222222',
      email: 'kitchen@store.com',
      pinCode: await bcrypt.hash('222222', 10),
      status: 'ACTIVE',
    },
  });

  const emp3 = await prisma.employee.upsert({
    where: { accountId_employeeCode: { accountId, employeeCode: 'EMP-003' } },
    update: {},
    create: {
      accountId,
      employeeCode: 'EMP-003',
      fullName: 'Nhân viên hybrid',
      phone: '0903333333',
      email: 'hybrid@store.com',
      pinCode: await bcrypt.hash('333333', 10),
      status: 'ACTIVE',
    },
  });

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
    'DASHBOARD_VIEW',
    'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE',
    'ORDER_HISTORY_VIEW',
    'MENU_VIEW', 'MENU_CREATE', 'MENU_UPDATE', 'MENU_MANAGEMENT_VIEW',
    'INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_IMPORT', 'INVENTORY_EXPORT', 'INVENTORY_ADJUST',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'TABLE_VIEW', 'TABLE_CREATE', 'TABLE_UPDATE',
    'CATEGORY_VIEW', 'CATEGORY_CREATE', 'CATEGORY_UPDATE',
    'REPORT_VIEW',
    'SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_CLOSE',
    'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_PAY',
    'BILLIARD_TABLE_VIEW', 'BILLIARD_SESSION_START', 'BILLIARD_RESERVATION_CREATE', 'BILLIARD_SESSION_CHECKIN',
    'BILLIARD_SESSION_VIEW', 'BILLIARD_SESSION_START', 'BILLIARD_SESSION_FINISH',
    'BILLIARD_RESERVATION_VIEW', 'BILLIARD_RESERVATION_CREATE', 'BILLIARD_RESERVATION_CANCEL',
    'BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_UPDATE', 'BILLIARD_ORDER_ADD_ITEM',
    'BILLIARD_PAY_VIEW', 'BILLIARD_PAY_PROCESS',
    'BILLIARD_REPORT_VIEW',
    'RESTAURANT_TABLE_VIEW', 'RESTAURANT_TABLE_CREATE', 'RESTAURANT_TABLE_UPDATE',
    'RESTAURANT_TABLE_LAYOUT_EDIT', 'RESTAURANT_TABLE_TRANSFER', 'RESTAURANT_TABLE_MERGE', 'RESTAURANT_TABLE_SPLIT',
    'RESTAURANT_ORDER_VIEW', 'RESTAURANT_ORDER_CREATE', 'RESTAURANT_ORDER_UPDATE', 'RESTAURANT_ORDER_ADD_ITEM',
    'RESTAURANT_PAY_VIEW', 'RESTAURANT_PAY_PROCESS',
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
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, active: cat.active ?? true },
      create: { name: cat.name, slug: cat.slug, description: cat.description, active: cat.active ?? true },
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
  await seedSampleOrders(admin.id, accountId);

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

/**
 * Đồng bộ SubscriptionPlan ↔ Feature associations.
 */
export async function syncSubscriptionPlanFeatures(planMap, featureMap) {
  console.log('→ Đồng bộ subscription plan features...');
  let count = 0;
  for (const spf of subscriptionPlanFeatures) {
    const planId = planMap[spf.planCode];
    if (!planId) {
      console.warn(`  ⚠ Plan not found: ${spf.planCode}`);
      continue;
    }
    for (const featCode of spf.featureCodes) {
      const featureId = featureMap[featCode];
      if (!featureId) {
        console.warn(`  ⚠ Feature not found: ${featCode}`);
        continue;
      }
      await prisma.subscriptionPlanFeature.upsert({
        where: { subscriptionPlanId_featureId: { subscriptionPlanId: planId, featureId } },
        update: {},
        create: { subscriptionPlanId: planId, featureId },
      });
      count++;
    }
  }
  console.log(`  ✓ ${count} plan-features synchronized`);
}

/** Run seed if empty — dùng cho CLI, không gọi từ server runtime */
/**
 * Đồng bộ Feature ↔ Permission associations.
 */
export async function syncFeaturePermissions(featureMap, permissionMap) {
  console.log('→ Đồng bộ feature-permissions...');
  let count = 0;
  for (const fp of FEATURE_PERMISSIONS) {
    const featureId = featureMap[fp.featureCode];
    if (!featureId) {
      console.warn(`  ⚠ Feature not found: ${fp.featureCode}`);
      continue;
    }
    for (const permCode of fp.permissionCodes) {
      const permissionId = permissionMap[permCode];
      if (!permissionId) {
        console.warn(`  ⚠ Permission not found: ${permCode}`);
        continue;
      }
      await prisma.featurePermission.upsert({
        where: { featureId_permissionId: { featureId, permissionId } },
        update: {},
        create: { featureId, permissionId },
      });
      count++;
    }
  }
  console.log(`  ✓ ${count} feature-permissions synchronized`);
}

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
async function seedSampleOrders(createdBy, accountId) {
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
