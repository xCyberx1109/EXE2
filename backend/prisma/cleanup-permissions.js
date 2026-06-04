/**
 * Permission Database Cleanup (Supabase/Postgres) via Prisma.
 *
 * Usage:
 *   node backend/prisma/cleanup-permissions.js --dry-run
 *   node backend/prisma/cleanup-permissions.js --apply
 *
 * Notes:
 * - --dry-run is read-only (no writes, no deletes).
 * - --apply performs everything in DB transactions.
 * - Uses these models: Permission, AccountPermission, Account
 */

import prisma from '../src/prisma/client.js';
import process from 'process';

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run';

const LEGACY_ROLE_CODES = new Set(['ROLE_VIEW', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE']);
const LEGACY_ROLE_MODULES = new Set(['role_management', 'role_permission']);

/**
 * Explicit normalization mapping rules for inconsistent naming variants.
 * The objective examples imply these should normalize to canonical codes.
 *
 * Only applied when both canonical + variant exist (or when variant can be safely mapped).
 */
const NORMALIZATION_MAP = new Map([
  ['MENU_READ', 'MENU_VIEW'],
  ['CATEGORIES_VIEW', 'CATEGORY_VIEW'],
  ['TABLES_VIEW', 'TABLE_VIEW'],
]);

function argError(message) {
  console.error(message);
  process.exit(1);
}

function modeInfo() {
  console.log(`\n=== Permission Cleanup Mode: ${MODE.toUpperCase()} ===`);
}

async function main() {
  modeInfo();

  if (MODE !== 'dry-run' && MODE !== 'apply') argError('Invalid mode. Use --dry-run or --apply.');

  // ----------------------------
  // Phase 0: Snapshot
  // ----------------------------
  console.log('\n[1/8] Loading snapshot data...');

  // Load all permissions (including soft-deleted). Requirement: clean duplicates regardless of deletedAt.
  const allPermissions = await prisma.permission.findMany({
    select: { id: true, code: true, name: true, module: true, createdAt: true, deletedAt: true, description: true },
  });

  // Load all account permissions (including duplicates/orphans).
  const allAccountPermissions = await prisma.accountPermission.findMany({
    select: { id: true, accountId: true, permissionId: true, allowed: true, grantedBy: true, createdAt: true, expiresAt: true },
  });

  // Load referenced accounts and permission ids
  const accountIdsInAccountPermissions = [...new Set(allAccountPermissions.map(ap => ap.accountId))];
  const permissionIdsInAccountPermissions = [...new Set(allAccountPermissions.map(ap => ap.permissionId))];

  const accountsExisting = await prisma.account.findMany({
    where: { id: { in: accountIdsInAccountPermissions } },
    select: { id: true },
  });

  const permissionsExisting = await prisma.permission.findMany({
    where: { id: { in: permissionIdsInAccountPermissions } },
    select: { id: true, code: true },
  });

  const existingAccountIdSet = new Set(accountsExisting.map(a => a.id));
  const existingPermissionIdSet = new Set(permissionsExisting.map(p => p.id));

  const permissionsById = new Map(allPermissions.map(p => [p.id, p]));
  const permissionsByCode = new Map(); // may not be unique if DB is already drifted; keep first seen by createdAt
  for (const p of allPermissions) {
    if (!permissionsByCode.has(p.code)) {
      permissionsByCode.set(p.code, p);
    } else {
      const prev = permissionsByCode.get(p.code);
      if ((p.createdAt || 0) < (prev.createdAt || 0)) permissionsByCode.set(p.code, p);
    }
  }

  // ----------------------------
  // Phase 1: Detect duplicates of permissions by (code, name, module)
  // ----------------------------
  console.log('\n[2/8] Detecting duplicate permissions (code + name + module)...');

  const permKey = (p) => `${p.code}|||${p.name ?? ''}|||${p.module ?? ''}`;

  const buckets = new Map(); // key -> [permission]
  for (const p of allPermissions) {
    const k = permKey(p);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(p);
  }

  const duplicatePermissionGroups = [];
  for (const [k, ps] of buckets.entries()) {
    if (ps.length > 1) {
      // canonical choice: smallest createdAt, then id
      const sorted = [...ps].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id));
      });
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);
      const [code, name, module] = k.split('|||');
      duplicatePermissionGroups.push({
        key: k,
        code,
        name,
        module,
        canonical,
        duplicates,
        count: ps.length,
      });
    }
  }

  // ----------------------------
  // Phase 2: Detect duplicate account_permissions
  // ----------------------------
  console.log('\n[3/8] Detecting duplicate account_permissions (accountId + permissionId)...');

  const apKey = (ap) => `${ap.accountId}|||${ap.permissionId}`;
  const apBuckets = new Map();
  for (const ap of allAccountPermissions) {
    const k = apKey(ap);
    if (!apBuckets.has(k)) apBuckets.set(k, []);
    apBuckets.get(k).push(ap);
  }

  const duplicateAccountPermissionGroups = [];
  for (const [k, aps] of apBuckets.entries()) {
    if (aps.length > 1) {
      const sorted = [...aps].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id));
      });
      const keep = sorted[0];
      const remove = sorted.slice(1);
      const [accountId, permissionId] = k.split('|||');
      duplicateAccountPermissionGroups.push({
        key: k,
        accountId,
        permissionId,
        keep,
        remove,
        count: aps.length,
      });
    }
  }

  // ----------------------------
  // Phase 3: Orphan records
  // ----------------------------
  console.log('\n[4/8] Detecting orphan records in account_permissions...');

  const orphanByMissingPermission = [];
  const orphanByMissingAccount = [];
  for (const ap of allAccountPermissions) {
    const permExists = existingPermissionIdSet.has(ap.permissionId);
    const accExists = existingAccountIdSet.has(ap.accountId);
    if (!permExists) orphanByMissingPermission.push(ap);
    if (!accExists) orphanByMissingAccount.push(ap);
  }
  // de-dupe orphans if both missing
  const orphanIds = new Set();
  const orphans = [];
  for (const ap of [...orphanByMissingPermission, ...orphanByMissingAccount]) {
    if (!orphanIds.has(ap.id)) {
      orphanIds.add(ap.id);
      orphans.push(ap);
    }
  }

  // ----------------------------
  // Phase 4: Legacy permissions detection
  // ----------------------------
  console.log('\n[5/8] Detecting legacy role permissions...');

  const legacyPermissions = [];
  for (const p of allPermissions) {
    const isLegacy =
      (LEGACY_ROLE_CODES.has(p.code) || LEGACY_ROLE_MODULES.has(p.module)) ||
      (typeof p.code === 'string' && p.code.startsWith('ROLE_')) ||
      (typeof p.module === 'string' && (p.module.includes('role_management') || p.module.includes('role_permission')));
    if (isLegacy) legacyPermissions.push(p);
  }

  // Build mapping replacements for legacy permissions:
  // - If a legacy permission code matches normalization map variant/target, we may map it.
  // - But your instruction says: do not create replacement permissions automatically.
  //   Replacement only comes from explicit normalization mapping (and only if canonical exists).
  const legacyPermissionIds = new Set(legacyPermissions.map(p => p.id));

  const codeReplacement = (code) => {
    // If code itself is a known variant, replace with canonical.
    if (NORMALIZATION_MAP.has(code)) return NORMALIZATION_MAP.get(code);
    return null;
  };

  // ----------------------------
  // Phase 5: Normalize inconsistent naming (variant -> canonical)
  // ----------------------------
  console.log('\n[6/8] Detecting inconsistent naming variants (normalization candidates)...');

  // Find permissions whose code is a variant we want to normalize
  const normalizationCandidates = [];
  for (const [variant, canonical] of NORMALIZATION_MAP.entries()) {
    const v = allPermissions.filter(p => p.code === variant);
    const c = allPermissions.filter(p => p.code === canonical);

    if (v.length > 0 && c.length > 0) {
      // We can safely map references from all variant permission IDs to canonical permission IDs.
      // If multiple canonical perms exist (duplicates) we will rely on duplicate canonicalization later.
      normalizationCandidates.push({
        variant,
        canonical,
        variantPermissionIds: v.map(x => x.id),
        canonicalPermissionIds: c.map(x => x.id),
      });
    }
  }

  // ----------------------------
  // Phase 6: Prepare migration plans (read-only)
  // ----------------------------
  console.log('\n[7/8] Preparing migration plan (compute what to update/delete)...');

  // Helper: migrate references permissionId -> canonicalPermissionId
  // Canonicalization order:
  // 1) Duplicate permissions: duplicates -> canonical chosen per group
  // 2) Normalization variants -> canonical codes (if canonical exists)
  // 3) Legacy permissions: if replacement mapping exists (by normalization code mapping), migrate.
  //    else delete account_permissions referencing legacy permission, then delete permissions.
  //
  // Implementation choice:
  // We'll build a global permissionIdReplacement map: oldPermissionId -> newPermissionId
  // BUT if the mapping is ambiguous/conflicting, we'll abort during plan.

  const permissionIdReplacement = new Map(); // oldId -> newId

  const planConflicts = [];

  // 6.1 duplicates permission canonicalization
  for (const grp of duplicatePermissionGroups) {
    const canonicalId = grp.canonical.id;
    for (const dup of grp.duplicates) {
      if (permissionIdReplacement.has(dup.id) && permissionIdReplacement.get(dup.id) !== canonicalId) {
        planConflicts.push({ type: 'duplicate-canonical-conflict', permissionId: dup.id, existing: permissionIdReplacement.get(dup.id), new: canonicalId });
      } else {
        permissionIdReplacement.set(dup.id, canonicalId);
      }
    }
  }

  // 6.2 normalization variants
  for (const cand of normalizationCandidates) {
    // canonical can have duplicates; if duplicates exist, duplicates will already map to canonical via step 6.1.
    // Choose a canonical target permissionId for all canonicalPermissionIds:
    // - prefer the canonical code's earliest createdAt permission
    const canonicalPerms = cand.canonicalPermissionIds.map(id => permissionsById.get(id)).filter(Boolean);
    canonicalPerms.sort((a, b) => (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) || String(a.id).localeCompare(String(b.id)));
    const canonicalTargetId = canonicalPerms[0].id;

    for (const variantId of cand.variantPermissionIds) {
      if (permissionIdReplacement.has(variantId) && permissionIdReplacement.get(variantId) !== canonicalTargetId) {
        planConflicts.push({ type: 'normalization-conflict', permissionId: variantId, existing: permissionIdReplacement.get(variantId), new: canonicalTargetId });
      } else {
        permissionIdReplacement.set(variantId, canonicalTargetId);
      }
    }
  }

  // 6.3 legacy permissions replacement if explicit normalization mapping can convert code
  // For each legacy permission, if its code is a normalization variant and canonical exists,
  // then migrate account_permissions references to canonical.
  const legacyAccountPermissionUpdates = [];
  const legacyAccountPermissionDeletes = [];
  const legacyPermissionsDeletes = [];

  for (const lp of legacyPermissions) {
    const replacementCode = codeReplacement(lp.code);
    if (replacementCode && permissionsByCode.has(replacementCode)) {
      const replacementPerms = allPermissions.filter(p => p.code === replacementCode);
      // choose earliest createdAt replacement permission id (canonical)
      replacementPerms.sort((a, b) => (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) || String(a.id).localeCompare(String(b.id)));
      const replacementId = replacementPerms[0].id;

      // Migrate if not already mapped via canonicalization
      if (permissionIdReplacement.has(lp.id) && permissionIdReplacement.get(lp.id) !== replacementId) {
        planConflicts.push({ type: 'legacy-replacement-conflict', permissionId: lp.id, existing: permissionIdReplacement.get(lp.id), new: replacementId });
      } else {
        permissionIdReplacement.set(lp.id, replacementId);
      }
    } else {
      // No replacement mapping exists => delete related account_permissions first, then delete permission records
      // We'll compute the account_permissions rows to delete later using permissionIdReplacement deletion logic.
      legacyPermissionsDeletes.push(lp.id);
    }
  }

  // Abort if conflicts
  if (planConflicts.length > 0) {
    console.error('\n[ABORT] Plan conflicts detected. No changes will be made.');
    console.error(planConflicts);
    return;
  }

  // Build delete lists:
  // - permissions duplicates: duplicates permissionIds
  const duplicatePermissionIdsToDelete = duplicatePermissionGroups.flatMap(g => g.duplicates.map(d => d.id));

  // - permissions variants that are mapped should be deleted only if they are duplicates? requirement says:
  //   "For duplicate permissions: keep canonical, delete duplicate permission records"
  //   For inconsistent naming normalization, we are mapping references from variant -> canonical.
  //   If the variant permissions still exist as separate records but share same code semantics, we should remove them.
  //   However schema doesn't treat code as unique if duplicates exist; we will delete all non-canonical permissions that are mapped via normalization.
  //   Safer: delete only if the variant permissionId is mapped AND that permissionId is not referenced after migration.
  //   We'll proceed conservatively: delete mapped variant permissions only if they are duplicates group members OR if their code matches a normalization variant.
  const normalizationVariantPermissionIdsToDelete = [];
  for (const [variant, canonical] of NORMALIZATION_MAP.entries()) {
    const vPerms = allPermissions.filter(p => p.code === variant);
    const cPerms = allPermissions.filter(p => p.code === canonical);
    if (vPerms.length > 0 && cPerms.length > 0) {
      for (const vp of vPerms) {
        // do not delete canonical (same id)
        if (permissionIdReplacement.get(vp.id)) normalizationVariantPermissionIdsToDelete.push(vp.id);
      }
    }
  }

  // - legacy permissions without replacement mapping
  const legacyPermissionIdsToDelete = legacyPermissionsDeletes;

  // remove duplicates from delete arrays
  const permissionIdsToDeleteSet = new Set([
    ...duplicatePermissionIdsToDelete,
    ...normalizationVariantPermissionIdsToDelete,
    ...legacyPermissionIdsToDelete,
  ]);

  // But never delete a permissionId that is the chosen canonical for its own code (i.e., has no replacement target).
  for (const [oldId, newId] of permissionIdReplacement.entries()) {
    // oldId should be deletable if it is mapped; newId should not be deletable
    permissionIdsToDeleteSet.delete(newId);
  }

  // Prepare account_permissions updates/deletes
  const accountPermissionIdToUpdate = [];
  const accountPermissionIdToDelete = new Set();

  // Orphans must be deleted in apply mode (safe)
  for (const ap of orphans) accountPermissionIdToDelete.add(ap.id);

  // For any account_permission referencing permissionId that we plan to replace, update permissionId.
  for (const ap of allAccountPermissions) {
    const replacement = permissionIdReplacement.get(ap.permissionId);
    if (replacement && replacement !== ap.permissionId) {
      // also avoid updating rows that are being deleted (orphans)
      if (!accountPermissionIdToDelete.has(ap.id)) {
        accountPermissionIdToUpdate.push({ id: ap.id, permissionId: replacement });
      }
    }
  }

  // Duplicate account_permissions removal: for each duplicate group remove rows in remove[]
  for (const grp of duplicateAccountPermissionGroups) {
    for (const ap of grp.remove) accountPermissionIdToDelete.add(ap.id);
  }

  // Legacy without replacement: any account_permission referencing those legacy permissions should be deleted.
  for (const ap of allAccountPermissions) {
    if (legacyPermissionIdsToDelete.includes(ap.permissionId)) {
      accountPermissionIdToDelete.add(ap.id);
    }
  }

  // ----------------------------
  // Phase 7: Frontend verification (menuConfig only for now)
  // ----------------------------
  console.log('\n[8/8] Verifying frontend permission codes against DB (from menuConfig.ts)...');

  // Import frontend menuConfig codes dynamically (simple approach: parse file for permission fields)
  // We'll do minimal parsing to avoid TS execution. Read file via fs.
  const fs = await import('fs');
  const path = await import('path');

  const menuConfigPath = path.resolve('frontend/src/shared/permissions/menuConfig.ts');
  const menuConfigText = fs.readFileSync(menuConfigPath, 'utf8');

  const codeRegex = /permission:\s*'([^']+)'/g;
  const frontendCodes = new Set();
  let m;
  while ((m = codeRegex.exec(menuConfigText))) {
    frontendCodes.add(m[1]);
  }

  const dbCodes = new Set(allPermissions.map(p => p.code));
  const missingFromDb = [...frontendCodes].filter(c => !dbCodes.has(c)).sort();

  const unusedInDb = [...dbCodes].filter(code => !frontendCodes.has(code) && !LEGACY_ROLE_CODES.has(code)).sort();

  // exact “frontend codes not found in DB” equals missingFromDb
  const frontendNotFoundInDb = missingFromDb;

  // report summary
  const report = {
    mode: MODE,
    counts: {
      totalPermissions: allPermissions.length,
      duplicatePermissionGroups: duplicatePermissionGroups.length,
      totalDuplicatePermissions: duplicatePermissionGroups.reduce((acc, g) => acc + g.duplicates.length, 0),
      totalAccountPermissions: allAccountPermissions.length,
      duplicateAccountPermissionGroups: duplicateAccountPermissionGroups.length,
      totalDuplicateAccountPermissionsToRemove: duplicateAccountPermissionGroups.reduce((acc, g) => acc + g.remove.length, 0),
      orphanAccountPermissions: orphans.length,
      legacyPermissionsFound: legacyPermissions.length,
      normalizationCandidates: normalizationCandidates.length,
      accountPermissionUpdatesPlanned: accountPermissionIdToUpdate.length,
      accountPermissionDeletesPlanned: accountPermissionIdToDelete.size,
      permissionsDeletesPlanned: permissionIdsToDeleteSet.size,
    },
    duplicatePermissionGroups: duplicatePermissionGroups.map(g => ({
      permissionCode: g.code,
      permissionName: g.name,
      module: g.module,
      permissionIds: [g.canonical.id, ...g.duplicates.map(d => d.id)],
      numberOfDuplicates: g.duplicates.length,
      accountsUsingEachPermission: null, // filled later in apply/dry-run for detailed report
      canonicalPermissionId: g.canonical.id,
    })),
    legacyPermissions: legacyPermissions.map(p => ({ id: p.id, code: p.code, name: p.name, module: p.module })),
    normalization: normalizationCandidates,
    orphanSamples: orphans.slice(0, 50).map(ap => ({ id: ap.id, accountId: ap.accountId, permissionId: ap.permissionId })),
    frontendVerification: {
      frontendCodes: [...frontendCodes].sort(),
      missingInDb: missingFromDb,
      unusedInDb: unusedInDb.slice(0, 2000), // cap report
      frontendNotFoundInDb,
    },
  };

  // Fill accounts using each permission for the duplicate permission groups.
  // Efficient way: count account_permissions grouped by permissionId.
  const apCounts = new Map(); // permissionId -> count
  for (const ap of allAccountPermissions) {
    if (!apCounts.has(ap.permissionId)) apCounts.set(ap.permissionId, 0);
    apCounts.set(ap.permissionId, apCounts.get(ap.permissionId) + 1);
  }
  report.duplicatePermissionGroups = report.duplicatePermissionGroups.map(g => {
    const ids = g.permissionIds;
    const accountsUsingEachPermission = ids.map(pid => ({
      permissionId: pid,
      accountsUsingThisPermission: apCounts.get(pid) || 0,
    }));
    return { ...g, accountsUsingEachPermission };
  });

  // Print report (read-only)
  console.log('\n===== CLEANUP REPORT (read-only plan) =====');
  console.log(JSON.stringify(report, null, 2));

  if (MODE === 'dry-run') {
    console.log('\nDRY-RUN completed. No changes were made.');
    return;
  }

  // ----------------------------
  // Apply mode: perform writes in transactions
  // ----------------------------
  console.log('\n=== APPLY MODE: Executing changes in a single transaction ===');

  await prisma.$transaction(async (tx) => {
    // (A) Update account_permissions.permissionId for replacements
    // Use individual updates (safe for simplicity)
    for (const upd of accountPermissionIdToUpdate) {
      await tx.accountPermission.update({
        where: { id: upd.id },
        data: { permissionId: upd.permissionId },
      });
    }

    // (B) Delete account_permission duplicates + orphans + legacy references
    if (accountPermissionIdToDelete.size > 0) {
      await tx.accountPermission.deleteMany({
        where: { id: { in: [...accountPermissionIdToDelete] } },
      });
    }

    // (C) Delete permissions duplicates/legacy/variant
    if (permissionIdsToDeleteSet.size > 0) {
      await tx.permission.deleteMany({
        where: { id: { in: [...permissionIdsToDeleteSet] } },
      });
    }
  });

  console.log('\nAPPLY completed.');

  // ----------------------------
  // Post-verify (final checks)
  // ----------------------------
  console.log('\n[Post-verify] Re-running validations...');

  const afterPermissions = await prisma.permission.findMany({
    select: { id: true, code: true, name: true, module: true, createdAt: true, deletedAt: true },
  });

  const afterAccountPermissions = await prisma.accountPermission.findMany({
    select: { id: true, accountId: true, permissionId: true, allowed: true },
  });

  const afterAccountsExisting = await prisma.account.findMany({
    where: { id: { in: [...new Set(afterAccountPermissions.map(ap => ap.accountId))] } },
    select: { id: true },
  });
  const afterPermissionsExisting = await prisma.permission.findMany({
    where: { id: { in: [...new Set(afterAccountPermissions.map(ap => ap.permissionId))] } },
    select: { id: true },
  });

  const afterExistingAccountIdSet = new Set(afterAccountsExisting.map(a => a.id));
  const afterExistingPermissionIdSet = new Set(afterPermissionsExisting.map(p => p.id));

  const orphansAfter = afterAccountPermissions.filter(ap => !afterExistingPermissionIdSet.has(ap.permissionId) || !afterExistingAccountIdSet.has(ap.accountId));
  const apAfterKey = new Map();
  for (const ap of afterAccountPermissions) {
    const k = `${ap.accountId}|||${ap.permissionId}`;
    apAfterKey.set(k, (apAfterKey.get(k) || 0) + 1);
  }
  const duplicateApAfter = [...apAfterKey.values()].filter(v => v > 1).length;

  const permAfterBuckets = new Map();
  const keyAfter = (p) => `${p.code}|||${p.name ?? ''}|||${p.module ?? ''}`;
  for (const p of afterPermissions) {
    const k = keyAfter(p);
    if (!permAfterBuckets.has(k)) permAfterBuckets.set(k, []);
    permAfterBuckets.get(k).push(p);
  }
  const duplicatePermAfterGroups = [...permAfterBuckets.values()].filter(v => v.length > 1).length;

  const legacyAfter = afterPermissions.filter(p =>
    LEGACY_ROLE_CODES.has(p.code) ||
    LEGACY_ROLE_MODULES.has(p.module) ||
    (typeof p.code === 'string' && p.code.startsWith('ROLE_')) ||
    (typeof p.module === 'string' && (p.module.includes('role_management') || p.module.includes('role_permission')))
  );

  console.log('\n===== POST-VERIFY SUMMARY =====');
  console.log(JSON.stringify({
    duplicatesPermissionsGroupsAfter: duplicatePermAfterGroups,
    duplicatesAccountPermissionsGroupsCountAfter: duplicateApAfter,
    orphansAfterCount: orphansAfter.length,
    legacyPermissionsAfterCount: legacyAfter.length,
  }, null, 2));

  console.log('\nFinal verification complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
