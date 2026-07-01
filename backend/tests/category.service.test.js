import { jest } from '@jest/globals';

// Mock toan bo prisma client TRUOC khi import service (giong pattern da dung o inventory tests):
// khong can DATABASE_URL that, test chay doc lap khong dung du lieu that.
const mockPrisma = {
  category: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  menuItem: {
    count: jest.fn(),
  },
};

jest.unstable_mockModule('../src/prisma/client.js', () => ({
  default: mockPrisma,
  disconnectPrisma: jest.fn(),
}));

const { categoryService } = await import('../src/modules/categories/category.service.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('categoryService.getStats', () => {
  it('tinh dung tong so danh muc/mon, % moi danh muc, sap xep giam dan theo so mon', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'c1', name: 'Do uong', active: true, _count: { menuItems: 2 } },
      { id: 'c2', name: 'Mon chinh', active: true, _count: { menuItems: 6 } },
      { id: 'c3', name: 'Trang mieng', active: false, _count: { menuItems: 2 } },
    ]);

    const result = await categoryService.getStats();

    expect(result.totalCategories).toBe(3);
    expect(result.totalActiveCategories).toBe(2);
    expect(result.totalItems).toBe(10);

    // Sap xep giam dan theo itemCount -> "Mon chinh" (6) dung dau
    expect(result.byCategory[0]).toMatchObject({ id: 'c2', itemCount: 6, percentage: 60 });
    expect(result.byCategory[1].percentage).toBe(20);
    expect(result.byCategory[2].percentage).toBe(20);

    // Chi lay danh muc chua xoa
    const queryArgs = mockPrisma.category.findMany.mock.calls[0][0];
    expect(queryArgs.where).toEqual({ deletedAt: null });
  });

  it('khong chia cho 0 neu chua co danh muc/mon nao', async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await categoryService.getStats();

    expect(result.totalCategories).toBe(0);
    expect(result.totalItems).toBe(0);
    expect(result.byCategory).toHaveLength(0);
  });
});

describe('categoryService.getById', () => {
  it('tra ve kem danh sach mon an thuoc danh muc, gia duoc convert sang so', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Do uong',
      slug: 'do-uong',
      description: null,
      active: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      deletedAt: null,
      _count: { menuItems: 2 },
      menuItems: [
        { id: 'm1', name: 'Tra sua', price: 25000, available: true },
        { id: 'm2', name: 'Ca phe', price: '20000', available: false },
      ],
    });

    const result = await categoryService.getById('c1');

    expect(result.itemCount).toBe(2);
    expect(result.menuItems).toHaveLength(2);
    expect(result.menuItems[1].price).toBe(20000);
    expect(result.menuItems[1].available).toBe(false);
  });

  it('bao loi 404 neu khong tim thay danh muc', async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    await expect(categoryService.getById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
