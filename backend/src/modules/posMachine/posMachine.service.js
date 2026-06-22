import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../prisma/client.js';
import config from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';

const SALT_ROUNDS = 10;

/**
 * POS_TEMPLATE_PERMISSIONS - Backward compatible permission mapping for existing UI
 * POS_TEMPLATE_MODULE - Module mapping (1 template = 1 module)
 */
export const POS_TEMPLATE_PERMISSIONS = {
  CASHIER: [
    'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE',
    'POS_CREATE_ORDER', 'POS_CANCEL_ORDER',
    'TABLE_VIEW', 'TABLE_UPDATE',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
  ],
  KITCHEN: [
    'ORDER_VIEW', 'MENU_VIEW',
    'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_UPDATE',
  ],
  CASHIER_KITCHEN: [
    'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE',
    'POS_CREATE_ORDER', 'POS_CANCEL_ORDER',
    'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_PAY',
    'TABLE_VIEW', 'TABLE_UPDATE',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
  ],
  BILLIARD: [
    'BILLIARD_TABLE_VIEW', 'BILLIARD_SESSION_VIEW',
    'BILLIARD_SESSION_START', 'BILLIARD_SESSION_CHECKIN',
    'BILLIARD_SESSION_EXTEND', 'BILLIARD_SESSION_FINISH',
    'BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_CREATE',
    'BILLIARD_ORDER_UPDATE', 'BILLIARD_ORDER_ADD_ITEM',
    'BILLIARD_PAY_VIEW', 'BILLIARD_PAY_PROCESS',
    'TABLE_VIEW', 'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
  ],
  CUSTOM: [],
};

export function getPermissionsByTemplate(template) {
  return POS_TEMPLATE_PERMISSIONS[template] || [];
}

export const POS_TEMPLATE_MODULE = {
  CASHIER: 'ORDER',
  CASHIER_KITCHEN: 'ORDER_DISPATCH',
  KITCHEN: 'ORDER_QUEUE',
  BILLIARD: 'BILLIARD',
};

export function getModuleByTemplate(template) {
  return POS_TEMPLATE_MODULE[template] || null;
}

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

