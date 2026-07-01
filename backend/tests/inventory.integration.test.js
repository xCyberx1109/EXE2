/**
 * Test tích hợp (integration) — chạy THẬT với Postgres qua DATABASE_URL trong .env.
 * Đây là bổ sung cho inventory.service.test.js (dùng mock) vì mock KHÔNG thể phát hiện
 * lỗi enum không hợp lệ ở tầng Postgres (chính là bug 'type: IN' đã sửa trước đó) —
 * chỉ Postgres thật mới validate enum InventoryTransactionType.
 *
 * CHỈ chạy trên DB dev/test, KHÔNG chạy trên DB production. Test tự tạo Account +
 * Ingredient riêng và dọn dẹp toàn bộ dữ liệu mình tạo ra trong afterEach/afterAll.
 */
import { jest } from '@jest/globals';
// Phải nạp .env TRƯỚC khi import prisma/client.js, vì file đó đọc process.env.DATABASE_URL
// ngay khi module được load (không tự gọi dotenv.config() như config/index.js vẫn làm).
import 'dotenv/config';
import prisma, { disconnectPrisma } from '../src/prisma/client.js';
import { inventoryService } from '../src/modules/inventory/inventory.service.js';

// Gọi DB thật qua network (Supabase) nên nới timeout so với mặc định 5000ms của Jest.
jest.setTimeout(20000);

let testAccountId;
let testIngredientId;

beforeAll(async () => {
  const account = await prisma.account.create({
    data: {
      email: `inventory-integration-test-${Date.now()}@example.test`,
      password: 'not-a-real-password-hash',
      fullName: 'Inventory Integration Test Account',
    },
  });
  testAccountId = account.id;
});

afterEach(async () => {
  if (testIngredientId) {
    await prisma.inventoryTransaction.deleteMany({ where: { ingredientId: testIngredientId } });
    await prisma.ingredient.delete({ where: { id: testIngredientId } }).catch(() => {});
    testIngredientId = null;
  }
});

afterAll(async () => {
  if (testAccountId) {
    await prisma.inventoryTransaction.deleteMany({ where: { accountId: testAccountId } });
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
      name: `Test Ingredient ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      unit: 'KG',
      quantity: 10,
      warningQuantity: 2,
      price: 1000,
      supplier: 'Test Supplier',
      ...overrides,
    },
  });
  testIngredientId = ingredient.id;
  return ingredient;
}

describe('[INTEGRATION - DB thật] inventoryService.stockIn', () => {
  it('luu dung enum type=IMPORT xuong Postgres (fix bug type=IN khong ton tai trong enum)', async () => {
    const ingredient = await createTestIngredient({ quantity: 10 });

    const result = await inventoryService.stockIn(
      ingredient.id,
      { quantity: 5, note: 'Test nhap kho' },
      testUser()
    );

    expect(result.ingredient.quantity).toBe(15);
    expect(result.transaction.type).toBe('IMPORT');

    const txInDb = await prisma.inventoryTransaction.findFirst({ where: { ingredientId: ingredient.id } });
    expect(txInDb).not.toBeNull();
    expect(txInDb.type).toBe('IMPORT');
    expect(Number(txInDb.beforeQuantity)).toBe(10);
    expect(Number(txInDb.afterQuantity)).toBe(15);
  });

  it('type=RETURN hop le duoc Postgres chap nhan', async () => {
    const ingredient = await createTestIngredient({ quantity: 10 });

    await inventoryService.stockIn(
      ingredient.id,
      { quantity: 2, type: 'return', note: 'Khach tra hang' },
      testUser()
    );

    const txInDb = await prisma.inventoryTransaction.findFirst({ where: { ingredientId: ingredient.id } });
    expect(txInDb.type).toBe('RETURN');
  });
});

describe('[INTEGRATION - DB thật] inventoryService.stockOut', () => {
  it('bao loi 400 khi ton kho khong du, khong ghi transaction nao xuong DB', async () => {
    const ingredient = await createTestIngredient({ quantity: 2 });

    await expect(
      inventoryService.stockOut(ingredient.id, { quantity: 10 }, testUser())
    ).rejects.toMatchObject({ statusCode: 400 });

    const count = await prisma.inventoryTransaction.count({ where: { ingredientId: ingredient.id } });
    expect(count).toBe(0);

    const unchanged = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(unchanged.quantity)).toBe(2);
  });

  it('type=WASTE co note thi luu dung type + note xuong DB', async () => {
    const ingredient = await createTestIngredient({ quantity: 10 });

    await inventoryService.stockOut(
      ingredient.id,
      { quantity: 3, type: 'waste', note: 'Hong do bao quan sai cach' },
      testUser()
    );

    const tx = await prisma.inventoryTransaction.findFirst({ where: { ingredientId: ingredient.id } });
    expect(tx.type).toBe('WASTE');
    expect(tx.note).toBe('Hong do bao quan sai cach');

    const updated = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(updated.quantity)).toBe(7);
  });

  it('type=WASTE thieu note bi chan truoc khi cham vao DB', async () => {
    const ingredient = await createTestIngredient({ quantity: 10 });

    await expect(
      inventoryService.stockOut(ingredient.id, { quantity: 2, type: 'WASTE' }, testUser())
    ).rejects.toMatchObject({ statusCode: 400 });

    const unchanged = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(unchanged.quantity)).toBe(10);
  });
});

describe('[INTEGRATION - DB thật] inventoryService.updateIngredient', () => {
  it('tao InventoryTransaction(ADJUST) that xuong DB khi doi quantity qua PUT', async () => {
    const ingredient = await createTestIngredient({ quantity: 10 });

    const result = await inventoryService.updateIngredient(
      ingredient.id,
      { quantity: 40, note: 'Kiem kho phat hien du' },
      testUser(['INVENTORY_ADJUST'])
    );

    expect(result.quantity).toBe(40);

    const tx = await prisma.inventoryTransaction.findFirst({ where: { ingredientId: ingredient.id } });
    expect(tx).not.toBeNull();
    expect(tx.type).toBe('ADJUST');
    expect(Number(tx.beforeQuantity)).toBe(10);
    expect(Number(tx.afterQuantity)).toBe(40);
    expect(tx.note).toBe('Kiem kho phat hien du');
  });

  it('khong tao transaction neu quantity khong doi, du body van gui kem quantity', async () => {
    const ingredient = await createTestIngredient({ quantity: 10 });

    await inventoryService.updateIngredient(ingredient.id, { name: 'Ten moi', quantity: 10 }, testUser());

    const count = await prisma.inventoryTransaction.count({ where: { ingredientId: ingredient.id } });
    expect(count).toBe(0);
  });

  it('chan 403 khi doi quantity nhung user khong co quyen INVENTORY_ADJUST', async () => {
    const ingredient = await createTestIngredient({ quantity: 10 });

    await expect(
      inventoryService.updateIngredient(ingredient.id, { quantity: 99 }, testUser(['INVENTORY_UPDATE']))
    ).rejects.toMatchObject({ statusCode: 403 });

    const unchanged = await prisma.ingredient.findUnique({ where: { id: ingredient.id } });
    expect(Number(unchanged.quantity)).toBe(10);

    const count = await prisma.inventoryTransaction.count({ where: { ingredientId: ingredient.id } });
    expect(count).toBe(0);
  });
});
