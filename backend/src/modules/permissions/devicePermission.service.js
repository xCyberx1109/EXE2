import prisma from '../../prisma/client.js';
import { permissionService } from './permission.service.js';
import {
  getPermissionsForDeviceType,
  getFeaturesForDeviceType,
  getEnabledFeaturesForDeviceType,
  hasPermission,
} from './devicePermissions.js';

export const devicePermissionService = {
  async getEffectivePermissions(device, employeeId) {
    const template = device.template || device.type;
    const hardcodedPerms = getPermissionsForDeviceType(template);
    const dbPerms = await prisma.deviceTypePermission.findMany({
      where: { deviceType: template, isRequired: true },
      include: { permission: true },
    });
    const dbCodes = dbPerms.map((dtp) => dtp.permission.code);
    const deviceCodes = [...new Set([...hardcodedPerms, ...dbCodes])];

    if (!employeeId) return deviceCodes;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { roleId: true },
    });

    // Nhan vien chua duoc gan Role -> giu hanh vi cu (quyen thuan theo thiet bi),
    // tranh regression cho du lieu chua migrate.
    if (!employee?.roleId) return deviceCodes;

    const rolePermissions = await permissionService.getRolePermissions(employee.roleId);

    // Quyen hieu luc = GIAO (Role ∩ Thiet bi). Chi so voi dbCodes (cung vung ma
    // Permission.code voi Role) - danh sach hardcode dung vung khac (order:create...)
    // nen khong tham gia phep giao co y nghia.
    // Neu tai khoan chua cau hinh DeviceTypePermission nao cho loai may nay (dbCodes rong),
    // coi nhu thiet bi khong gioi han them - tranh khoa het quyen ngoai y muon khi chua setup.
    if (dbCodes.length === 0) return rolePermissions;

    return dbCodes.filter((code) => rolePermissions.includes(code));
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

  async getDeviceCapabilities(device, employeeId) {
    const permissions = await this.getEffectivePermissions(device, employeeId);
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
