import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma/client.js';
import config from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { logAction, getClientIp } from '../../utils/auditLogger.js';
import { permissionService } from '../permissions/permission.service.js';

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

function getPermissionsByMachine(machine) {
  return getPermissionsByTemplate(machine.template);
}

export const posMachineService = {
  async _finalizeLogin(employee, machine, req) {
    const devicePermissions = getPermissionsByMachine(machine);

    // Quyen hieu luc = giao giua Role cua nhan vien va quyen theo loai may -
    // giong chinh sach da ap dung o devicePermissionService.getEffectivePermissions.
    // Nhan vien chua duoc gan Role -> giu nguyen quyen thuan theo may (backward compat).
    let permissions = devicePermissions;
    if (employee.roleId) {
      const rolePermissions = await permissionService.getRolePermissions(employee.roleId);
      permissions = devicePermissions.length > 0
        ? devicePermissions.filter((code) => rolePermissions.includes(code))
        : rolePermissions;
    }

    const module = getModuleByTemplate(machine.template);
    if (!module) throw new AppError('Template không hợp lệ', 403);

    await Promise.all([
      prisma.employee.update({
        where: { id: employee.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.pos_machines.update({
        where: { id: machine.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    await prisma.posMachineSession.create({
      data: { employeeId: employee.id, posMachineId: machine.id },
    });

    const token = jwt.sign(
      {
        sub: machine.id,
        type: 'device',
        machineId: machine.id,
        accountId: machine.accountId,
        template: machine.template,
        module,
        permissions,
        employeeId: employee.id,
        employeeName: employee.fullName,
      },
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
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
      },
      module,
      permissions,
    };

    logAction({
      accountId: machine.accountId,
      employeeId: employee.id,
      posDeviceId: machine.id,
      action: 'POS_EMPLOYEE_LOGIN',
      module: 'POS_MACHINE',
      details: { employeeId: employee.id, employeeCode: employee.employeeCode, machineId: machine.id, machineName: machine.name, template: machine.template },
      ipAddress: getClientIp(req),
    });
  },

  async loginWithPin({ machineId, pinCode }, req) {
    if (!machineId) throw new AppError('Vui lòng chọn máy POS', 400);
    if (!pinCode || pinCode.length !== 6) throw new AppError('Mã PIN phải có 6 chữ số', 400);

    const machine = await prisma.pos_machines.findFirst({
      where: { id: machineId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);
    if (machine.status === 'LOCKED') throw new AppError('Máy POS đã bị khóa', 403);

    const employees = await prisma.employee.findMany({
      where: { accountId: machine.accountId, deletedAt: null, status: 'ACTIVE' },
    });
    if (employees.length === 0) throw new AppError('Chưa có nhân viên nào được cấu hình', 404);

    let matchedEmployee = null;
    for (const emp of employees) {
      if (!emp.pinCode) continue;
      if (await bcrypt.compare(pinCode, emp.pinCode)) { matchedEmployee = emp; break; }
    }
    if (!matchedEmployee) throw new AppError('Mã PIN không hợp lệ', 401);

    const assignment = await prisma.employeePosMachine.findFirst({
      where: { employeeId: matchedEmployee.id, posMachineId: machine.id },
    });
    if (!assignment) throw new AppError('Bạn không được phép đăng nhập vào máy POS này', 403);

    return this._finalizeLogin(matchedEmployee, machine, req);
  },

  async loginByPin({ pinCode }, req) {
    if (!pinCode || pinCode.length !== 6) throw new AppError('Mã PIN phải có 6 chữ số', 400);

    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
    });

    let matchedEmployee = null;
    for (const emp of employees) {
      if (!emp.pinCode) continue;
      if (await bcrypt.compare(pinCode, emp.pinCode)) { matchedEmployee = emp; break; }
    }
    if (!matchedEmployee) throw new AppError('Mã PIN không hợp lệ', 401);

    const assigned = await prisma.employeePosMachine.findMany({
      where: { employeeId: matchedEmployee.id },
      include: { posMachine: true },
    });

    const machines = assigned
      .filter(a => a.posMachine.status === 'ACTIVE' && !a.posMachine.deletedAt)
      .map(a => a.posMachine);

    if (machines.length === 0) {
      throw new AppError('Nhân viên chưa được gán máy POS', 400);
    }

    if (machines.length === 1) {
      return this._finalizeLogin(matchedEmployee, machines[0], req);
    }

    return {
      requiresMachineSelection: true,
      employee: {
        id: matchedEmployee.id,
        fullName: matchedEmployee.fullName,
        employeeCode: matchedEmployee.employeeCode,
      },
      machines: machines.map(m => ({
        id: m.id,
        name: m.name,
        template: m.template,
        status: m.status,
      })),
    };
  },

  async createMachine(accountId, { name, template }, req) {
    console.log('[POS CREATE] Creating machine for account:', accountId);
    const existing = await prisma.account.findUnique({ where: { id: accountId } });
    if (!existing) throw new AppError('Tài khoản không tồn tại', 404);

    if (!name || !name.trim()) throw new AppError('Vui lòng nhập tên máy POS', 400);

    const machine = await prisma.pos_machines.create({
      data: {
        accountId,
        name: name.trim(),
        template: template || 'CASHIER',
        status: 'ACTIVE',
      },
    });

    return {
      id: machine.id,
      name: machine.name,
      template: machine.template,
      status: machine.status,
      createdAt: machine.createdAt,
    };
  },

  async listActiveMachines(accountId) {
    console.log("[POS] listActiveMachines - accountId:", accountId);

    const where = { deletedAt: null };
    if (accountId) where.accountId = accountId;

    console.log("[POS] listActiveMachines - WHERE:", JSON.stringify(where));

    const machines = await prisma.pos_machines.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    console.log("[POS] listActiveMachines - FOUND:", machines.length, "machines");
    if (machines.length === 0) {
      console.log("[POS] listActiveMachines - RAW DUMP:", await prisma.pos_machines.findMany({}));
    }

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

  async listMachines(accountId) {
    console.log("[POS] listMachines - accountId:", accountId);

    const machines = await prisma.pos_machines.findMany({
      where: { accountId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    console.log("[POS] listMachines - FOUND:", machines.length, "machines for accountId:", accountId);
    if (machines.length === 0) {
      console.log("[POS] listMachines - RAW DUMP:", await prisma.pos_machines.findMany({}));
    }

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

  async updateMachine(id, accountId, { name, template, status }, req) {
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

    const updated = await prisma.pos_machines.update({ where: { id }, data });

    return updated;
  },

  async resetPin(id, accountId, req) {
    const machine = await prisma.pos_machines.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!machine) throw new AppError('Không tìm thấy máy POS', 404);

    const employee = await prisma.employee.findFirst({
      where: { accountId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!employee) throw new AppError('Không tìm thấy nhân viên nào để đặt lại PIN', 404);

    const rawPin = generatePin();
    const hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { pinCode: hashedPin },
    });

    await prisma.activityLog.create({
      data: {
        accountId,
        action: 'EMPLOYEE_PIN_RESET',
        module: 'POS_MACHINE',
        details: { employeeId: employee.id, employeeCode: employee.employeeCode, machineId: id, name: machine.name },
        ipAddress: getClientIp(req),
      },
    });

    return { id, employeeId: employee.id, employeeCode: employee.employeeCode, pinCode: rawPin };
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
        accountId,
        action: 'POS_MACHINE_DELETED',
        module: 'POS_MACHINE',
        details: { machineId: id },
        ipAddress: getClientIp(req),
      },
    });
  },
};