export const posMachineService = {
  async getEffectivePermissions(machineId) {
    const machine = await prisma.posMachine.findUnique({
      where: { id: machineId },
      include: {
        permissions: { include: { permission: true } },
      },
    });
    if (!machine) {
      console.log('=== DB PERMISSIONS === Machine not found:', machineId);
      return [];
    }
    if (machine.template !== 'CUSTOM') {
      const perms = getPermissionsByTemplate(machine.template);
      console.log('=== DB PERMISSIONS (template) ===');
      console.log('Template:', machine.template);
      console.log('Permissions from POS_TEMPLATE_PERMISSIONS:', JSON.stringify(perms));
      console.log('Has INVENTORY_VIEW:', perms.includes('INVENTORY_VIEW'));
      return perms;
    }
    const dbPerms = machine.permissions
      .filter(p => p.permission)
      .map(p => p.permission.code);
    console.log('=== DB PERMISSIONS (CUSTOM from DB) ===');
    console.log('Machine ID:', machineId);
    console.log('DB permissions count:', machine.permissions.length);
    console.log('Permission codes:', JSON.stringify(dbPerms));
    console.log('Has INVENTORY_VIEW:', dbPerms.includes('INVENTORY_VIEW'));
    return dbPerms;
  },

  async loginWithPin({ pinCode }, req) {
    if (!pinCode || pinCode.length !== 6) {
      throw new AppError('Mã PIN phải có 6 chữ số', 400);
    }

    const machines = await prisma.posMachine.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
    });

    let machine = null;
    for (const m of machines) {
      const valid = await bcrypt.compare(pinCode, m.pinCode);
      if (valid) { machine = m; break; }
    }
    if (!machine) throw new AppError('Mã PIN không hợp lệ', 401);

    const permissions = await this.getEffectivePermissions(machine.id);
    const module = getModuleByTemplate(machine.template);
    if (!module) throw new AppError('Template không hợp lệ', 403);

    console.log('=== POS LOGIN ===');
    console.log('Machine:', JSON.stringify({ id: machine.id, name: machine.name, template: machine.template, status: machine.status, accountId: machine.accountId }, null, 2));
    console.log('Module:', module);
    console.log('Permissions from getEffectivePermissions:', JSON.stringify(permissions));
    console.log('Has INVENTORY_VIEW:', permissions.includes('INVENTORY_VIEW'));

    // So sánh với WEB user permissions (nếu có account)
    const webUserPerms = await prisma.accountPermission.findMany({
      where: { accountId: machine.accountId },
      include: { permission: true },
    });
    console.log('=== WEB USER (account) PERMISSIONS ===');
    console.log('Account ID:', machine.accountId);
    console.log('DB Permission codes:', JSON.stringify(webUserPerms.map(p => p.permission.code)));
    console.log('Has INVENTORY_VIEW in DB:', webUserPerms.some(p => p.permission.code === 'INVENTORY_VIEW'));

    await prisma.posMachine.update({
      where: { id: machine.id },
      data: { lastLoginAt: new Date() },
    });

    const jwtPayload = { sub: machine.id, type: 'pos_machine', accountId: machine.accountId, module, permissions };
    console.log('=== JWT CREATED ===');
    console.log('JWT Payload:', JSON.stringify(jwtPayload, null, 2));

    const token = jwt.sign(
      jwtPayload,
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn || '24h' },
    );

    return {
      token,
      machine: {
        id: machine.id,
        name: machine.name,
        template: machine.template,
        status: machine.status,
      },
      module,
      permissions,
    };
  },

  async createMachine(accountId, { name, template, pinCode }, req) {
    console.log('[POS CREATE] Creating machine for account:', accountId);
    const existing = await prisma.account.findUnique({ where: { id: accountId } });
    if (!existing) throw new AppError('Tài khoản không tồn tại', 404);

    if (!name || !name.trim()) throw new AppError('Vui lòng nhập tên máy POS', 400);

    const rawPin = pinCode && /^\d{6}$/.test(pinCode) ? pinCode : generatePin();
    const hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);

    const machine = await prisma.posMachine.create({
      data: {
        accountId,
        name: name.trim(),
        template: template || 'CASHIER',
        pinCode: hashedPin,
        status: 'ACTIVE',
      },
    });

    if (template === 'CUSTOM') {
      await prisma.activityLog.create({
        data: {
          branchId: accountId,
          accountId,
          action: 'POS_MACHINE_CREATED',
          module: 'POS_MACHINE',
          details: { machineId: machine.id, name, template },
          ipAddress: getClientIp(req),
        },
      });
    }

    return {
      id: machine.id,
      name: machine.name,
      template: machine.template,
      status: machine.status,
      pinCode: rawPin,
      createdAt: machine.createdAt,
    };
  },

  async listMachines(accountId) {
    const machines = await prisma.posMachine.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { permissions: true } },
      },
    });
    return machines.map(m => ({
      id: m.id,
      name: m.name,
      template: m.template,
      status: m.status,
      lastLoginAt: m.lastLoginAt,
      createdAt: m.createdAt,
      permissionCount: m._count.permissions,
    }));
  },

  async getMachine(id, accountId) {
    const machine = await prisma.posMachine.findFirst({
      where: { id, accountId, deletedAt: null },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);
    return machine;
  },

  async updateMachine(id, accountId, { name, template, pinCode, status }, req) {
    const machine = await prisma.posMachine.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    const data = {};
    if (name && name.trim()) data.name = name.trim();
    if (template) data.template = template;
    if (status) data.status = status;
    if (pinCode) {
      if (!/^\d{6}$/.test(pinCode)) throw new AppError('Mã PIN phải là 6 chữ số', 400);
      data.pinCode = await bcrypt.hash(pinCode, SALT_ROUNDS);
    }

    const updated = await prisma.posMachine.update({ where: { id }, data });

    if (template === 'CUSTOM') {
      await prisma.activityLog.create({
        data: {
          branchId: accountId,
          accountId,
          action: 'POS_MACHINE_UPDATED',
          module: 'POS_MACHINE',
          details: { machineId: id },
          ipAddress: getClientIp(req),
        },
      });
    }

    return updated;
  },

  async resetPin(id, accountId, req) {
    const machine = await prisma.posMachine.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    const rawPin = generatePin();
    const hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);

    await prisma.posMachine.update({
      where: { id },
      data: { pinCode: hashedPin },
    });

    await prisma.activityLog.create({
      data: {
        branchId: accountId,
        accountId,
        action: 'POS_MACHINE_PIN_RESET',
        module: 'POS_MACHINE',
        details: { machineId: id, name: machine.name },
        ipAddress: getClientIp(req),
      },
    });

    return { id, pinCode: rawPin };
  },

  async toggleLockMachine(id, accountId, req) {
    const machine = await prisma.posMachine.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    const newStatus = machine.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    const updated = await prisma.posMachine.update({
      where: { id },
      data: { status: newStatus },
    });

    await prisma.activityLog.create({
      data: {
        branchId: accountId,
        accountId,
        action: newStatus === 'ACTIVE' ? 'POS_MACHINE_UNLOCKED' : 'POS_MACHINE_LOCKED',
        module: 'POS_MACHINE',
        details: { machineId: id },
        ipAddress: getClientIp(req),
      },
    });

    return updated;
  },

  async deleteMachine(id, accountId, req) {
    const machine = await prisma.posMachine.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    await prisma.posMachine.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        branchId: accountId,
        accountId,
        action: 'POS_MACHINE_DELETED',
        module: 'POS_MACHINE',
        details: { machineId: id },
        ipAddress: getClientIp(req),
      },
    });
  },

  async updatePermissions(id, accountId, permissionIds, req) {
    const machine = await prisma.posMachine.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);
    if (machine.template !== 'CUSTOM') {
      throw new AppError('Chỉ máy POS template CUSTOM mới cho phép chọn permission', 400);
    }

    await prisma.posMachinePermission.deleteMany({ where: { posMachineId: id } });

    if (permissionIds && permissionIds.length > 0) {
      await prisma.posMachinePermission.createMany({
        data: permissionIds.map(permId => ({
          posMachineId: id,
          permissionId: permId,
        })),
      });
    }

    await prisma.activityLog.create({
      data: {
        branchId: accountId,
        accountId,
        action: 'POS_MACHINE_PERMISSIONS_UPDATED',
        module: 'POS_MACHINE',
        details: { machineId: id, permissionCount: permissionIds?.length || 0 },
        ipAddress: getClientIp(req),
      },
    });
  },
};
