import prisma from '../prisma/client.js';

const PLAN_CODE_MAP = {
  BASIC: 'basic',
  STANDARD: 'pro',
  PREMIUM: 'enterprise',
};

function normalizePlanCode(plan) {
  if (!plan) return 'basic';
  const upper = plan.toUpperCase();
  return PLAN_CODE_MAP[upper] || plan.toLowerCase();
}

export async function assignPlanPermissions(accountId, plan, tx) {
  const planCode = normalizePlanCode(plan);
  const orm = tx || prisma;

  const subscriptionPlan = await orm.subscriptionPlan.findUnique({
    where: { code: planCode },
    select: { id: true },
  });

  if (!subscriptionPlan) {
    console.warn(`[PlanPermission] Plan not found: ${planCode}`);
    return;
  }

  const planFeatures = await orm.subscriptionPlanFeature.findMany({
    where: { subscriptionPlanId: subscriptionPlan.id },
    select: { featureId: true },
  });

  if (planFeatures.length === 0) {
    console.warn(`[PlanPermission] No features for plan: ${planCode}`);
    return;
  }

  const featureIds = planFeatures.map((pf) => pf.featureId);

  const featurePermissions = await orm.featurePermission.findMany({
    where: { featureId: { in: featureIds } },
    select: { permissionId: true },
  });

  const permissionIds = [...new Set(featurePermissions.map((fp) => fp.permissionId))];

  if (permissionIds.length === 0) {
    console.warn(`[PlanPermission] No permissions found for plan: ${planCode}`);
    return;
  }

  for (const permissionId of permissionIds) {
    await orm.accountPermission.upsert({
      where: { accountId_permissionId: { accountId, permissionId } },
      update: { allowed: true },
      create: { accountId, permissionId, allowed: true },
    });
  }

  console.log(`[PlanPermission] Granted ${permissionIds.length} permissions for plan ${planCode} to account ${accountId}`);
}

export async function syncPlanPermissions(accountId, plan, tx) {
  const planCode = normalizePlanCode(plan);
  const orm = tx || prisma;

  const subscriptionPlan = await orm.subscriptionPlan.findUnique({
    where: { code: planCode },
    select: { id: true },
  });

  if (!subscriptionPlan) {
    console.warn(`[PlanPermission] Plan not found: ${planCode}`);
    return;
  }

  const planFeatures = await orm.subscriptionPlanFeature.findMany({
    where: { subscriptionPlanId: subscriptionPlan.id },
    select: { featureId: true },
  });

  const featureIds = planFeatures.map((pf) => pf.featureId);

  const featurePermissions = await orm.featurePermission.findMany({
    where: { featureId: { in: featureIds } },
    select: { permissionId: true },
  });

  const newPermissionIds = new Set(featurePermissions.map((fp) => fp.permissionId));

  const currentPermissions = await orm.accountPermission.findMany({
    where: { accountId },
    select: { permissionId: true, allowed: true },
  });

  for (const cp of currentPermissions) {
    if (!newPermissionIds.has(cp.permissionId)) {
      await orm.accountPermission.update({
        where: { accountId_permissionId: { accountId, permissionId: cp.permissionId } },
        data: { allowed: false },
      });
    }
  }

  for (const permissionId of newPermissionIds) {
    await orm.accountPermission.upsert({
      where: { accountId_permissionId: { accountId, permissionId } },
      update: { allowed: true },
      create: { accountId, permissionId, allowed: true },
    });
  }

  console.log(`[PlanPermission] Synced permissions for plan ${planCode} on account ${accountId} (${newPermissionIds.size} active)`);
}
