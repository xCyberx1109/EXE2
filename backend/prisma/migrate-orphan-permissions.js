// ============================================================================
// MIGRATE ORPHAN PERMISSION REFERENCES
// ============================================================================
// Migrates account_permissions from old legacy codes to new equivalent codes,
// then deletes the old permissions so the sync can reach 100% match.
// ============================================================================

import prisma, { disconnectPrisma } from '../src/prisma/client.js';

const MAPPING = [
  { oldCode: 'BILLIARD_TABLE_PLAY_NOW', newCode: 'BILLIARD_SESSION_START' },
  { oldCode: 'BILLIARD_TABLE_RESERVE', newCode: 'BILLIARD_RESERVATION_CREATE' },
  { oldCode: 'BILLIARD_TABLE_CHECKIN', newCode: 'BILLIARD_SESSION_CHECKIN' },
  { oldCode: 'POS_ORDER_QUEUE_PAYMENT', newCode: 'POS_ORDER_QUEUE_PAY' },
];

async function main() {
  console.log('Migrating orphan permission references...\n');

  for (const { oldCode, newCode } of MAPPING) {
    const oldPerm = await prisma.permission.findUnique({ where: { code: oldCode } });
    const newPerm = await prisma.permission.findUnique({ where: { code: newCode } });

    if (!oldPerm) {
      console.log(`  ${oldCode} not found in DB, skipping`);
      continue;
    }
    if (!newPerm) {
      console.error(`  ✗ ${newCode} not found in DB!`);
      continue;
    }

    // Find all account_permissions referencing the old permission
    const refs = await prisma.accountPermission.findMany({
      where: { permissionId: oldPerm.id, allowed: true },
    });

    console.log(`  ${oldCode} → ${newCode}: ${refs.length} account(s) to migrate`);

    for (const ref of refs) {
      // Check if new permission already granted to this account
      const existing = await prisma.accountPermission.findUnique({
        where: {
          accountId_permissionId: {
            accountId: ref.accountId,
            permissionId: newPerm.id,
          },
        },
      });

      if (!existing) {
        // Create new mapping
        await prisma.accountPermission.create({
          data: {
            accountId: ref.accountId,
            permissionId: newPerm.id,
            allowed: ref.allowed,
            grantedBy: ref.grantedBy,
            expiresAt: ref.expiresAt,
          },
        });
        console.log(`    → Granted ${newCode} to account ${ref.accountId}`);
      } else {
        console.log(`    → ${newCode} already granted to account ${ref.accountId}, skipping`);
      }

      // Delete old reference
      await prisma.accountPermission.delete({ where: { id: ref.id } });
    }

    // Verify no more references
    const remaining = await prisma.accountPermission.count({ where: { permissionId: oldPerm.id } });
    if (remaining === 0) {
      await prisma.permission.delete({ where: { code: oldCode } });
      console.log(`  ✓ Deleted old permission ${oldCode}`);
    } else {
      console.warn(`  ⚠ ${oldCode} still has ${remaining} references, not deleted`);
    }
  }

  // Final verification
  const finalOrphans = [];
  for (const { oldCode } of MAPPING) {
    const p = await prisma.permission.findUnique({ where: { code: oldCode } });
    if (p) finalOrphans.push(oldCode);
  }

  console.log('\n' + '='.repeat(50));
  if (finalOrphans.length === 0) {
    console.log('✓ All orphan permissions migrated and deleted successfully');
  } else {
    console.warn(`⚠ Still orphan: ${finalOrphans.join(', ')}`);
  }

  const totalPerms = await prisma.permission.count();
  console.log(`Total permissions in DB: ${totalPerms}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await disconnectPrisma(); });
