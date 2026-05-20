import bcrypt from 'bcrypt';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import {
  categories,
  menuItems,
  ingredients,
  revenueReports,
  menuIngredientLinks,
} from './data.js';

const SALT_ROUNDS = 10;

/** Seed đầy đủ database */
export async function seedDatabase() {
  console.log('→ Đang seed database...');

  // Admin
  const hashedPassword = await bcrypt.hash(config.seed.adminPassword, SALT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: config.seed.adminEmail },
    update: {},
    create: {
      email: config.seed.adminEmail,
      password: hashedPassword,
      fullName: config.seed.adminName,
      role: 'ADMIN',
    },
  });

  // Staff demo
  await prisma.user.upsert({
    where: { email: 'staff@store.com' },
    update: {},
    create: {
      email: 'staff@store.com',
      password: await bcrypt.hash('Staff@123', SALT_ROUNDS),
      fullName: 'Nhân viên bán hàng',
      role: 'STAFF',
    },
  });

  // Categories
  const categoryMap = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: cat,
    });
    categoryMap[cat.name] = created.id;
  }

  // Menu items
  const menuMap = {};
  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
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
          },
        });

    menuMap[item.name] = created.id;
  }

  // Ingredients
  const ingredientMap = {};
  for (const ing of ingredients) {
    const created = await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: {
        quantity: ing.quantity,
        minQuantity: ing.minQuantity,
        price: ing.price,
        supplier: ing.supplier,
        lastUpdated: new Date(),
      },
      create: { ...ing, lastUpdated: new Date() },
    });
    ingredientMap[ing.name] = created.id;
  }

  // Menu-Ingredient links
  for (const link of menuIngredientLinks) {
    const menuItemId = menuMap[link.menuItem];
    const ingredientId = ingredientMap[link.ingredient];
    if (!menuItemId || !ingredientId) continue;

    await prisma.menuItemIngredient.upsert({
      where: {
        menuItemId_ingredientId: { menuItemId, ingredientId },
      },
      update: { amount: link.amount },
      create: { menuItemId, ingredientId, amount: link.amount },
    });
  }

  // Sample completed orders (tạo top selling)
  await seedSampleOrders(menuMap, admin.id);

  // Revenue reports
  for (const report of revenueReports) {
    await prisma.revenueReport.upsert({
      where: { reportDate: new Date(report.date) },
      update: {
        orderCount: report.orderCount,
        revenue: report.revenue,
        cost: report.cost,
        profit: report.profit,
      },
      create: {
        reportDate: new Date(report.date),
        orderCount: report.orderCount,
        revenue: report.revenue,
        cost: report.cost,
        profit: report.profit,
      },
    });
  }

  // Inventory transactions mẫu
  await seedInventoryTransactions(ingredientMap, admin.id);

  console.log('✓ Seed database hoàn tất');
  console.log(`  Admin: ${config.seed.adminEmail} / ${config.seed.adminPassword}`);
  console.log('  Staff: staff@store.com / Staff@123');
}

/** Chạy seed nếu chưa có user */
export async function runSeedIfEmpty() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await seedDatabase();
  } else {
    console.log('→ Database đã có dữ liệu, bỏ qua auto-seed');
  }
}

async function seedSampleOrders(menuMap, userId) {
  const existingOrders = await prisma.order.count({ where: { status: 'COMPLETED' } });
  if (existingOrders > 0) return;

  const topQuantities = {
    'Phở Bò': 320,
    'Bún Chả': 280,
    'Cơm Tấm': 210,
    'Bánh Mì': 150,
    'Cà Phê Đen': 1000,
    'Cà Phê Sữa': 240,
    'Trà Chanh': 170,
    'Nem Rán': 130,
  };

  const menuEntries = await prisma.menuItem.findMany({ include: { category: true } });

  for (const item of menuEntries) {
    const qty = topQuantities[item.name] || 50;
    const batches = Math.ceil(qty / 10);

    for (let b = 0; b < Math.min(batches, 5); b++) {
      const batchQty = Math.min(10, qty - b * 10);
      const subtotal = Number(item.price) * batchQty;
      const cost = Number(item.cost) * batchQty;
      const tax = subtotal * 0.1;

      await prisma.order.create({
        data: {
          orderNumber: `SEED-${item.name}-${b}-${Date.now()}`,
          tableNumber: (b % 8) + 1,
          status: 'COMPLETED',
          paymentMethod: b % 2 === 0 ? 'CASH' : 'CARD',
          subtotal,
          tax,
          total: subtotal + tax,
          cost,
          profit: subtotal - cost,
          userId,
          completedAt: new Date(Date.now() - b * 86400000),
          items: {
            create: [{
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              cost: item.cost,
              quantity: batchQty,
            }],
          },
        },
      });
    }
  }
}

async function seedInventoryTransactions(ingredientMap, userId) {
  const existing = await prisma.inventoryTransaction.count();
  if (existing > 0) return;

  const beefId = ingredientMap['Thịt Bò'];
  if (beefId) {
    await prisma.inventoryTransaction.create({
      data: {
        ingredientId: beefId,
        type: 'IN',
        quantity: 50,
        note: 'Nhập kho ban đầu',
        userId,
      },
    });
  }
}
