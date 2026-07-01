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
  inventoryAdjustmentRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  ingredientBatch: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  activityLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  // $transaction ho tro ca 2 dang Prisma: mang cac promise ($transaction([...]))
  // va callback interactive ($transaction(async (tx) => {...})). tx duoc truyen chinh la
  // mockPrisma nen moi assertion tren mockPrisma.xxx.mock.calls van hoat dong dung.
  $transaction: jest.fn((arg) => {
    if (typeof arg === 'function') return arg(mockPrisma);
    return Promise.all(arg);
  }),
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
  mockPrisma.$transaction.mockImplementation((arg) => {
    if (typeof arg === 'function') return arg(mockPrisma);
    return Promise.all(arg);
  });
  // Mac dinh: khong co batch nao san co, khong anh huong cac test khong lien quan toi batch.
  mockPrisma.ingredientBatch.findMany.mockResolvedValue([]);
  mockPrisma.ingredientBatch.create.mockImplementation(({ data }) => Promise.resolve({ id: 'batch-mock', ...data }));
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
    expect(mockPrisma.ingredientBatch.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
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

  it('chan 400 neu doi quantity qua PUT nhung khong nhap note (du co quyen INVENTORY_ADJUST)', async () => {
    const existing = baseIngredient({ quantity: 10 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(existing);

    const user = { id: 'acc-1', accountId: 'acc-1', permissions: ['INVENTORY_ADJUST'] };

    await expect(
      inventoryService.updateIngredient('ing-1', { quantity: 20 }, user)
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.ingredient.update).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  it('tao InventoryTransaction(type=ADJUST) khi user co quyen INVENTORY_ADJUST va doi quantity', async () => {
    // price thap de gia tri uoc tinh khong vuot nguong phe duyet mac dinh (500,000)
    const existing = baseIngredient({ quantity: 10, price: 1000 });
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

describe('Nguong phe duyet dieu chinh/hao hut lon (mac dinh 500,000)', () => {
  const user = { id: 'acc-1', accountId: 'acc-1', permissions: ['INVENTORY_EXPORT', 'INVENTORY_ADJUST'] };

  it('stockOut type=WASTE vuot nguong -> tao InventoryAdjustmentRequest, KHONG tru kho ngay', async () => {
    // 10 don vi * 200,000/don vi = 2,000,000 > nguong mac dinh 500,000
    const ingredient = baseIngredient({ quantity: 20, price: 200000 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.account.findUnique.mockResolvedValue(undefined); // dung nguong mac dinh
    mockPrisma.inventoryAdjustmentRequest.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'req-1', ...data, status: 'PENDING', ingredient, account: { id: 'acc-1', fullName: 'Chu quan' }, reviewer: null })
    );

    const result = await inventoryService.stockOut(
      'ing-1',
      { quantity: 10, type: 'WASTE', note: 'Hong nguyen lo lon' },
      user
    );

    expect(result.pending).toBe(true);
    expect(result.request.status).toBe('PENDING');
    expect(result.request.estimatedValue).toBe(2000000);
    expect(mockPrisma.ingredient.update).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryTransaction.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('stockOut type=WASTE duoi nguong van xu ly ngay nhu binh thuong', async () => {
    const ingredient = baseIngredient({ quantity: 20, price: 1000 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.account.findUnique.mockResolvedValue(undefined); // dung nguong mac dinh 500,000
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 18 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-x', ...data, ingredient, account: null })
    );

    const result = await inventoryService.stockOut(
      'ing-1',
      { quantity: 2, type: 'WASTE', note: 'Hong nho' },
      user
    );

    expect(result.pending).toBeUndefined();
    expect(mockPrisma.inventoryAdjustmentRequest.create).not.toHaveBeenCalled();
    expect(result.ingredient.quantity).toBe(18);
  });

  it('nguong duoc cau hinh rieng theo account (thap hon mac dinh) van duoc ap dung', async () => {
    const ingredient = baseIngredient({ quantity: 20, price: 1000 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.account.findUnique.mockResolvedValue({ inventoryApprovalThreshold: 1000 });
    mockPrisma.inventoryAdjustmentRequest.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'req-2', ...data, status: 'PENDING', ingredient, account: null, reviewer: null })
    );

    // 2 don vi * 1000 = 2000 >= nguong rieng 1000 -> phai cho duyet
    const result = await inventoryService.stockOut(
      'ing-1',
      { quantity: 2, type: 'WASTE', note: 'Hong' },
      user
    );

    expect(result.pending).toBe(true);
  });

  it('updateIngredient doi quantity vuot nguong -> tao pending request, KHONG doi quantity nhung van luu cac field khac', async () => {
    const existing = baseIngredient({ quantity: 10, price: 200000, name: 'Ten cu' });
    mockPrisma.ingredient.findUnique.mockResolvedValue(existing);
    mockPrisma.account.findUnique.mockResolvedValue(undefined);
    mockPrisma.inventoryAdjustmentRequest.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'req-3', ...data, status: 'PENDING', ingredient: existing, account: null, reviewer: null })
    );
    mockPrisma.ingredient.update.mockResolvedValue({ ...existing, name: 'Ten moi', quantity: 10 });

    const result = await inventoryService.updateIngredient(
      'ing-1',
      { name: 'Ten moi', quantity: 30, note: 'Kiem kho phat hien du lon' },
      { id: 'acc-1', accountId: 'acc-1', permissions: ['INVENTORY_ADJUST'] }
    );

    expect(result.pending).toBe(true);
    expect(mockPrisma.inventoryTransaction.create).not.toHaveBeenCalled();
    const updateArgs = mockPrisma.ingredient.update.mock.calls[0][0];
    expect(updateArgs.data.quantity).toBeUndefined();
    expect(updateArgs.data.name).toBe('Ten moi');
    expect(result.ingredient.name).toBe('Ten moi');
  });
});

describe('inventoryService.approveAdjustmentRequest', () => {
  it('duyet thanh cong -> tru kho that va tao InventoryTransaction', async () => {
    const pendingRequest = {
      id: 'req-1',
      accountId: 'acc-1',
      ingredientId: 'ing-1',
      type: 'WASTE',
      quantity: 10,
      beforeQuantity: 20,
      afterQuantity: 10,
      note: 'Hong nguyen lo lon',
      status: 'PENDING',
      requestedBy: 'acc-2',
    };
    mockPrisma.inventoryAdjustmentRequest.findUnique.mockResolvedValue(pendingRequest);
    const ingredientNow = baseIngredient({ quantity: 20 }); // chua bi thay doi ke tu luc gui yeu cau
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredientNow);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredientNow, quantity: 10 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-approved', ...data, ingredient: ingredientNow, account: null })
    );
    mockPrisma.inventoryAdjustmentRequest.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...pendingRequest, ...data, ingredient: ingredientNow, account: null, reviewer: null })
    );

    const manager = { id: 'manager-1', accountId: 'acc-1', permissions: ['INVENTORY_APPROVE'] };
    const result = await inventoryService.approveAdjustmentRequest('req-1', manager);

    expect(result.ingredient.quantity).toBe(10);
    expect(result.transaction.type).toBe('WASTE');
    expect(result.request.status).toBe('APPROVED');
    const txData = mockPrisma.inventoryTransaction.create.mock.calls[0][0].data;
    expect(txData.createdBy).toBe('acc-2'); // giu nguoi tao yeu cau ban dau, khong phai nguoi duyet
    expect(txData.referenceType).toBe('ADJUSTMENT_REQUEST');
  });

  it('chan duyet neu ton kho hien tai da giam qua nhieu ke tu luc gui yeu cau (am kho)', async () => {
    const pendingRequest = {
      id: 'req-1', accountId: 'acc-1', ingredientId: 'ing-1', type: 'WASTE',
      quantity: 10, beforeQuantity: 20, afterQuantity: 10, note: 'ly do', status: 'PENDING', requestedBy: 'acc-2',
    };
    mockPrisma.inventoryAdjustmentRequest.findUnique.mockResolvedValue(pendingRequest);
    // Ton kho hien tai chi con 5 (da bi xuat bot noi khac) -> khong du de tru 10
    mockPrisma.ingredient.findUnique.mockResolvedValue(baseIngredient({ quantity: 5 }));

    await expect(
      inventoryService.approveAdjustmentRequest('req-1', { id: 'm', accountId: 'acc-1', permissions: ['INVENTORY_APPROVE'] })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('chan 400 neu yeu cau da duoc xu ly truoc do', async () => {
    mockPrisma.inventoryAdjustmentRequest.findUnique.mockResolvedValue({
      id: 'req-1', accountId: 'acc-1', ingredientId: 'ing-1', status: 'APPROVED',
    });

    await expect(
      inventoryService.approveAdjustmentRequest('req-1', { id: 'm', accountId: 'acc-1', permissions: ['INVENTORY_APPROVE'] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('chan 403 neu quan ly thuoc tai khoan khac', async () => {
    mockPrisma.inventoryAdjustmentRequest.findUnique.mockResolvedValue({
      id: 'req-1', accountId: 'acc-other', ingredientId: 'ing-1', status: 'PENDING',
    });

    await expect(
      inventoryService.approveAdjustmentRequest('req-1', { id: 'm', accountId: 'acc-1', permissions: ['INVENTORY_APPROVE'] })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('inventoryService.rejectAdjustmentRequest', () => {
  it('tu choi thanh cong, khong dong den ton kho', async () => {
    mockPrisma.inventoryAdjustmentRequest.findUnique.mockResolvedValue({
      id: 'req-1', accountId: 'acc-1', ingredientId: 'ing-1', status: 'PENDING',
    });
    mockPrisma.inventoryAdjustmentRequest.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'req-1', status: 'REJECTED', ...data, ingredient: null, account: null, reviewer: null })
    );

    const result = await inventoryService.rejectAdjustmentRequest(
      'req-1',
      'Nghi ngo khai bao khong dung',
      { id: 'm', accountId: 'acc-1', permissions: ['INVENTORY_APPROVE'] }
    );

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionReason).toBe('Nghi ngo khai bao khong dung');
    expect(mockPrisma.ingredient.update).not.toHaveBeenCalled();
  });

  it('chan 400 neu thieu ly do tu choi', async () => {
    mockPrisma.inventoryAdjustmentRequest.findUnique.mockResolvedValue({
      id: 'req-1', accountId: 'acc-1', ingredientId: 'ing-1', status: 'PENDING',
    });

    await expect(
      inventoryService.rejectAdjustmentRequest('req-1', '', { id: 'm', accountId: 'acc-1', permissions: ['INVENTORY_APPROVE'] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('inventoryService.getThresholdSetting / updateThresholdSetting', () => {
  it('tra ve nguong mac dinh 500,000 neu account chua cau hinh', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(undefined);
    const result = await inventoryService.getThresholdSetting({ id: 'acc-1', accountId: 'acc-1' });
    expect(result.threshold).toBe(500000);
  });

  it('chan neu cap nhat nguong am', async () => {
    await expect(
      inventoryService.updateThresholdSetting(-1, { id: 'acc-1', accountId: 'acc-1' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('cap nhat nguong thanh cong', async () => {
    mockPrisma.account.update.mockResolvedValue({});
    const result = await inventoryService.updateThresholdSetting(1000000, { id: 'acc-1', accountId: 'acc-1' });
    expect(result.threshold).toBe(1000000);
    expect(mockPrisma.account.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { inventoryApprovalThreshold: 1000000 },
    });
  });
});

describe('Batch/han su dung - tao lo khi nhap kho', () => {
  it('stockIn tao 1 IngredientBatch moi voi expiryDate + batchCode nguoi dung nhap', async () => {
    const ingredient = baseIngredient({ quantity: 10, price: 5000 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 20 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-batch-1', ...data, ingredient, account: null })
    );

    await inventoryService.stockIn(
      'ing-1',
      { quantity: 10, note: 'Nhap hang moi', expiryDate: '2026-12-31', batchCode: 'LOT-A1', unitCost: 4500 },
      { id: 'acc-1', accountId: 'acc-1' }
    );

    expect(mockPrisma.ingredientBatch.create).toHaveBeenCalledTimes(1);
    const batchData = mockPrisma.ingredientBatch.create.mock.calls[0][0].data;
    expect(batchData.batchCode).toBe('LOT-A1');
    expect(batchData.quantity).toBe(10);
    expect(batchData.initialQuantity).toBe(10);
    expect(batchData.unitCost).toBe(4500);
    expect(batchData.expiryDate).toEqual(new Date('2026-12-31'));
  });

  it('stockIn khong nhap expiryDate/batchCode van tao batch voi ma tu sinh, khong co han', async () => {
    const ingredient = baseIngredient({ quantity: 10, price: 5000 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 15 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-batch-2', ...data, ingredient, account: null })
    );

    await inventoryService.stockIn('ing-1', { quantity: 5, note: 'Nhap them' }, { id: 'acc-1', accountId: 'acc-1' });

    const batchData = mockPrisma.ingredientBatch.create.mock.calls[0][0].data;
    expect(batchData.batchCode).toMatch(/^LOT-/);
    expect(batchData.expiryDate).toBeNull();
    expect(batchData.unitCost).toBe(5000); // mac dinh lay theo gia niem yet cua ingredient
  });
});

describe('Batch/han su dung - tieu thu theo FEFO khi xuat kho', () => {
  it('stockOut tru dan tu lo het han som nhat truoc, sang lo tiep theo neu chua du', async () => {
    const ingredient = baseIngredient({ quantity: 15, price: 1000 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 5 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-out', ...data, ingredient, account: null })
    );

    // Lo A het han som hon lo B (gia dinh service da query dung thu tu ASC theo expiryDate)
    const batchA = { id: 'batch-A', batchCode: 'LOT-A', quantity: 5, expiryDate: new Date('2026-07-05') };
    const batchB = { id: 'batch-B', batchCode: 'LOT-B', quantity: 10, expiryDate: new Date('2026-08-01') };
    mockPrisma.ingredientBatch.findMany.mockResolvedValue([batchA, batchB]);
    mockPrisma.ingredientBatch.update.mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data }));

    await inventoryService.stockOut(
      'ing-1',
      { quantity: 10, type: 'OUT', note: 'Xuat cho bep' },
      { id: 'acc-1', accountId: 'acc-1' }
    );

    // Can gọi findMany voi orderBy uu tien het han truoc
    const findManyArgs = mockPrisma.ingredientBatch.findMany.mock.calls[0][0];
    expect(findManyArgs.where).toMatchObject({ ingredientId: 'ing-1', status: 'ACTIVE' });
    expect(findManyArgs.orderBy).toEqual([{ expiryDate: 'asc' }, { receivedDate: 'asc' }]);

    // Lo A (5 don vi, het han som) phai bi tru het truoc -> DEPLETED
    expect(mockPrisma.ingredientBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'batch-A' },
      data: { quantity: 0, status: 'DEPLETED' },
    });
    // Con thieu 5 -> tru tiep tu lo B (con 10 - 5 = 5, van ACTIVE)
    expect(mockPrisma.ingredientBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'batch-B' },
      data: { quantity: 5, status: 'ACTIVE' },
    });
  });

  it('xuat khong du trong batch (du lieu legacy chua co batch) van khong throw loi, chi tru toi da co the', async () => {
    const ingredient = baseIngredient({ quantity: 10, price: 1000 });
    mockPrisma.ingredient.findUnique.mockResolvedValue(ingredient);
    mockPrisma.ingredient.update.mockResolvedValue({ ...ingredient, quantity: 5 });
    mockPrisma.inventoryTransaction.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'tx-legacy', ...data, ingredient, account: null })
    );
    mockPrisma.ingredientBatch.findMany.mockResolvedValue([]); // chua co batch nao (du lieu cu)

    await expect(
      inventoryService.stockOut('ing-1', { quantity: 5, type: 'OUT' }, { id: 'acc-1', accountId: 'acc-1' })
    ).resolves.toBeDefined();

    expect(mockPrisma.ingredientBatch.update).not.toHaveBeenCalled();
  });
});
