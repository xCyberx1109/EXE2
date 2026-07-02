/**
 * Backfill du lieu cho tang Role moi (xem migration 20260702000000_add_role_based_permissions).
 *
 * Truoc day quyen cua Employee (nhan vien dang nhap PIN) tinh thuan theo loai may POS ho
 * dang nhap vao - script nay tao san 3 Role mau he thong theo tung Account (tenant) va gan
 * cho Employee hien co dua theo loai may ho tung dang nhap gan nhat, de hanh vi khong doi
 * ngay lap tuc. Chu quan co the tao them Role rieng / doi gan sau qua UI Quan ly vai tro.
 *
 * Usage:
 *   node backend/prisma/backfill-employee-roles.js --dry-run
 *   node backend/prisma/backfill-employee-roles.js --apply
 */

import prisma from '../src/prisma/client.js';
import process from 'process';

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run';

// Bo permission code mau cho tung Role - lay tu danh sach Permission that trong DB
// (chi giu code nao thuc su ton tai, bo qua neu thieu).
const SYSTEM_ROLE_TEMPLATES = [
  {
    name: 'Thu ngân',
    description: 'Tạo/thu tiền đơn hàng, mở/đóng ca, xem menu và bàn.',
    deviceTypes: ['CASHIER', 'WAITER', 'TABLET'],
    permissionCodes: [
      'DASHBOARD_VIEW',
      'POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER', 'POS_CANCEL_ORDER',
      'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE',
      'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_PAY',
      'MENU_VIEW', 'TABLE_VIEW', 'TABLE_UPDATE',
      'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
      'SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_CLOSE',
    ],
  },
  {
    name: 'Bếp',
    description: 'Xem đơn hàng cần chế biến, cập nhật trạng thái món.',
    deviceTypes: ['KITCHEN'],
    permissionCodes: [
      'DASHBOARD_VIEW', 'ORDER_VIEW', 'MENU_VIEW', 'POS_ORDER_QUEUE_VIEW',
    ],
  },
  {
    name: 'Quản lý ca',
    description: 'Toàn quyền thu ngân, thêm điều chỉnh kho/nhân sự/báo cáo trong ca.',
    deviceTypes: ['MANAGER'],
    permissionCodes: [
      'DASHBOARD_VIEW',
      'POS_OPEN', 'POS_CLOSE', 'POS_CREATE_ORDER', 'POS_CANCEL_ORDER',
      'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_DELETE',
      'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_DELETE', 'POS_ORDER_QUEUE_PAY',
      'MENU_VIEW', 'MENU_CREATE', 'MENU_UPDATE',
      'CATEGORY_VIEW',
      'TABLE_VIEW', 'TABLE_CREATE', 'TABLE_UPDATE', 'TABLE_DELETE',
      'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE',
      'INVENTORY_VIEW', 'INVENTORY_ADJUST',
      'REPORT_VIEW',
      'STAFF_VIEW',
      'SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_UPDATE', 'SHIFT_CLOSE',
    ],
  },
];

async function main() {
  console.log(`\n=== Backfill Employee Roles - Mode: ${MODE.toUpperCase()} ===`);

  const accounts = await prisma.account.findMany({ select: { id: true, fullName: true } });
  console.log(`Tìm thấy ${accounts.length} account (tenant).`);

  const allPermissions = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionIdByCode = new Map(allPermissions.map((p) => [p.code, p.id]));

  const plan = [];

  for (const account of accounts) {
    for (const template of SYSTEM_ROLE_TEMPLATES) {
      const existing = await prisma.role.findFirst({
        where: { accountId: account.id, name: template.name },
      });

      const validPermissionIds = template.permissionCodes
        .map((code) => permissionIdByCode.get(code))
        .filter(Boolean);
      const missingCodes = template.permissionCodes.filter((code) => !permissionIdByCode.has(code));

      plan.push({
        accountId: account.id,
        accountName: account.fullName,
        roleName: template.name,
        deviceTypes: template.deviceTypes,
        alreadyExists: !!existing,
        roleId: existing?.id,
        permissionCount: validPermissionIds.length,
        missingCodes,
      });
    }
  }

  console.log('\n===== KE HOACH TAO ROLE MAU =====');
  console.table(plan.map((p) => ({
    account: p.accountName,
    role: p.roleName,
    daTonTai: p.alreadyExists ? 'co' : 'chua',
    soQuyen: p.permissionCount,
    thieuCode: p.missingCodes.length,
  })));

  // Employee can backfill: gan roleId theo template cua may POS dang nhap gan nhat
  // (qua EmployeePosMachine), chi cho nhan vien chua co roleId.
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, roleId: null },
    include: {
      posMachines: {
        include: { posMachine: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const employeePlan = employees.map((emp) => {
    const template = emp.posMachines[0]?.posMachine?.template;
    const matchedRole = SYSTEM_ROLE_TEMPLATES.find((t) => t.deviceTypes.includes(template));
    return {
      employeeId: emp.id,
      employeeName: emp.fullName,
      accountId: emp.accountId,
      deviceTemplate: template || '(chưa gán máy nào)',
      assignRoleName: matchedRole?.name || null,
    };
  });

  console.log('\n===== KE HOACH GAN ROLE CHO NHAN VIEN HIEN CO =====');
  console.table(employeePlan.map((e) => ({
    nhanVien: e.employeeName,
    thietBiGanGanNhat: e.deviceTemplate,
    seGanRole: e.assignRoleName || '(bỏ qua - chưa từng gán máy)',
  })));

  if (MODE === 'dry-run') {
    console.log('\nDRY-RUN xong. Chưa tạo/gán gì cả. Chạy lại với --apply để thực hiện.');
    return;
  }

  console.log('\n=== APPLY: đang tạo Role mẫu + gán quyền + gán cho nhân viên ===');

  const roleIdByAccountAndName = new Map();

  for (const account of accounts) {
    for (const template of SYSTEM_ROLE_TEMPLATES) {
      const role = await prisma.role.upsert({
        where: { accountId_name: { accountId: account.id, name: template.name } },
        update: {},
        create: {
          accountId: account.id,
          name: template.name,
          description: template.description,
          isSystem: true,
        },
      });

      const validPermissionIds = template.permissionCodes
        .map((code) => permissionIdByCode.get(code))
        .filter(Boolean);

      await prisma.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (validPermissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: validPermissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
            skipDuplicates: true,
          });
        }
      }, { maxWait: 10000, timeout: 20000 });

      roleIdByAccountAndName.set(`${account.id}|${template.name}`, role.id);
    }
  }

  let assignedCount = 0;
  for (const e of employeePlan) {
    if (!e.assignRoleName) continue;
    const roleId = roleIdByAccountAndName.get(`${e.accountId}|${e.assignRoleName}`);
    if (!roleId) continue;
    await prisma.employee.update({ where: { id: e.employeeId }, data: { roleId } });
    assignedCount++;
  }

  console.log(`\nĐã tạo/cập nhật Role mẫu cho ${accounts.length} account, gán Role cho ${assignedCount}/${employeePlan.length} nhân viên đủ điều kiện.`);
}

main()
  .catch((e) => {
    console.error('\n[LỖI]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
