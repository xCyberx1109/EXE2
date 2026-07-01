/**
 * Test tích hợp (integration) — chạy THẬT với Postgres, cho tính năng theo dõi lô/hạn sử dụng
 * (FEFO — First Expired First Out). Đây là phần rủi ro cao nhất vì đụng vào cả luồng bán hàng
 * qua order checkout (order.service.js#deductInventoryForOrderTx), không chỉ module kho.
 *
 * CHỈ chạy trên DB dev/test. Tự tạo Account/Category/MenuItem/Ingredient riêng và dọn dẹp
 * toàn bộ trong afterEach/afterAll.
 */
import { jest } from '@jest/globals';
import 'dotenv/config';
import prisma, { disconnectPrisma } from '../src/prisma/client.js';
import { inventoryService } from '../src/modules/inventory/inventory.service.js';
import { orderService } from '../src/modules/orders/order.service.js';

jest.setTimeout(30000);

let testAccountId;
let testIngredientId;
let testCategoryId;
let testMenuItemId;
let testOrderId;

beforeAll(async () => {
  const account = await prisma.account.create({
    data: {
      email: `inventory-batch-test-${Date.now()}@example.test`,
      password: 'not-a-real-password-hash',
      fullName: 'Inventory Batch Test Account',
    },
  });
  testAccountId = account.id;
});

