import prisma from '../prisma/client.js';
import { permissionService } from '../modules/permissions/permission.service.js';

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

  await orm.accountPermission.createMany({
    data: permissionIds.map(permissionId => ({
      accountId,
      permissionId,
      allowed: true,
    })),
    skipDuplicates: true,
  });

  permissionService.invalidateCache(accountId);

  console.log(`[PlanPermission] Granted ${permissionIds.length} permissions for plan ${planCode} to account ${accountId}`, permissionIds);
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

  const planPermissionIds = new Set(featurePermissions.map((fp) => fp.permissionId));

  if (planPermissionIds.size === 0) {
    console.warn(`[PlanPermission] No permission IDs resolved for plan ${planCode} on account ${accountId} — skipping`);
    return;
  }

  await orm.accountPermission.createMany({
    data: Array.from(planPermissionIds).map(permissionId => ({
      accountId,
      permissionId,
      allowed: true,
    })),
    skipDuplicates: true,
  });

  permissionService.invalidateCache(accountId);

  console.log(`[PlanPermission] Granted ${planPermissionIds.size} permissions for plan ${planCode} on account ${accountId}`);
}
