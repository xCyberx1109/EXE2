import { jest } from '@jest/globals';

// Mock toan bo prisma client TRUOC khi import service (giong pattern o category.service.test.js).
const mockPrisma = {
  account: {
    findUnique: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
  },
  employee: {
    findUnique: jest.fn(),
  },
  deviceTypePermission: {
    findMany: jest.fn(),
  },
  deviceFeatureOverride: {
    findMany: jest.fn(),
  },
};

jest.unstable_mockModule('../src/prisma/client.js', () => ({
  default: mockPrisma,
  disconnectPrisma: jest.fn(),
}));

const { permissionService } = await import('../src/modules/permissions/permission.service.js');
const { devicePermissionService } = await import('../src/modules/permissions/devicePermission.service.js');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('permissionService.getRolePermissions', () => {
  it('tra ve danh sach permission code cua role', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      deletedAt: null,
      rolePermissions: [
        { permission: { code: 'ORDER_VIEW' } },
        { permission: { code: 'ORDER_CREATE' } },
      ],
    });

    const result = await permissionService.getRolePermissions('role-1');

    expect(result).toEqual(['ORDER_VIEW', 'ORDER_CREATE']);
  });

  it('tra ve mang rong neu roleId khong duoc cung cap', async () => {
    const result = await permissionService.getRolePermissions(null);
    expect(result).toEqual([]);
    expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
  });

  it('tra ve mang rong neu role da bi xoa mem', async () => {
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      deletedAt: new Date(),
      rolePermissions: [{ permission: { code: 'ORDER_VIEW' } }],
    });

    const result = await permissionService.getRolePermissions('role-1');
    expect(result).toEqual([]);
  });

  it('tra ve mang rong neu khong tim thay role', async () => {
    mockPrisma.role.findUnique.mockResolvedValue(null);
    const result = await permissionService.getRolePermissions('missing');
    expect(result).toEqual([]);
  });
});

describe('devicePermissionService.getEffectivePermissions', () => {
  const device = { id: 'device-1', template: 'CASHIER' };

  it('khong co employeeId -> tra ve quyen thuan theo thiet bi (hardcode + DeviceTypePermission)', async () => {
    mockPrisma.deviceTypePermission.findMany.mockResolvedValue([
      { permission: { code: 'ORDER_VIEW' } },
    ]);

    const result = await devicePermissionService.getEffectivePermissions(device);

    expect(result).toContain('ORDER_VIEW');
    expect(mockPrisma.employee.findUnique).not.toHaveBeenCalled();
  });

  it('employeeId nhung nhan vien chua duoc gan Role -> giu hanh vi cu (chi theo thiet bi)', async () => {
    mockPrisma.deviceTypePermission.findMany.mockResolvedValue([
      { permission: { code: 'ORDER_VIEW' } },
    ]);
    mockPrisma.employee.findUnique.mockResolvedValue({ roleId: null });

    const result = await devicePermissionService.getEffectivePermissions(device, 'emp-1');

    expect(result).toContain('ORDER_VIEW');
    expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
  });

  it('co Role va DeviceTypePermission da cau hinh -> quyen hieu luc la GIAO (intersection)', async () => {
    mockPrisma.deviceTypePermission.findMany.mockResolvedValue([
      { permission: { code: 'ORDER_VIEW' } },
      { permission: { code: 'PAYMENT_REFUND' } },
    ]);
    mockPrisma.employee.findUnique.mockResolvedValue({ roleId: 'role-1' });
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      deletedAt: null,
      rolePermissions: [{ permission: { code: 'ORDER_VIEW' } }],
    });

    const result = await devicePermissionService.getEffectivePermissions(device, 'emp-1');

    // Chi ORDER_VIEW co trong CA role lan thiet bi -> PAYMENT_REFUND (thiet bi cho phep
    // nhung role khong co) phai bi loai.
    expect(result).toEqual(['ORDER_VIEW']);
  });

  it('co Role nhung chua cau hinh DeviceTypePermission nao -> khong bi khoa het, dung nguyen quyen theo Role', async () => {
    mockPrisma.deviceTypePermission.findMany.mockResolvedValue([]);
    mockPrisma.employee.findUnique.mockResolvedValue({ roleId: 'role-1' });
    mockPrisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      deletedAt: null,
      rolePermissions: [
        { permission: { code: 'ORDER_VIEW' } },
        { permission: { code: 'ORDER_CREATE' } },
      ],
    });

    const result = await devicePermissionService.getEffectivePermissions(device, 'emp-1');

    expect(result).toEqual(['ORDER_VIEW', 'ORDER_CREATE']);
  });
});