afterEach(async () => {
  if (testOrderId) {
    await prisma.payment.deleteMany({ where: { orderId: testOrderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
    await prisma.order.delete({ where: { id: testOrderId } }).catch(() => {});
    testOrderId = null;
  }
  if (testMenuItemId) {
    await prisma.menuItemIngredient.deleteMany({ where: { menuItemId: testMenuItemId } });
    await prisma.menuItem.delete({ where: { id: testMenuItemId } }).catch(() => {});
    testMenuItemId = null;
  }
  if (testCategoryId) {
    await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => {});
    testCategoryId = null;
  }
  if (testIngredientId) {
    await prisma.ingredientBatch.deleteMany({ where: { ingredientId: testIngredientId } });
    await prisma.inventoryAdjustmentRequest.deleteMany({ where: { ingredientId: testIngredientId } });
    await prisma.inventoryTransaction.deleteMany({ where: { ingredientId: testIngredientId } });
    await prisma.ingredient.delete({ where: { id: testIngredientId } }).catch(() => {});
    testIngredientId = null;
  }
});

afterAll(async () => {
  if (testAccountId) {
    await prisma.inventoryAdjustmentRequest.deleteMany({ where: { accountId: testAccountId } });
    await prisma.inventoryTransaction.deleteMany({ where: { accountId: testAccountId } });
    await prisma.ingredientBatch.deleteMany({ where: { accountId: testAccountId } });
    await prisma.account.delete({ where: { id: testAccountId } }).catch(() => {});
  }
  await disconnectPrisma();
});

function testUser(permissions = []) {
  return { id: testAccountId, accountId: testAccountId, permissions };
}

async function createTestIngredient(overrides = {}) {
  const ingredient = await prisma.ingredient.create({
    data: {
      accountId: testAccountId,
      name: `Batch Test Ingredient ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      unit: 'KG',
      quantity: 0,
      warningQuantity: 1,
      price: 1000,
      supplier: 'Test Supplier',
      ...overrides,
    },
  });
  testIngredientId = ingredient.id;
  return ingredient;
}

describe('[INTEGRATION - DB thật] Tao lo khi nhap kho', () => {
  it('stockIn tao IngredientBatch that voi expiryDate + batchCode', async () => {
    const ingredient = await createTestIngredient({ quantity: 0 });

    await inventoryService.stockIn(
      ingredient.id,
      { quantity: 10, note: 'Nhap lo dau', expiryDate: '2026-12-31', batchCode: 'LOT-TEST-1', unitCost: 900 },
      testUser()
    );

    const batch = await prisma.ingredientBatch.findFirst({ where: { ingredientId: ingredient.id } });
    expect(batch).not.toBeNull();
    expect(batch.batchCode).toBe('LOT-TEST-1');
    expect(Number(batch.quantity)).toBe(10);
    expect(Number(batch.initialQuantity)).toBe(10);
    expect(Number(batch.unitCost)).toBe(900);
    expect(batch.expiryDate?.toISOString().slice(0, 10)).toBe('2026-12-31');
    expect(batch.status).toBe('ACTIVE');

    const updatedIngredient = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(updatedIngredient.quantity)).toBe(10);
  });
});

describe('[INTEGRATION - DB thật] Tieu thu FEFO qua nhieu lo khi xuat kho thu cong', () => {
  it('xuat kho tru dan tu lo het han truoc, giu nguyen tong Ingredient.quantity dung', async () => {
    const ingredient = await createTestIngredient({ quantity: 0 });

    // Nhap 2 lo: lo cu het han truoc (5 don vi), lo moi het han sau (10 don vi)
    await inventoryService.stockIn(
      ingredient.id,
      { quantity: 5, note: 'Lo 1', expiryDate: '2026-07-10', batchCode: 'LOT-OLD' },
      testUser()
    );
    await inventoryService.stockIn(
      ingredient.id,
      { quantity: 10, note: 'Lo 2', expiryDate: '2026-09-01', batchCode: 'LOT-NEW' },
      testUser()
    );

    const afterImport = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(afterImport.quantity)).toBe(15);

    // Xuat 8 don vi -> phai tru het lo OLD (5) truoc, roi tru tiep 3 tu lo NEW
    await inventoryService.stockOut(ingredient.id, { quantity: 8, type: 'OUT', note: 'Xuat cho bep' }, testUser());

    const lotOld = await prisma.ingredientBatch.findFirst({ where: { ingredientId: ingredient.id, batchCode: 'LOT-OLD' } });
    const lotNew = await prisma.ingredientBatch.findFirst({ where: { ingredientId: ingredient.id, batchCode: 'LOT-NEW' } });

    expect(Number(lotOld.quantity)).toBe(0);
    expect(lotOld.status).toBe('DEPLETED');
    expect(Number(lotNew.quantity)).toBe(7); // 10 - 3
    expect(lotNew.status).toBe('ACTIVE');

    const finalIngredient = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(finalIngredient.quantity)).toBe(7); // 15 - 8, khop voi tong 2 lo (0 + 7)
  });
});

describe('[INTEGRATION - DB thật] FEFO ap dung khi ban hang qua order checkout', () => {
  it('thanh toan don hang tieu thu dung lo het han truoc, dong bo voi Ingredient.quantity', async () => {
    const ingredient = await createTestIngredient({ quantity: 0, price: 20000 });

    await inventoryService.stockIn(
      ingredient.id,
      { quantity: 3, note: 'Lo sap het han', expiryDate: '2026-07-15', batchCode: 'LOT-SOON' },
      testUser()
    );
    await inventoryService.stockIn(
      ingredient.id,
      { quantity: 10, note: 'Lo con lau moi het han', expiryDate: '2027-01-01', batchCode: 'LOT-LATER' },
      testUser()
    );

    const category = await prisma.category.create({
      data: { name: 'Test Category', slug: `test-cat-${Date.now()}` },
    });
    testCategoryId = category.id;

    const menuItem = await prisma.menuItem.create({
      data: {
        accountId: testAccountId,
        categoryId: category.id,
        name: 'Mon test FEFO',
        price: 50000,
        cost: 20000,
      },
    });
    testMenuItemId = menuItem.id;

    await prisma.menuItemIngredient.create({
      data: { menuItemId: menuItem.id, ingredientId: ingredient.id, amount: 5 },
    });

    // Ban 1 phan -> can 5 don vi nguyen lieu = het sach lo SOON (3) + 2 tu lo LATER
    // createQueueOrder tra ve { data: mapPosOrder(order), created: true }, khong phai order truc tiep.
    const created = await orderService.createQueueOrder(
      { items: [{ menuItemId: menuItem.id, quantity: 1 }] },
      testUser()
    );
    const orderId = created.data.id;
    testOrderId = orderId;

    await orderService.completeQueuePayment(orderId, 'CASH', testUser());

    const lotSoon = await prisma.ingredientBatch.findFirst({ where: { ingredientId: ingredient.id, batchCode: 'LOT-SOON' } });
    const lotLater = await prisma.ingredientBatch.findFirst({ where: { ingredientId: ingredient.id, batchCode: 'LOT-LATER' } });

    expect(Number(lotSoon.quantity)).toBe(0);
    expect(lotSoon.status).toBe('DEPLETED');
    expect(Number(lotLater.quantity)).toBe(8); // 10 - 2

    const finalIngredient = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(finalIngredient.quantity)).toBe(8); // 13 - 5, khop voi tong 2 lo (0 + 8)

    const tx = await prisma.inventoryTransaction.findFirst({
      where: { ingredientId: ingredient.id, referenceType: 'ORDER' },
    });
    expect(tx).not.toBeNull();
    expect(tx.type).toBe('OUT');
    expect(Number(tx.quantity)).toBe(5);
  });
});
