// ============================================================================
// SYNC PERMISSIONS — Đồng bộ permissions database với source code (data.js)
// ============================================================================
// Usage: node prisma/sync-permissions.js
// ============================================================================

import prisma, { disconnectPrisma } from '../src/prisma/client.js';
import { permissions as NEW_PERMISSIONS } from '../src/seed/data.js';

// Helper: group by code for O(1) lookup
const newPermMap = new Map(NEW_PERMISSIONS.map((p) => [p.code, p]));
const newCodes = new Set(NEW_PERMISSIONS.map((p) => p.code));

const report = {
  added: [],
  updated: [],
  deleted: [],
  orphanMapping: [],
};

async function main() {
  console.log('='.repeat(60));
  console.log('SYNC PERMISSIONS — Supabase ↔ Source Code');
  console.log('='.repeat(60));

  // -------------------------------------------------------
  // 1. Backup current permissions
  // -------------------------------------------------------
  console.log('\n[1/8] Backing up current permissions...');
  const oldPerms = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
  const fs = await import('fs');
  const path = await import('path');
  const backupPath = path.resolve(
    import.meta.dirname,
    `../backups/permissions_backup_${Date.now()}.json`,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, JSON.stringify(oldPerms, null, 2), 'utf-8');
  console.log(`   ✓ Backed up ${oldPerms.length} permissions to ${path.basename(backupPath)}`);

  const oldPermMap = new Map(oldPerms.map((p) => [p.code, p]));
  const oldCodes = new Set(oldPerms.map((p) => p.code));

  // -------------------------------------------------------
  // 2. Compare old vs new
  // -------------------------------------------------------
  console.log('\n[2/8] Comparing permissions...');
  const codesOnlyInDB = [...oldCodes].filter((c) => !newCodes.has(c));
  const codesOnlyInSource = [...newCodes].filter((c) => !oldCodes.has(c));
  const codesInBoth = [...oldCodes].filter((c) => newCodes.has(c));

  console.log(`   DB only (to delete): ${codesOnlyInDB.length}`);
  console.log(`   Source only (to add): ${codesOnlyInSource.length}`);
  console.log(`   In both (to update if changed): ${codesInBoth.length}`);

  // -------------------------------------------------------
  // 3. Check mapping tables for permissions to be deleted
  // -------------------------------------------------------
  console.log('\n[3/8] Checking mapping references for permissions to be deleted...');
  const protectedCodes = [];
  const safeToDelete = [];

  for (const code of codesOnlyInDB) {
    const perm = oldPermMap.get(code);
    const refs = {
      accountPerms: await prisma.accountPermission.count({ where: { permissionId: perm.id, allowed: true } }),
      featurePerms: await prisma.featurePermission.count({ where: { permissionId: perm.id } }),
      devicePerms: await prisma.deviceTypePermission.count({ where: { permissionId: perm.id } }),
    };
    const totalRefs = refs.accountPerms + refs.featurePerms + refs.devicePerms;
    if (totalRefs > 0) {
      protectedCodes.push({ code, ...refs, name: perm.name, module: perm.module });
      report.orphanMapping.push({ code, name: perm.name, module: perm.module, ...refs });
    } else {
      safeToDelete.push(code);
    }
  }

  if (protectedCodes.length > 0) {
    console.log(`   ⚠ ${protectedCodes.length} permission(s) still referenced by other tables:`);
    for (const p of protectedCodes) {
      console.log(`      - ${p.code} (${p.name}) → account:${p.accountPerms} feature:${p.featurePerms} device:${p.devicePerms}`);
    }
  } else {
    console.log('   ✓ No permissions to be deleted are referenced');
  }

  // -------------------------------------------------------
  // 4. Delete permissions not in the new list
  // -------------------------------------------------------
  console.log('\n[4/8] Deleting obsolete permissions...');
  let deletedCount = 0;
  for (const code of safeToDelete) {
    const perm = oldPermMap.get(code);
    // Check once more for race condition
    const refCheck = await prisma.accountPermission.count({ where: { permissionId: perm.id } });
    if (refCheck > 0) {
      console.warn(`   ⚠ Skipping ${code}: still has ${refCheck} account_permission reference(s)`);
      continue;
    }
    await prisma.permission.delete({ where: { code } });
    report.deleted.push({ code, name: perm.name, module: perm.module });
    deletedCount++;
  }
  // For protected codes, we only log — not auto-delete
  console.log(`   ✓ Deleted ${deletedCount} permission(s)`);
  if (protectedCodes.length > 0) {
    console.log(`   ⚠ ${protectedCodes.length} permission(s) SKIPPED (referenced) — see report.orphanMapping`);
  }

  // -------------------------------------------------------
  // 5. Add new permissions
  // -------------------------------------------------------
  console.log('\n[5/8] Adding new permissions...');
  let addedCount = 0;
  for (const code of codesOnlyInSource) {
    const p = newPermMap.get(code);
    await prisma.permission.create({
      data: {
        code: p.code,
        name: p.name,
        module: p.module,
        isSystem: p.isSystem || false,
      },
    });
    report.added.push({ code, name: p.name, module: p.module });
    addedCount++;
  }
  console.log(`   ✓ Added ${addedCount} new permission(s)`);

  // -------------------------------------------------------
  // 6. Update existing permissions (name/module/description)
  // -------------------------------------------------------
  console.log('\n[6/8] Updating existing permissions...');
  let updatedCount = 0;
  for (const code of codesInBoth) {
    const oldP = oldPermMap.get(code);
    const newP = newPermMap.get(code);
    const changes = {};
    if (oldP.name !== newP.name) changes.name = newP.name;
    if (oldP.module !== newP.module) changes.module = newP.module;
    if ((oldP.isSystem || false) !== (newP.isSystem || false)) changes.isSystem = newP.isSystem || false;
    if (Object.keys(changes).length > 0) {
      await prisma.permission.update({ where: { code }, data: changes });
      report.updated.push({ code, changes });
      updatedCount++;
    }
  }
  console.log(`   ✓ Updated ${updatedCount} existing permission(s)`);

  // -------------------------------------------------------
  // 7. Final verification
  // -------------------------------------------------------
  console.log('\n[7/8] Verifying final state...');
  const finalPerms = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
  const finalCodes = new Set(finalPerms.map((p) => p.code));

  // Check: every new code exists in DB
  const missingInDB = [...newCodes].filter((c) => !finalCodes.has(c));
  if (missingInDB.length > 0) {
    console.error(`   ✗ MISSING in DB: ${missingInDB.join(', ')}`);
  }

  // Check: every DB code is in new list
  const extraInDB = [...finalCodes].filter((c) => !newCodes.has(c));
  if (extraInDB.length > 0) {
    console.warn(`   ⚠ EXTRA in DB (protected/orphan): ${extraInDB.join(', ')}`);
  }

  const match = missingInDB.length === 0 && extraInDB.length === 0;
  console.log(`   ✓ Final permission count: ${finalPerms.length} (source: ${NEW_PERMISSIONS.length})`);
  console.log(`   ${match ? '✓ 100% MATCH' : '✗ MISMATCH — see details above'}`);

  // -------------------------------------------------------
  // 8. Print report
  // -------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('REPORT');
  console.log('='.repeat(60));

  console.log(`\n--- ADDED (${report.added.length}) ---`);
  for (const p of report.added) console.log(`  + ${p.code} (${p.module})`);

  console.log(`\n--- UPDATED (${report.updated.length}) ---`);
  for (const p of report.updated) console.log(`  ~ ${p.code}: ${JSON.stringify(p.changes)}`);

  console.log(`\n--- DELETED (${report.deleted.length}) ---`);
  for (const p of report.deleted) console.log(`  - ${p.code} (${p.module})`);

  console.log(`\n--- ORPHAN MAPPING (${report.orphanMapping.length}) ---`);
  if (report.orphanMapping.length > 0) {
    console.log('  Permissions referenced by account/feature/device tables but not in new list:');
    for (const p of report.orphanMapping) {
      console.log(`  ! ${p.code} (${p.name}) — accountPerms:${p.accountPerms} featurePerms:${p.featurePerms} devicePerms:${p.devicePerms}`);
    }
    console.log('\n  ⚠ These permissions were NOT deleted because they are still referenced.');
    console.log('  ⚠ Manual review required before deletion.');
  } else {
    console.log('  ✓ No orphan references found');
  }

  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
}

main()
  .catch((err) => {
    console.error('\n✗ Sync failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
