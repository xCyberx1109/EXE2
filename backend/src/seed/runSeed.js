import bcrypt from 'bcrypt';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import {
  AccountRole,
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

/** Seed đầy đủ database */
export async function seedDatabase() {
  console.log('→ Đang seed database...');

  // =========================
  // FEATURES
  // =========================
  const featureMap = {};
  for (const feat of features) {
    const created = await prisma.feature.upsert({
      where: { code: feat.code },
      update: { name: feat.name, module: feat.module, isCore: feat.isCore, sortOrder: feat.sortOrder },
      create: feat,
    });
    featureMap[feat.code] = created.id;
  }
  console.log(`  ✓ ${features.length} features`);

  // =========================
  // PERMISSIONS
  // =========================
  const permissionMap = {};
  for (const perm of permissions) {
    const created = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module, isSystem: perm.isSystem || false },
      create: perm,
    });
    permissionMap[perm.code] = created.id;
  }
  console.log(`  ✓ ${permissions.length} permissions`);

  // =========================
  // SUBSCRIPTION PLANS
  // =========================
  const planMap = {};
  for (const plan of subscriptionPlans) {
    const created = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, price: plan.price, maxBranches: plan.maxBranches, maxUsers: plan.maxUsers },
      create: plan,
    });
    planMap[plan.code] = created.id;
  }
  console.log(`  ✓ ${subscriptionPlans.length} subscription plans`);

  // =========================
  // BRANCH
  // =========================
  const defaultBranch = await getOrCreateDefaultBranch();
  const branchId = defaultBranch.id;

  // =========================
  // SUBSCRIPTION
  // =========================
  const subscriptionStart = new Date();
  const subscriptionEnd = new Date(subscriptionStart);
  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 5);

  await prisma.subscription.upsert({
    where: { id: `sub-${branchId}` },
    update: {
      planId: planMap['basic'],
      status: SubscriptionStatus.ACTIVE,
      endDate: subscriptionEnd,
    },
    create: {
      id: `sub-${branchId}`,
      branchId,
      planId: planMap['basic'],
      status: SubscriptionStatus.ACTIVE,
      startDate: subscriptionStart,
      endDate: subscriptionEnd,
      autoRenew: true,
    },
  });
  console.log(`  ✓ Subscription created`);

  // =========================
  // BRANCH FEATURES (enable all core features)
  // =========================
  for (const feat of features.filter(f => f.isCore)) {
    await prisma.branchFeature.upsert({
      where: { branchId_featureId: { branchId, featureId: featureMap[feat.code] } },
      update: { enabled: true },
      create: { branchId, featureId: featureMap[feat.code], enabled: true },
    });
  }

  // =========================
  // POS DEVICE
  // =========================
  const cashierPos = await prisma.posDevice.upsert({
    where: { deviceCode: 'POS-CASHIER-01' },
    update: {
      branchId,
      name: 'POS Thu ngân',
      type: PosDeviceType.CASHIER,
      mode: 'CASHIER',
      devicePin: '111111',
      active: true,
    },
    create: {
      branchId,
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
      branchId,
      name: 'POS Bếp',
      type: PosDeviceType.TABLET,
      mode: 'KITCHEN',
      devicePin: '222222',
      active: true,
    },
    create: {
      branchId,
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
      branchId,
      name: 'POS Hybrid',
      type: PosDeviceType.TABLET,
      mode: 'HYBRID',
      devicePin: '333333',
      active: true,
    },
    create: {
      branchId,
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
    update: { branchId, status: AccountStatus.ACTIVE },
    create: {
      email: config.seed.adminEmail,
      password: hashedPassword,
      fullName: config.seed.adminName,
      role: AccountRole.ADMIN,
      branchId,
      status: AccountStatus.ACTIVE,
    },
  });

  // Grant all permissions to admin
  for (const permCode of Object.keys(permissionMap)) {
    await prisma.accountPermission.upsert({
      where: { accountId_permissionId: { accountId: admin.id, permissionId: permissionMap[permCode] } },
      update: { allowed: true },
      create: { accountId: admin.id, permissionId: permissionMap[permCode], allowed: true },
    });
  }

  // MANAGER DEMO
  const managerPassword = await bcrypt.hash('Manager@123', SALT_ROUNDS);
  const manager = await prisma.account.upsert({
    where: { email: 'manager@store.com' },
    update: { branchId },
    create: {
      email: 'manager@store.com',
      password: managerPassword,
      fullName: 'Quản lý chi nhánh',
      role: AccountRole.MANAGER,
      branchId,
      status: AccountStatus.ACTIVE,
    },
  });

  // Grant key permissions to manager
  const managerPerms = [
    'POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER', 'POS_CANCEL_ORDER', 'POS_APPLY_DISCOUNT',
    'POS_DEVICE_VIEW', 'POS_DEVICE_CREATE', 'POS_DEVICE_UPDATE',
    'MENU_CREATE', 'MENU_UPDATE', 'MENU_DELETE', 'MENU_MANAGE',
    'STAFF_VIEW', 'STAFF_CREATE', 'STAFF_UPDATE', 'STAFF_DELETE',
    'REPORT_VIEW', 'REPORT_EXPORT',
    'INVENTORY_VIEW', 'INVENTORY_IMPORT', 'INVENTORY_EXPORT', 'INVENTORY_ADJUST', 'INGREDIENT_VIEW', 'INVENTORY_MANAGE',
    'BRANCH_VIEW',
    'TABLE_VIEW', 'TABLE_CREATE', 'TABLE_UPDATE', 'TABLE_DELETE'
  ];
  for (const permCode of managerPerms) {
    if (permissionMap[permCode]) {
      await prisma.accountPermission.upsert({
        where: { accountId_permissionId: { accountId: manager.id, permissionId: permissionMap[permCode] } },
        update: { allowed: true },
        create: { accountId: manager.id, permissionId: permissionMap[permCode], allowed: true },
      });
    }
  }

  console.log(`  ✓ Admin + Manager accounts with permissions`);

  // =========================
  // CATEGORIES
  // =========================
  const categoryMap = {};

  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { branchId_slug: { branchId, slug: cat.slug } },
      update: { description: cat.description },
      create: { ...cat, branchId },
    });
    categoryMap[cat.name] = created.id;
  }

  // =========================
  // MENU ITEMS
  // =========================
  const menuMap = {};

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name, branchId },
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
            branchId,
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
      where: { name: ing.name, branchId },
    });

    const created = existing
      ? await prisma.ingredient.update({
          where: { id: existing.id },
          data: {
            unit: ing.unit,
            quantity: ing.quantity,
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
            price: ing.price,
            supplier: ing.supplier,
            available: true,
            branchId,
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
  await seedSampleOrders(admin.id, branchId, posDeviceId);

  // =========================
  // INVENTORY TRANSACTIONS
  // =========================
  await seedInventoryTransactions(ingredientMap, admin.id, branchId);

  // =========================
  // CUSTOMER DEMO
  // =========================
  await seedDemoCustomers(branchId);

  console.log('✓ Seed database hoàn tất');
  console.log(`  Admin: ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
}

/**
 * Luôn đồng bộ permissions + migrate old codes lên startup
 * Đảm bảo permissions trong data.js luôn tồn tại trong DB
 */
export async function syncPermissions() {
  console.log('→ Đồng bộ permissions...');

  const permissionMap = {};
  for (const perm of permissions) {
    const created = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module, isSystem: perm.isSystem || false },
      create: perm,
    });
    permissionMap[perm.code] = created.id;
  }

  // Migrate: BRANCH_MANAGE (cũ) → BRANCH_VIEW (mới)
  const oldManagePerm = await prisma.permission.findUnique({ where: { code: 'BRANCH_MANAGE' } });
  const newViewPerm = permissionMap['BRANCH_VIEW'];
  if (oldManagePerm && newViewPerm) {
    const oldRecords = await prisma.accountPermission.findMany({
      where: { permissionId: oldManagePerm.id, allowed: true },
      select: { accountId: true },
    });
    for (const record of oldRecords) {
      await prisma.accountPermission.upsert({
        where: { accountId_permissionId: { accountId: record.accountId, permissionId: newViewPerm } },
        update: { allowed: true },
        create: { accountId: record.accountId, permissionId: newViewPerm, allowed: true },
      });
    }
    if (oldRecords.length > 0) {
      console.log(`  → Migrated BRANCH_MANAGE → BRANCH_VIEW for ${oldRecords.length} accounts`);
    }
    // Xoá permission cũ (không ai dùng nữa)
    await prisma.accountPermission.deleteMany({ where: { permissionId: oldManagePerm.id } });
    await prisma.permission.delete({ where: { id: oldManagePerm.id } });
    console.log('  → Removed legacy BRANCH_MANAGE permission');
  }

  // Xoá các permission cũ khác nếu có (SYSTEM_SUPER_ADMIN…)
  for (const legacyCode of ['SYSTEM_SUPER_ADMIN', 'SYSTEM_ALL']) {
    const legacy = await prisma.permission.findUnique({ where: { code: legacyCode } });
    if (legacy) {
      await prisma.accountPermission.deleteMany({ where: { permissionId: legacy.id } });
      await prisma.permission.delete({ where: { id: legacy.id } });
      console.log(`  → Removed legacy ${legacyCode} permission`);
    }
  }

  // Auto-assign BRANCH_VIEW + BRANCH_UPDATE cho MANAGER accounts chưa có
  const managers = await prisma.account.findMany({
    where: { role: 'MANAGER' },
    select: { id: true },
  });
  for (const m of managers) {
    for (const code of ['BRANCH_VIEW', 'BRANCH_UPDATE']) {
      const permId = permissionMap[code];
      if (!permId) continue;
      await prisma.accountPermission.upsert({
        where: { accountId_permissionId: { accountId: m.id, permissionId: permId } },
        update: { allowed: true },
        create: { accountId: m.id, permissionId: permId, allowed: true },
      });
    }
  }
  if (managers.length > 0) {
    console.log(`  → Assigned BRANCH_VIEW + BRANCH_UPDATE to ${managers.length} MANAGER accounts`);
  }

  // Auto-assign TABLE permissions cho ADMIN accounts
  const tablePermCodes = ['TABLE_VIEW', 'TABLE_CREATE', 'TABLE_UPDATE', 'TABLE_DELETE'];
  const admins = await prisma.account.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  let assignedCount = 0;
  for (const a of admins) {
    for (const code of tablePermCodes) {
      const permId = permissionMap[code];
      if (!permId) continue;
      const existing = await prisma.accountPermission.findUnique({
        where: { accountId_permissionId: { accountId: a.id, permissionId: permId } },
      });
      if (!existing) {
        await prisma.accountPermission.create({
          data: { accountId: a.id, permissionId: permId, allowed: true },
        });
        assignedCount++;
      }
    }
  }
  if (assignedCount > 0) {
    console.log(`  → Assigned TABLE permissions to ${admins.length} ADMIN accounts (${assignedCount} records)`);
  }

  console.log(`  ✓ ${permissions.length} permissions synced`);
}

/** Run seed if empty (vẫn giữ nguyên cho data mẫu) */
export async function runSeedIfEmpty() {
  const userCount = await prisma.account.count();
  if (userCount === 0) {
    await seedDatabase();
  } else {
    console.log('→ Database đã có dữ liệu, bỏ qua auto-seed');
  }
}

/** BRANCH */
async function getOrCreateDefaultBranch() {
  const existing = await prisma.branch.findFirst({
    where: { name: 'Main Branch' },
  });

  if (existing) {
    return prisma.branch.update({
      where: { id: existing.id },
      data: {
        address: existing.address || 'Default address',
        phone: existing.phone || '0000000000',
        active: true,
      },
    });
  }

  return prisma.branch.create({
    data: {
      name: 'Main Branch',
      address: 'Default address',
      phone: '0000000000',
      active: true,
    },
  });
}

/** SAMPLE ORDERS */
async function seedSampleOrders(createdBy, branchId, posDeviceId) {
  const existingOrders = await prisma.order.count({
    where: { status: OrderStatus.COMPLETED, branchId },
  });

  if (existingOrders > 0) return;

  const menuEntries = await prisma.menuItem.findMany({ where: { branchId } });

  for (const item of menuEntries) {
    for (let b = 0; b < 3; b++) {
      const batchQty = 10;
      const subtotal = Number(item.price) * batchQty;
      const cost = Number(item.cost) * batchQty;
      const tax = subtotal * 0.1;

      await prisma.order.create({
        data: {
          branchId,
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
async function seedInventoryTransactions(ingredientMap, createdBy, branchId) {
  const existing = await prisma.inventoryTransaction.count({ where: { branchId } });
  if (existing > 0) return;

  const firstIngredient = Object.values(ingredientMap)[0];
  if (!firstIngredient) return;

  await prisma.inventoryTransaction.create({
    data: {
      ingredientId: firstIngredient,
      branchId,
      type: InventoryTransactionType.IMPORT,
      quantity: 50,
      note: 'Nhập kho ban đầu',
      createdBy,
    },
  });
}

/** DEMO CUSTOMERS */
async function seedDemoCustomers(branchId) {
  const existing = await prisma.customer.count({ where: { branchId } });
  if (existing > 0) return;

  await prisma.customer.create({
    data: {
      branchId,
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
      branchId,
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
