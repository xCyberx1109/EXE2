import { jest } from '@jest/globals';

// Mock toàn bộ prisma client TRƯỚC khi import service, để:
// 1. Không cần DATABASE_URL thật (src/prisma/client.js sẽ process.exit(1) nếu thiếu).
// 2. Test chạy độc lập, không đụng vào dữ liệu production.
const mockPrisma = {
  ingredient: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  inventoryTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  activityLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

jest.unstable_mockModule('../src/prisma/client.js', () => ({
  default: mockPrisma,
  disconnectPrisma: jest.fn(),
}));

const { inventoryService } = await import('../src/modules/inventory/inventory.service.js');

function baseIngredient(overrides = {}) {
  return {
    id: 'ing-1',
    accountId: 'acc-1',
    name: 'Thit bo',
    unit: 'KG',
    quantity: 10,
    warningQuantity: 2,
    price: 200000,
    supplier: 'NCC A',
    available: true,
    lastUpdated: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
});

describe('inventoryService.stockIn / stockOut - loai giao dich (type)', () => {
  it('stockIn mac dinh luu type=IMPORT (khong phai "IN") - fix bug enum khong ton tai', async () => {
    const ingredient = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 15 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-1', ...data, ingredient, account: { id: 'acc-1', fullName: 'Chu quan' } })
    );

    const user = { id: 'acc-1', accountId: 'acc-1', permissions: [] };
    const result = await inventoryService.stockIn('ing-1', { quantity: 5, note: 'Nhap hang tuan' }, user);

    expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalledTimes(1);
    const createdData = mockPrisma.inventoryTransaction.create.mock.calls[0][0].data;
    expect(createdData.type).toBe('IMPORT');
    expect(createdData.beforeQuantity).toBe(10);
    expect(createdData.afterQuantity).toBe(15);
    expect(result.transaction.type).toBe('IMPORT');
    expect(result.ingredient.quantity).toBe(15);
  });

  it('stockIn cho phep chon type=RETURN hop le (khong phan biet hoa thuong)', async () => {
    const ingredient = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 12 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-2', ...data, ingredient, account: null })
    );

    await inventoryService.stockIn(
      'ing-1',
      { quantity: 2, note: 'Khach tra hang', type: 'return' },
      { id: 'acc-1', accountId: 'acc-1' }
    );

    const createdData = mockPrisma.inventoryTransaction.create.mock.calls[0][0].data;
    expect(createdData.type).toBe('RETURN');
  });

  it('stockIn voi type khong hop le se fallback ve IMPORT thay vi luu gia tri la xuong DB', async () => {
    const ingredient = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 11 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-3', ...data, ingredient, account: null })
    );

    await inventoryService.stockIn(
      'ing-1',
      { quantity: 1, type: 'HACKED_VALUE' },
      { id: 'acc-1', accountId: 'acc-1' }
    );

    const createdData = mockPrisma.inventoryTransaction.create.mock.calls[0][0].data;
    expect(createdData.type).toBe('IMPORT');
  });

  it('stockOut bao loi 400 neu ton kho khong du, khong tao transaction nao', async () => {
    const ingredient = baseIngredient({ quantity: 3 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);

    await expect(
      inventoryService.stockOut('ing-1', { quantity: 5 }, { id: 'acc-1', accountId: 'acc-1' })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.inventoryTransaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('stockOut voi type=WASTE bat buoc phai co note, thieu note thi bi chan 400', async () => {
    const ingredient = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);

    await expect(
      inventoryService.stockOut('ing-1', { quantity: 2, type: 'WASTE' }, { id: 'acc-1', accountId: 'acc-1' })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  it('stockOut voi type=WASTE co note thi thanh cong va luu dung type + note', async () => {
    const ingredient = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 8 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-4', ...data, ingredient, account: null })
    );

    const result = await inventoryService.stockOut(
      'ing-1',
      { quantity: 2, type: 'waste', note: 'Het han su dung' },
      { id: 'acc-1', accountId: 'acc-1' }
    );

    const createdData = mockPrisma.inventoryTransaction.create.mock.calls[0][0].data;
    expect(createdData.type).toBe('WASTE');
    expect(createdData.note).toBe('Het han su dung');
    expect(result.transaction.type).toBe('WASTE');
  });

  it('stockOut mac dinh (khong truyen type) van luu type=OUT nhu truoc gio', async () => {
    const ingredient = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 7 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-5', ...data, ingredient, account: null })
    );

    await inventoryService.stockOut('ing-1', { quantity: 3 }, { id: 'acc-1', accountId: 'acc-1' });

    const createdData = mockPrisma.inventoryTransaction.create.mock.calls[0][0].data;
    expect(createdData.type).toBe('OUT');
  });
});

describe('inventoryService.updateIngredient - audit trail khi sua quantity truc tiep qua PUT', () => {
  it('khong tao InventoryTransaction neu quantity gui len trung voi gia tri hien tai', async () => {
    const existing = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(existing);
    mockPrisma.ingredient.update.mockResolvedValue({ ...existing, name: 'Thit bo Uc' });

    const user = { id: 'acc-1', accountId: 'acc-1', permissions: [] };
    await inventoryService.updateIngredient('ing-1', { name: 'Thit bo Uc', quantity: 10 }, user);

    expect(mockPrisma.inventoryTransaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction.mock.calls[0][0]).toHaveLength(1);
  });

  it('chan 403 neu doi quantity qua PUT nhung user khong co quyen INVENTORY_ADJUST', async () => {
    const existing = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(existing);

    const user = { id: 'acc-1', accountId: 'acc-1', permissions: ['INVENTORY_UPDATE'] };

    await expect(
      inventoryService.updateIngredient('ing-1', { quantity: 20 }, user)
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockPrisma.ingredient.update).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  it('tao InventoryTransaction(type=ADJUST) khi user co quyen INVENTORY_ADJUST va doi quantity', async () => {
    const existing = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(existing);
    mockPrisma.ingredient.update.mockResolvedValue({ ...existing, quantity: 25 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-6', ...data })
    );

    const user = { id: 'acc-1', accountId: 'acc-1', permissions: ['INVENTORY_UPDATE', 'INVENTORY_ADJUST'] };
    const result = await inventoryService.updateIngredient(
      'ing-1',
      { quantity: 25, note: 'Kiem kho phat hien du' },
      user
    );

    expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalledTimes(1);
    const createdData = mockPrisma.inventoryTransaction.create.mock.calls[0][0].data;
    expect(createdData.type).toBe('ADJUST');
    expect(createdData.beforeQuantity).toBe(10);
    expect(createdData.afterQuantity).toBe(25);
    expect(createdData.quantity).toBe(15);
    expect(createdData.note).toBe('Kiem kho phat hien du');
    expect(result.quantity).toBe(25);
  });

  it('khong gui field "note" xuong prisma.ingredient.update (Ingredient khong co cot note)', async () => {
    const existing = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(existing);
    mockPrisma.ingredient.update.mockResolvedValue({ ...existing, quantity: 12 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-7', ...data })
    );

    const user = { id: 'acc-1', accountId: 'acc-1', permissions: ['INVENTORY_ADJUST'] };
    await inventoryService.updateIngredient('ing-1', { quantity: 12, note: 'Dieu chinh' }, user);

    const updateArgs = mockPrisma.ingredient.update.mock.calls[0][0];
    expect(updateArgs.data.note).toBeUndefined();
  });

  it('chan truy cap cheo tai khoan (giu nguyen hanh vi cu)', async () => {
    const existing = baseIngredient({ quantity: 10, accountId: 'acc-other' });
    mockPrisma.ingredient.findUnique.mockResolvedValue(existing);

    const user = { id: 'acc-1', accountId: 'acc-1', permissions: ['INVENTORY_ADJUST'] };
    await expect(
      inventoryService.updateIngredient('ing-1', { quantity: 999 }, user)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
