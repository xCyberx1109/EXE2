/**
 * Test tích hợp (integration) — chạy THẬT với Postgres, cho tính năng "công thức versioning"
 * (recipeSnapshot trên OrderItem). Mục tiêu: nếu công thức món ăn bị sửa SAU KHI đơn hàng đã
 * được tạo, việc trừ kho lúc thanh toán phải dùng đúng công thức tại thời điểm tạo đơn,
 * không dùng công thức mới nhất.
 *
 * CHỈ chạy trên DB dev/test. Tự tạo Account/Category/MenuItem/Ingredient riêng và dọn dẹp
 * toàn bộ trong afterEach/afterAll.
 */
import { jest } from '@jest/globals';
import 'dotenv/config';
import prisma, { disconnectPrisma } from '../src/prisma/client.js';
import { orderService } from '../src/modules/orders/order.service.js';

jest.setTimeout(30000);

let testAccountId;
let testMenuItemId;
let testIngredientId;
let testOrderIds = [];

beforeAll(async () => {
  const account = await prisma.account.create({
    data: {
      email: `order-recipe-snapshot-test-${Date.now()}@example.test`,
      password: 'not-a-real-password-hash',
      fullName: 'Order Recipe Snapshot Test Account',
    },
  });
  testAccountId = account.id;

});

afterEach(async () => {
  for (const orderId of testOrderIds) {
    await prisma.inventoryReservation.deleteMany({ where: { orderId } });
    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
  }
  testOrderIds = [];

  if (testMenuItemId) {
    await prisma.menuItemIngredient.deleteMany({ where: { menuItemId: testMenuItemId } });
    await prisma.menuItem.delete({ where: { id: testMenuItemId } }).catch(() => {});
    testMenuItemId = null;
  }
  if (testIngredientId) {
    await prisma.inventoryTransaction.deleteMany({ where: { ingredientId: testIngredientId } });
    await prisma.ingredient.delete({ where: { id: testIngredientId } }).catch(() => {});
    testIngredientId = null;
  }
});

afterAll(async () => {
  if (testAccountId) await prisma.account.delete({ where: { id: testAccountId } }).catch(() => {});
  await disconnectPrisma();
});

function testUser() {
  return { id: testAccountId, accountId: testAccountId, permissions: [] };
}

async function createTestIngredient(quantity) {
  const ingredient = await prisma.ingredient.create({
    data: {
      accountId: testAccountId,
      name: `Recipe Snapshot Test Ingredient ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      unit: 'KG',
      quantity,
      warningQuantity: 0,
      price: 10000,
      supplier: 'Test Supplier',
    },
  });
  testIngredientId = ingredient.id;
  return ingredient;
}

async function createTestMenuItem(ingredientId, initialAmount) {
  const menuItem = await prisma.menuItem.create({
    data: {
      accountId: testAccountId,
      name: `Mon test recipe snapshot ${Date.now()}`,
      price: 50000,
      cost: 20000,
    },
  });
  testMenuItemId = menuItem.id;
  await prisma.menuItemIngredient.create({
    data: { menuItemId: menuItem.id, ingredientId, amount: initialAmount },
  });
  return menuItem;
}

describe('[INTEGRATION - DB thật] Cong thuc versioning (recipeSnapshot)', () => {
  it('tao don chup dung cong thuc hien tai vao recipeSnapshot', async () => {
    const ingredient = await createTestIngredient(100);
    const menuItem = await createTestMenuItem(ingredient.id, 3);

    const created = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    testOrderIds.push(created.data.id);

    const orderItem = await prisma.orderItem.findFirst({ where: { orderId: created.data.id } });
    expect(orderItem.recipeSnapshot).not.toBeNull();
    expect(orderItem.recipeSnapshot).toHaveLength(1);
    expect(orderItem.recipeSnapshot[0].ingredientId).toBe(ingredient.id);
    expect(orderItem.recipeSnapshot[0].amount).toBe(3);
  });

  it('doi cong thuc SAU KHI tao don, thanh toan van tru theo cong thuc cu (snapshot), khong theo cong thuc moi', async () => {
    const ingredient = await createTestIngredient(100);
    const menuItem = await createTestMenuItem(ingredient.id, 3); // cong thuc ban dau: 3 don vi/suat

    const created = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 2 }] }, // 2 suat -> can 6 don vi theo cong thuc cu
      testUser()
    );
    testOrderIds.push(created.data.id);

    // Sua cong thuc SAU KHI don da tao: tang len 10 don vi/suat
    await prisma.menuItemIngredient.updateMany({
      where: { menuItemId: menuItem.id, ingredientId: ingredient.id },
      data: { amount: 10 },
    });

    await orderService.completeQueuePayment(created.data.id, 'CASH', testUser());

    const finalIngredient = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    // Neu dung snapshot cu (3/suat): 100 - 2*3 = 94. Neu dung cong thuc moi (10/suat) se la 100-20=80 (SAI).
    expect(Number(finalIngredient.quantity)).toBe(94);

    const tx = await prisma.inventoryTransaction.findFirst({
      where: { ingredientId: ingredient.id, referenceType: 'ORDER', referenceId: created.data.id },
    });
    expect(Number(tx.quantity)).toBe(6);
  });

  it('don khong co snapshot (gia lap don cu) fallback ve cong thuc hien tai', async () => {
    const ingredient = await createTestIngredient(100);
    const menuItem = await createTestMenuItem(ingredient.id, 4);

    const created = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    testOrderIds.push(created.data.id);

    // Gia lap don "cu" tao truoc khi co tinh nang nay: xoa snapshot di.
    await prisma.orderItem.updateMany({
      where: { orderId: created.data.id },
      data: { recipeSnapshot: null },
    });

    await orderService.completeQueuePayment(created.data.id, 'CASH', testUser());

    const finalIngredient = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    // Khong co snapshot -> dung cong thuc hien tai (4/suat) -> 100 - 4 = 96.
    expect(Number(finalIngredient.quantity)).toBe(96);
  });
});
