/**
 * Test tích hợp (integration) — chạy THẬT với Postgres, cho tính năng "giữ chỗ tồn kho"
 * (stock reservation) khi tạo/sửa/hủy/thanh toán đơn hàng. Mục tiêu: ngăn 2 đơn hàng cùng lúc
 * "thấy" còn hàng trong khi thực tế chỉ đủ cho 1 đơn — đây là race condition thực sự, nên
 * phần quan trọng nhất của file này là test bắn 2 request tạo đơn ĐỒNG THỜI để xác nhận
 * SELECT ... FOR UPDATE trong reserveInventoryForOrderTx khóa đúng, không chỉ giảm xác suất.
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
      email: `order-reservation-test-${Date.now()}@example.test`,
      password: 'not-a-real-password-hash',
      fullName: 'Order Reservation Test Account',
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
    await prisma.inventoryReservation.deleteMany({ where: { ingredientId: testIngredientId } });
    await prisma.inventoryTransaction.deleteMany({ where: { ingredientId: testIngredientId } });
    await prisma.ingredient.delete({ where: { id: testIngredientId } }).catch(() => {});
    testIngredientId = null;
  }
});

afterAll(async () => {
  if (testAccountId) {
    await prisma.account.delete({ where: { id: testAccountId } }).catch(() => {});
  }
  await disconnectPrisma();
});

function testUser() {
  return { id: testAccountId, accountId: testAccountId, permissions: [] };
}

async function createTestIngredient(quantity) {
  const ingredient = await prisma.ingredient.create({
    data: {
      accountId: testAccountId,
      name: `Reservation Test Ingredient ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

async function createTestMenuItem(ingredientId, amountPerOrder) {
  const menuItem = await prisma.menuItem.create({
    data: {
      accountId: testAccountId,
      name: `Mon test reservation ${Date.now()}`,
      price: 50000,
      cost: 20000,
    },
  });
  testMenuItemId = menuItem.id;
  await prisma.menuItemIngredient.create({
    data: { menuItemId: menuItem.id, ingredientId, amount: amountPerOrder },
  });
  return menuItem;
}

describe('[INTEGRATION - DB thật] Giu cho ton kho khi tao don hang', () => {
  it('don thu 2 bi chan neu don thu nhat da giu cho het hang kha dung', async () => {
    const ingredient = await createTestIngredient(5);
    const menuItem = await createTestMenuItem(ingredient.id, 5); // 1 suat = het sach 5 don vi

    const first = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    testOrderIds.push(first.data.id);

    const reservation = await prisma.inventoryReservation.findFirst({
      where: { ingredientId: ingredient.id, orderId: first.data.id },
    });
    expect(reservation).not.toBeNull();
    expect(Number(reservation.quantity)).toBe(5);

    await expect(
      orderService.createQueueOrder({ items: [{ menuItemId: menuItem.id, quantity: 1 }] }, testUser())
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('huy don giai phong reservation, cho phep don khac tao thanh cong sau do', async () => {
    const ingredient = await createTestIngredient(5);
    const menuItem = await createTestMenuItem(ingredient.id, 5);

    const first = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    testOrderIds.push(first.data.id);

    await orderService.cancelQueueOrder(first.data.id, testUser());

    const reservationAfterCancel = await prisma.inventoryReservation.findFirst({
      where: { orderId: first.data.id },
    });
    expect(reservationAfterCancel).toBeNull();

    const second = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    testOrderIds.push(second.data.id);
    expect(second.created).toBe(true);
  });

  it('thanh toan don giai phong reservation va tru kho that su', async () => {
    const ingredient = await createTestIngredient(5);
    const menuItem = await createTestMenuItem(ingredient.id, 5);

    const created = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    testOrderIds.push(created.data.id);

    await orderService.completeQueuePayment(created.data.id, 'CASH', testUser());

    const reservationAfterPay = await prisma.inventoryReservation.findFirst({
      where: { orderId: created.data.id },
    });
    expect(reservationAfterPay).toBeNull();

    const finalIngredient = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(finalIngredient.quantity)).toBe(0);
  });

  it('sua don doi so luong se cap nhat lai reservation', async () => {
    const ingredient = await createTestIngredient(10);
    const menuItem = await createTestMenuItem(ingredient.id, 2); // 1 suat = 2 don vi

    const created = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    testOrderIds.push(created.data.id);

    let reservation = await prisma.inventoryReservation.findFirst({ where: { orderId: created.data.id } });
    expect(Number(reservation.quantity)).toBe(2);

    await orderService.updateQueueOrder(
      created.data.id,
      { items: [{ menuItemId: menuItem.id, quantity: 3 }] },
      testUser()
    );

    reservation = await prisma.inventoryReservation.findFirst({ where: { orderId: created.data.id } });
    expect(Number(reservation.quantity)).toBe(6); // 3 suat * 2 don vi
  });

  it('CHAY DONG THOI: 2 don cung tranh 1 phan hang cuoi cung, chi dung 1 don thanh cong', async () => {
    // Chi du hang cho DUNG 1 don (amount = full quantity), 2 request tao don ban cung 1 luc.
    const ingredient = await createTestIngredient(5);
    const menuItem = await createTestMenuItem(ingredient.id, 5);

    const results = await Promise.allSettled([
      orderService.createQueueOrder({ items: [{ menuItemId: menuItem.id, quantity: 1 }] }, testUser()),
      orderService.createQueueOrder({ items: [{ menuItemId: menuItem.id, quantity: 1 }] }, testUser()),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Dung 1 trong 2 thanh cong, con lai bi tu choi vi khong du hang kha dung -
    // day la bang chung SELECT...FOR UPDATE khoa dung, khong phai 2 don cung "thay" con hang.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ statusCode: 400 });

    testOrderIds.push(fulfilled[0].value.data.id);

    const reservationCount = await prisma.inventoryReservation.count({ where: { ingredientId: ingredient.id } });
    expect(reservationCount).toBe(1);
  });
});
