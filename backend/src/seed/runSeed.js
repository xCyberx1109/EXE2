import bcrypt from 'bcrypt';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import {
  Role,
  PosDeviceType,
  Plan,
  SubscriptionStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  OrderType,
  IngredientUnit,
  InventoryTransactionType,
} from '@prisma/client';
import {
  categories,
  menuItems,
  ingredients,
  menuIngredientLinks,
} from './data.js';

const SALT_ROUNDS = 10;

/** Seed đầy đủ database */
export async function seedDatabase() {
  console.log('→ Đang seed database...');

  // =========================
  // BRANCH
  // =========================
  const defaultBranch = await getOrCreateDefaultBranch();
  const branchId = defaultBranch.id;

  // =========================
  // POS DEVICE
  // =========================
  const defaultPosDevice = await prisma.posDevice.upsert({
    where: { deviceCode: 'MAIN-POS' },
    update: {
      branchId,
      name: 'Main POS',
      type: PosDeviceType.CASHIER,
      active: true,
    },
    create: {
      branchId,
      name: 'Main POS',
      deviceCode: 'MAIN-POS',
      type: PosDeviceType.CASHIER,
      active: true,
    },
  });
  const posDeviceId = defaultPosDevice.id;

  // =========================
  // ADMIN (ACCOUNT)
  // =========================
  const hashedPassword = await bcrypt.hash(
    config.seed.adminPassword,
    SALT_ROUNDS
  );

  const admin = await prisma.account.upsert({
    where: { email: config.seed.adminEmail },
    update: { branchId },
    create: {
      email: config.seed.adminEmail,
      password: hashedPassword,
      fullName: config.seed.adminName,
      role: Role.ADMIN,
      branchId,
    },
  });

  // COOK DEMO
  await prisma.account.upsert({
    where: { email: 'cook@store.com' },
    update: { branchId },
    create: {
      email: 'cook@store.com',
      password: await bcrypt.hash('Cook@123', SALT_ROUNDS),
      fullName: 'Nhân viên bếp',
      role: Role.COOK,
      branchId,
    },
  });

  // =========================
  // CATEGORIES
  // =========================
  const categoryMap = {};

  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: {
        branchId_slug: {
          branchId,
          slug: cat.slug,
        },
      },
      update: {
        description: cat.description,
      },
      create: {
        ...cat,
        branchId,
      },
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

  const mapUnit = (unitStr) => {
    switch (unitStr) {
      case 'kg': return IngredientUnit.KG;
      case 'g': return IngredientUnit.G;
      case 'lít': case 'lit': return IngredientUnit.LITER;
      case 'ml': return IngredientUnit.ML;
      case 'chiếc': case 'cái': return IngredientUnit.PIECE;
      default: return IngredientUnit.PIECE;
    }
  };

  for (const ing of ingredients) {
    const unitEnum = mapUnit(ing.unit);
    const existing = await prisma.ingredient.findFirst({
      where: { name: ing.name, branchId },
    });

    const created = existing
      ? await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          unit: unitEnum,
          quantity: ing.quantity,
          minQuantity: ing.minQuantity,
          price: ing.price,
          supplier: ing.supplier,
          available: true,
          lastUpdated: new Date(),
        },
      })
      : await prisma.ingredient.create({
        data: {
          ...ing,
          unit: unitEnum,
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
      where: {
        menuItemId,
        ingredientId,
      },
    });

    if (existing) {
      await prisma.menuItemIngredient.update({
        where: { id: existing.id },
        data: { amount: link.amount },
      });
    } else {
      await prisma.menuItemIngredient.create({
        data: {
          menuItemId,
          ingredientId,
          amount: link.amount,
        },
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

  console.log('✓ Seed database hoàn tất');
  console.log(
    `  Admin: ${config.seed.adminEmail} / ${config.seed.adminPassword}`
  );
}

/** Run seed if empty */
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

  const subscriptionStart = new Date();
  const subscriptionEnd = new Date(subscriptionStart);
  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);

  if (existing) {
    return prisma.branch.update({
      where: { id: existing.id },
      data: {
        address: existing.address || 'Default address',
        phone: existing.phone || '0000000000',
        plan: existing.plan || Plan.BASIC,
        subscriptionStatus: existing.subscriptionStatus || SubscriptionStatus.ACTIVE,
        subscriptionStart: existing.subscriptionStart || subscriptionStart,
        subscriptionEnd: existing.subscriptionEnd || subscriptionEnd,
        active: true,
      },
    });
  }

  return prisma.branch.create({
    data: {
      name: 'Main Branch',
      address: 'Default address',
      phone: '0000000000',
      plan: Plan.BASIC,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStart,
      subscriptionEnd,
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

  const menuEntries = await prisma.menuItem.findMany({
    where: { branchId },
  });

  for (const item of menuEntries) {
    const batches = 3;

    for (let b = 0; b < batches; b++) {
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

          orderItems: {
            create: [
              {
                menuItemId: item.id,
                name: item.name,
                price: item.price,
                cost: item.cost,
                quantity: batchQty,
                total: Number(item.price) * batchQty,
              },
            ],
          },
          payments: {
            create: [
              {
                amount: subtotal + tax,
                method: PaymentMethod.CASH,
                status: PaymentStatus.PAID,
              },
            ],
          },
        },
      });
    }
  }
}

/** INVENTORY */
async function seedInventoryTransactions(ingredientMap, createdBy, branchId) {
  const existing = await prisma.inventoryTransaction.count({
    where: { branchId },
  });
  if (existing > 0) return;

  const firstIngredient = Object.values(ingredientMap)[0];

  if (!firstIngredient) return;

  await prisma.inventoryTransaction.create({
    data: {
      ingredientId: firstIngredient,
      type: InventoryTransactionType.IMPORT,
      quantity: 50,
      note: 'Nhập kho ban đầu',
      createdBy,
      branchId,
    },
  });
}