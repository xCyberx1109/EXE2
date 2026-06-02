import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // POS
  { code: 'POS_OPEN', name: 'Mở ca POS', module: 'POS' },
  { code: 'POS_CLOSE', name: 'Đóng ca POS', module: 'POS' },
  { code: 'POS_CREATE_ORDER', name: 'Tạo đơn hàng', module: 'POS' },
  { code: 'POS_CANCEL_ORDER', name: 'Hủy đơn hàng', module: 'POS' },
  { code: 'POS_APPLY_DISCOUNT', name: 'Áp dụng giảm giá', module: 'POS' },
  
  // POS DEVICE
  { code: 'POS_DEVICE_VIEW', name: 'Xem thiết bị POS', module: 'POS_DEVICE' },
  { code: 'POS_DEVICE_CREATE', name: 'Tạo thiết bị POS', module: 'POS_DEVICE' },
  { code: 'POS_DEVICE_UPDATE', name: 'Cập nhật thiết bị POS', module: 'POS_DEVICE' },
  { code: 'POS_DEVICE_DELETE', name: 'Xóa thiết bị POS', module: 'POS_DEVICE' },
  { code: 'POS_DEVICE_RESET', name: 'Reset thiết bị POS', module: 'POS_DEVICE' },

  // MENU
  { code: 'MENU_CREATE', name: 'Thêm món mới', module: 'MENU' },
  { code: 'MENU_UPDATE', name: 'Cập nhật món', module: 'MENU' },
  { code: 'MENU_DELETE', name: 'Xóa món', module: 'MENU' },
  
  // STAFF
  { code: 'STAFF_VIEW', name: 'Xem nhân viên', module: 'STAFF' },
  { code: 'STAFF_CREATE', name: 'Thêm nhân viên', module: 'STAFF' },
  { code: 'STAFF_UPDATE', name: 'Cập nhật nhân viên', module: 'STAFF' },
  { code: 'STAFF_DELETE', name: 'Xóa nhân viên', module: 'STAFF' },
  
  // REPORT
  { code: 'REPORT_VIEW', name: 'Xem báo cáo', module: 'REPORT' },
  { code: 'REPORT_EXPORT', name: 'Xuất báo cáo', module: 'REPORT' },
  
  // BRANCH
  { code: 'BRANCH_VIEW', name: 'Xem chi nhánh', module: 'BRANCH' },
  { code: 'BRANCH_CREATE', name: 'Tạo chi nhánh', module: 'BRANCH' },
  { code: 'BRANCH_UPDATE', name: 'Cập nhật chi nhánh', module: 'BRANCH' },
  { code: 'BRANCH_LOCK', name: 'Khóa chi nhánh', module: 'BRANCH' },
  { code: 'BRANCH_UNLOCK', name: 'Mở khóa chi nhánh', module: 'BRANCH' },
  { code: 'BRANCH_DELETE', name: 'Xóa chi nhánh', module: 'BRANCH' },
  { code: 'BRANCH_ALL_ACCESS', name: 'Truy cập tất cả chi nhánh', module: 'BRANCH' },

  // PERMISSION
  { code: 'PERMISSION_VIEW', name: 'Xem danh sách quyền', module: 'PERMISSION' },
  { code: 'PERMISSION_ASSIGN', name: 'Gán quyền cho tài khoản', module: 'PERMISSION' },
];

const DEFAULT_MAPPINGS = {
  ADMIN: PERMISSIONS.map(p => p.code),
  MANAGER: [
    'POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER', 'POS_CANCEL_ORDER', 'POS_APPLY_DISCOUNT',
    'POS_DEVICE_VIEW', 'POS_DEVICE_CREATE', 'POS_DEVICE_UPDATE',
    'MENU_CREATE', 'MENU_UPDATE', 'MENU_DELETE',
    'STAFF_VIEW', 'STAFF_CREATE', 'STAFF_UPDATE', 'STAFF_DELETE',
    'REPORT_VIEW', 'REPORT_EXPORT',
    'BRANCH_VIEW'
  ],
  STAFF: [
    'POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER'
  ],
  CASHIER: [
    'POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER', 'POS_APPLY_DISCOUNT'
  ],
  KITCHEN: [
    'POS_OPEN'
  ]
};

async function main() {
  console.log('Seeding Account-based Permissions...');

  // 1. Upsert Permissions
  const createdPermissions = {};
  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, module: p.module },
      create: p,
    });
    createdPermissions[p.code] = permission.id;
  }
  console.log(`Created/Updated ${PERMISSIONS.length} permissions.`);

  // 2. Map existing accounts to permissions based on their role
  const accounts = await prisma.account.findMany();
  console.log(`Mapping ${accounts.length} accounts...`);

  for (const account of accounts) {
    const rolePermissions = DEFAULT_MAPPINGS[account.role] || DEFAULT_MAPPINGS.STAFF;
    
    // Clear existing permissions for this account
    await prisma.accountPermission.deleteMany({
      where: { accountId: account.id }
    });

    // Add new permissions
    const permissionsToAdd = rolePermissions.map(code => ({
      accountId: account.id,
      permissionId: createdPermissions[code],
      allowed: true
    }));

    if (permissionsToAdd.length > 0) {
      await prisma.accountPermission.createMany({
        data: permissionsToAdd
      });
    }
  }

  console.log('Account permissions mapping completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
