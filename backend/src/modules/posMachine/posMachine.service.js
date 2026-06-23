import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma/client.js';
import config from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';

const SALT_ROUNDS = 10;

/**
 * POS_TEMPLATE_PERMISSIONS - Hardcoded permission mapping per template.
 * No database dependency — permissions are derived entirely from template.
 * POS_TEMPLATE_MODULE - Module mapping (1 template = 1 module)
 */
export const POS_TEMPLATE_PERMISSIONS = {
  // ── CASHIER ─────────────────────────────────────────────────────────────
  // Mục tiêu: Tạo/cập nhật/hủy đơn, thanh toán, xem menu, xem khách hàng, xem bàn
  CASHIER: [
    'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE',
    'POS_CREATE_ORDER', 'POS_CANCEL_ORDER',
    'TABLE_VIEW', 'TABLE_UPDATE',
    'MENU_VIEW',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
    'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE',
    'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_DELETE',
    'POS_ORDER_QUEUE_PAY',
  ],

  // ── KITCHEN ─────────────────────────────────────────────────────────────
  // Mục tiêu: Chỉ xem đơn cần làm, cập nhật trạng thái chế biến, xem menu
  KITCHEN: [
    'ORDER_VIEW',
    'MENU_VIEW',
    'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_UPDATE',
  ],

  // ── CASHIER_KITCHEN ──────────────────────────────────────────────────────
  // Kết hợp toàn bộ quyền CASHIER + KITCHEN (union, deduped)
  CASHIER_KITCHEN: [
    'ORDER_VIEW', 'ORDER_CREATE', 'ORDER_UPDATE',
    'POS_CREATE_ORDER', 'POS_CANCEL_ORDER',
    'TABLE_VIEW', 'TABLE_UPDATE',
    'MENU_VIEW',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
    'POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_CREATE',
    'POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_DELETE',
    'POS_ORDER_QUEUE_PAY',
  ],

  // ── BILLIARD ─────────────────────────────────────────────────────────────
  // Mục tiêu: Xem bàn, chọn bàn, chơi ngay, kết thúc phiên, thanh toán, gọi đồ, in hóa đơn
  // Không được phép: Thêm/Sửa/Xóa bàn, Chỉnh sửa bố cục, Thay đổi giá giờ
  BILLIARD: [
    'BILLIARD_TABLE_VIEW',
    'BILLIARD_SESSION_VIEW',
    'BILLIARD_SESSION_START',
    'BILLIARD_SESSION_CHECKIN',
    'BILLIARD_SESSION_EXTEND',
    'BILLIARD_SESSION_FINISH',
    'BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_CREATE',
    'BILLIARD_ORDER_UPDATE', 'BILLIARD_ORDER_ADD_ITEM',
    'BILLIARD_PAY_VIEW', 'BILLIARD_PAY_PROCESS',
    'MENU_VIEW',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
    'INVENTORY_VIEW',
  ],

  // ── RESTAURANT ───────────────────────────────────────────────────────────
  // Mục tiêu: Xem/mở/quản lý bàn nhà hàng, gọi món, cập nhật, thanh toán
  RESTAURANT: [
    'RESTAURANT_TABLE_VIEW',
    'RESTAURANT_TABLE_CREATE',
    'RESTAURANT_TABLE_UPDATE',
    'RESTAURANT_TABLE_LAYOUT_EDIT',
    'RESTAURANT_TABLE_TRANSFER',
    'RESTAURANT_TABLE_MERGE',
    'RESTAURANT_TABLE_SPLIT',
    'RESTAURANT_ORDER_VIEW',
    'RESTAURANT_ORDER_CREATE',
    'RESTAURANT_ORDER_UPDATE',
    'RESTAURANT_ORDER_ADD_ITEM',
    'RESTAURANT_PAY_VIEW',
    'RESTAURANT_PAY_PROCESS',
    'MENU_VIEW',
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
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
  RESTAURANT: 'RESTAURANT_TABLE',
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

function getPermissionsByMachine(machine) {
  return getPermissionsByTemplate(machine.template);
}

export const posMachineService = {
  async loginWithPin({ pinCode }, req) {
    console.log('[POS_MACHINE_DEBUG] loginWithPin called, pinCode length:', pinCode?.length, 'req.ip:', getClientIp(req));
    if (!pinCode || pinCode.length !== 6) {
      throw new AppError('Mã PIN phải có 6 chữ số', 400);
    }

    try {
      console.log('[POS_MACHINE_DEBUG] Step 1: Querying machines...');
      const machines = await prisma.pos_machines.findMany({
        where: {
          deletedAt: null,
          status: { in: ['ACTIVE', 'LOCKED'] },
        },
      });
      console.log('[POS_MACHINE_DEBUG] Step 1 done, found', machines.length, 'machines');

      if (machines.length === 0) {
        throw new AppError('Chưa có máy POS nào được cấu hình', 404);
      }

      let machine = null;
      console.log('[POS_MACHINE_DEBUG] Step 2: Comparing PIN with', machines.length, 'machines...');
      for (const m of machines) {
        if (!m.pinCode) continue;
        const valid = await bcrypt.compare(pinCode, m.pinCode);
        if (valid) { machine = m; break; }
      }

      if (!machine) {
        throw new AppError('Mã PIN không hợp lệ', 401);
      }

      if (machine.status === 'LOCKED') {
        console.error('[DEVICE BLOCKED]', {
          machineId: machine.id,
          machine: machine,
          status: machine?.status
        });
        throw new AppError('Máy POS đã bị khóa', 403);
      }

      console.log('[POS_MACHINE_DEBUG] Step 2 done, matched machine:', machine.id, machine.name);

    console.log('[POS TEMPLATE]', machine.template);
    console.log('[CONFIG PERMISSIONS]', POS_TEMPLATE_PERMISSIONS[machine.template]);
    
    const permissions = getPermissionsByMachine(machine);
    console.log('[JWT PERMISSIONS]', permissions);
    
    const module = getModuleByTemplate(machine.template);
    if (!module) throw new AppError('Template không hợp lệ', 403);
    console.log('[POS_MACHINE_DEBUG] Step 3 done, module:', module, 'permissions count:', permissions.length);

    console.log('=== POS LOGIN ===');
    console.log('Machine:', JSON.stringify({ id: machine.id, name: machine.name, template: machine.template, status: machine.status, accountId: machine.accountId }, null, 2));
    console.log('Module:', module);
    console.log('Permissions (from template):', JSON.stringify(permissions));

    console.log('[POS_MACHINE_DEBUG] Step 5: Updating lastLoginAt...');
    await prisma.pos_machines.update({
      where: { id: machine.id },
      data: { lastLoginAt: new Date() },
    });
    console.log('[POS_MACHINE_DEBUG] Step 5 done');

    const jwtPayload = {
      sub: machine.id,
      type: 'device',
      machineId: machine.id,
      accountId: machine.accountId,
      template: machine.template,
      module,
      permissions,
    };
    console.log('[JWT PAYLOAD]', jwtPayload);
    console.log('=== JWT CREATED ===');
    console.log('JWT Payload:', JSON.stringify(jwtPayload, null, 2));

    console.log('[POS_MACHINE_DEBUG] Step 6: Signing JWT...');
    const token = jwt.sign(
      jwtPayload,
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn || '24h' },
    );
      console.log('[POS_MACHINE_DEBUG] Step 6 done, login SUCCESS');

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
    } catch (error) {
      console.error('[POS_MACHINE_DEBUG] Error in loginWithPin:', error);
      throw error;
    }
  },

  async createMachine(accountId, { name, template, pinCode }, req) {
    console.log('[POS CREATE] Creating machine for account:', accountId);
    const existing = await prisma.account.findUnique({ where: { id: accountId } });
    if (!existing) throw new AppError('Tài khoản không tồn tại', 404);

    if (!name || !name.trim()) throw new AppError('Vui lòng nhập tên máy POS', 400);

    const rawPin = pinCode && /^\d{6}$/.test(pinCode) ? pinCode : generatePin();
    const hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);

    const machine = await prisma.pos_machines.create({
      data: {
        accountId,
        name: name.trim(),
        template: template || 'CASHIER',
        pinCode: hashedPin,
        status: 'ACTIVE',
      },
    });

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
    const machines = await prisma.pos_machines.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return machines.map(m => ({
      id: m.id,
      name: m.name,
      template: m.template,
      status: m.status,
      lastLoginAt: m.lastLoginAt,
      createdAt: m.createdAt,
      permissionCount: getPermissionsByTemplate(m.template).length,
    }));
  },

  async getMachine(id, accountId) {
    const machine = await prisma.pos_machines.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);
    return {
      ...machine,
      permissions: getPermissionsByMachine(machine),
    };
  },

  async updateMachine(id, accountId, { name, template, pinCode, status }, req) {
    const machine = await prisma.pos_machines.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    const data = {};
    if (name && name.trim()) data.name = name.trim();
    if (template) data.template = template;
    if (status) {
      console.log('[POS STATUS CHANGE]', {
        deviceId: id,
        oldStatus: machine.status,
        newStatus: status,
        reason: 'MANUAL_UPDATE — cập nhật thủ công qua API updateMachine',
      });
      data.status = status;
    }
    if (pinCode) {
      if (!/^\d{6}$/.test(pinCode)) throw new AppError('Mã PIN phải là 6 chữ số', 400);
      data.pinCode = await bcrypt.hash(pinCode, SALT_ROUNDS);
    }

    const updated = await prisma.pos_machines.update({ where: { id }, data });

    return updated;
  },

  async resetPin(id, accountId, req) {
    const machine = await prisma.pos_machines.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    const rawPin = generatePin();
    const hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);

    await prisma.pos_machines.update({
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
    const machine = await prisma.pos_machines.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    const newStatus = machine.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';

    console.log('[POS STATUS CHANGE]', {
      deviceId: id,
      oldStatus: machine.status,
      newStatus,
      reason: 'MANUAL_TOGGLE_LOCK — hành động thủ công từ admin/người dùng',
    });

    const updated = await prisma.pos_machines.update({
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
    const machine = await prisma.pos_machines.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    await prisma.pos_machines.update({
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
};
