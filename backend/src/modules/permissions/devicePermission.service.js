import prisma from '../../prisma/client.js';
import {
  getPermissionsForDeviceType,
  getFeaturesForDeviceType,
  getEnabledFeaturesForDeviceType,
  hasPermission,
} from './devicePermissions.js';

export const devicePermissionService = {
  async getEffectivePermissions(device) {
    const template = device.template || device.type;
    const hardcodedPerms = getPermissionsForDeviceType(template);
    const dbPerms = await prisma.deviceTypePermission.findMany({
      where: { deviceType: template, isRequired: true },
      include: { permission: true },
    });
    const dbCodes = dbPerms.map((dtp) => dtp.permission.code);
    return [...new Set([...hardcodedPerms, ...dbCodes])];
  },

  async getEffectiveFeatures(device) {
    const template = device.template || device.type;
    const hardcodedFeatures = getFeaturesForDeviceType(template);
    const hardcodedEnabled = getEnabledFeaturesForDeviceType(template);

    const overrides = await prisma.deviceFeatureOverride.findMany({
      where: { deviceId: device.id },
      include: { feature: true },
    });

    for (const ov of overrides) {
      if (ov.enabled) {
        if (!hardcodedEnabled.includes(ov.feature.code)) {
          hardcodedEnabled.push(ov.feature.code);
        }
      } else {
        const idx = hardcodedEnabled.indexOf(ov.feature.code);
        if (idx !== -1) hardcodedEnabled.splice(idx, 1);
      }
    }

    return {
      modules: hardcodedFeatures.modules,
      routes: hardcodedFeatures.routes,
      hide: hardcodedFeatures.hide,
      enabledFeatures: hardcodedEnabled,
    };
  },

  async getDeviceCapabilities(device) {
    const permissions = await this.getEffectivePermissions(device);
    const features = await this.getEffectiveFeatures(device);
    return { permissions, features, enabledFeatures: features.enabledFeatures };
  },

  async checkDevicePermission(device, permission) {
    const perms = await this.getEffectivePermissions(device);
    return perms.includes(permission);
  },

  async logPermissionDenied(device, permission, req) {
    await prisma.activityLog.create({
      data: {
        branchId: device.accountId,
        posDeviceId: device.id,
        action: 'PERMISSION_DENIED',
        module: 'DEVICE_PERMISSION',
        details: {
          deviceType: device.template || device.type,
          permission,
          path: req.originalUrl,
          method: req.method,
        },
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      },
    });
  },
};
