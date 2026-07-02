/**
 * Xoa cac Account rac do integration test tao ra nhung khong don dep het
 * (vi bi loi FK constraint khi test that bai giua chung - xem *.integration.test.js).
 *
 * Usage:
 *   node backend/prisma/cleanup-test-accounts.js "<fullName>" --dry-run
 *   node backend/prisma/cleanup-test-accounts.js "<fullName>" --apply
 *
 * - --dry-run: chi doc, in ra so luong se bi xoa, KHONG ghi/xoa gi ca.
 * - --apply: thuc hien xoa that, tat ca trong 1 transaction (fail la rollback het).
 * - <fullName>: ten day du can xoa (khop chinh xac). Mac dinh neu bo qua:
 *     'Inventory Integration Test Account'
 *
 * Cac ten test account con biet trong codebase (backend/tests/*.integration.test.js):
 *   - Inventory Integration Test Account
 *   - Inventory Batch Test Account
 *   - Order Recipe Snapshot Test Account
 *   - Order Reservation Test Account
 */

import prisma from '../src/prisma/client.js';
import process from 'process';

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run';
const scriptArgs = process.argv.slice(2);
const TARGET_FULL_NAME = scriptArgs.find((a) => !a.startsWith('--')) || 'Inventory Integration Test Account';

async function main() {
  console.log(`\n=== Cleanup Test Accounts - Mode: ${MODE.toUpperCase()} ===`);
  console.log(`Tim account co fullName = "${TARGET_FULL_NAME}"\n`);

  const accounts = await prisma.account.findMany({
    where: { fullName: TARGET_FULL_NAME },
    select: { id: true, email: true, fullName: true, createdAt: true },
  });

  if (accounts.length === 0) {
    console.log('Khong tim thay account nao khop. Khong co gi de xoa.');
    return;
  }

  console.log(`Tim thay ${accounts.length} account:`);
  console.table(accounts.map((a) => ({ id: a.id, email: a.email, createdAt: a.createdAt })));

  const accountIds = accounts.map((a) => a.id);

  const orders = await prisma.order.findMany({
    where: { OR: [{ createdBy: { in: accountIds } }, { accountId: { in: accountIds } }] },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  const employees = await prisma.employee.findMany({
    where: { accountId: { in: accountIds } },
    select: { id: true },
  });
  const employeeIds = employees.map((e) => e.id);

  const [
    redeemedVoucherCount,
    adjustmentRequestCount,
    transactionCount,
    batchCount,
    posMachineSessionCount,
    activityLogCount,
    staffSessionCount,
    shiftCount,
    // Chi de tham khao - KHONG xoa (khong co FK rang buoc toi Account nen khong chan viec xoa account)
    orphanIngredientCount,
    orphanMenuItemCount,
    orphanTableCount,
  ] = await Promise.all([
    prisma.redeemedVoucher.count({ where: { orderId: { in: orderIds } } }),
    prisma.inventoryAdjustmentRequest.count({
      where: { OR: [{ requestedBy: { in: accountIds } }, { reviewedBy: { in: accountIds } }, { accountId: { in: accountIds } }] },
    }),
    prisma.inventoryTransaction.count({
      where: { OR: [{ createdBy: { in: accountIds } }, { accountId: { in: accountIds } }] },
    }),
    prisma.ingredientBatch.count({
      where: { OR: [{ createdBy: { in: accountIds } }, { accountId: { in: accountIds } }] },
    }),
    prisma.posMachineSession.count({ where: { employeeId: { in: employeeIds } } }),
    prisma.activityLog.count({ where: { OR: [{ accountId: { in: accountIds } }, { employeeId: { in: employeeIds } }] } }),
    prisma.staffSession.count({ where: { accountId: { in: accountIds } } }),
    prisma.shift.count({ where: { accountId: { in: accountIds } } }),
    prisma.ingredient.count({ where: { accountId: { in: accountIds } } }),
    prisma.menuItem.count({ where: { accountId: { in: accountIds } } }),
    prisma.table.count({ where: { accountId: { in: accountIds } } }),
  ]);

  console.log('\n===== SE XOA (co lien ket FK toi account) =====');
  console.table({
    orders: orderIds.length,
    redeemedVouchers: redeemedVoucherCount,
    inventoryAdjustmentRequests: adjustmentRequestCount,
    inventoryTransactions: transactionCount,
    ingredientBatches: batchCount,
    employees: employeeIds.length,
    posMachineSessions: posMachineSessionCount,
    activityLogs: activityLogCount,
    staffSessions: staffSessionCount,
    shifts: shiftCount,
    accounts: accountIds.length,
  });

  if (orphanIngredientCount || orphanMenuItemCount || orphanTableCount) {
    console.log('\n===== KHONG XOA - chi de tham khao (accountId khong co FK rang buoc, se thanh du lieu mo coi) =====');
    console.table({
      ingredients: orphanIngredientCount,
      menuItems: orphanMenuItemCount,
      tables: orphanTableCount,
    });
    console.log('Neu muon don luon phan nay, cho toi biet de viet them script rieng (can xu ly MenuItemIngredient/OrderItem truoc).');
  }

  if (MODE === 'dry-run') {
    console.log('\nDRY-RUN xong. Chua xoa gi ca. Chay lai voi --apply de thuc hien xoa that.');
    return;
  }

  console.log('\n=== APPLY: dang xoa trong 1 transaction ===');

  await prisma.$transaction(async (tx) => {
    if (orderIds.length > 0) {
      await tx.redeemedVoucher.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } }); // cascade: OrderItem, OrderItemModifier, Kot, Payment, InventoryReservation
    }

    await tx.inventoryAdjustmentRequest.deleteMany({
      where: { OR: [{ requestedBy: { in: accountIds } }, { reviewedBy: { in: accountIds } }, { accountId: { in: accountIds } }] },
    });

    await tx.inventoryTransaction.deleteMany({
      where: { OR: [{ createdBy: { in: accountIds } }, { accountId: { in: accountIds } }] },
    });

    await tx.ingredientBatch.deleteMany({
      where: { OR: [{ createdBy: { in: accountIds } }, { accountId: { in: accountIds } }] },
    });

    if (employeeIds.length > 0) {
      await tx.posMachineSession.deleteMany({ where: { employeeId: { in: employeeIds } } });
    }

    await tx.activityLog.deleteMany({
      where: { OR: [{ accountId: { in: accountIds } }, { employeeId: { in: employeeIds } }] },
    });

    await tx.employee.deleteMany({ where: { accountId: { in: accountIds } } }); // cascade: EmployeePosMachine

    await tx.staffSession.deleteMany({ where: { accountId: { in: accountIds } } });

    await tx.shift.deleteMany({ where: { accountId: { in: accountIds } } });

    await tx.account.deleteMany({ where: { id: { in: accountIds } } }); // cascade: AccountPermission, InviteToken
  });

  console.log(`\nDa xoa xong ${accountIds.length} account "${TARGET_FULL_NAME}" va toan bo du lieu lien quan.`);
}

main()
  .catch((e) => {
    console.error('\n[LOI] Transaction bi huy, KHONG co gi bi xoa:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
