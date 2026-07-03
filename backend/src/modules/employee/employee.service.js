import bcrypt from 'bcrypt';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { parsePagination, paginatedResponse } from '../../utils/pagination.js';
import { employeeRepository } from '../../repositories/employee.repository.js';
import { activityLogRepository } from '../../repositories/activityLog.repository.js';

const SALT_ROUNDS = 10;

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function mapEmployee(emp) {
  return {
    id: emp.id,
    accountId: emp.accountId,
    employeeCode: emp.employeeCode,
    fullName: emp.fullName,
    phone: emp.phone,
    email: emp.email,
    status: emp.status,
    lastLoginAt: emp.lastLoginAt,
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt,
  };
}

async function setEmployeePermissions(employeeId, permissionIds) {
  await prisma.employeePermission.deleteMany({ where: { employeeId } });
  if (permissionIds && permissionIds.length > 0) {
    await prisma.employeePermission.createMany({
      data: permissionIds.map(permissionId => ({
        employeeId,
        permissionId,
      })),
    });
  }
}

export const employeeService = {
  async loginByPin(pinCode) {
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    let matchedEmp = null;
    for (const emp of employees) {
      const valid = await bcrypt.compare(pinCode, emp.pinCode);
      if (valid) {
        matchedEmp = emp;
        break;
      }
    }

    if (!matchedEmp) throw new AppError('Mã PIN không đúng', 401);

    const permissions = matchedEmp.permissions.map(ep => ep.permission.code);
    return {
      employee: mapEmployee(matchedEmp),
      permissions,
    };
  },

  async updateLastLogin(id) {
    return prisma.employee.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  async list(accountId, { search, status, page, limit } = {}) {
    if (page && limit) {
      const { page: p, limit: l } = parsePagination({ page, limit });
      const [employees, total] = await employeeRepository.findByAccountId(accountId, { search, status, page: p, limit: l });
      return paginatedResponse(employees.map(mapEmployee), total, { page: p, limit: l });
    }
    const employees = await employeeRepository.findByAccountId(accountId, { search, status });
    return employees.map(mapEmployee);
  },

  async getById(id, accountId) {
    const emp = await prisma.employee.findFirst({
      where: { id, accountId, deletedAt: null },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });
    if (!emp) throw new AppError('Không tìm thấy nhân viên', 404);
    return {
      ...mapEmployee(emp),
      permissions: emp.permissions.map(ep => ep.permission.code),
      permissionIds: emp.permissions.map(ep => ep.permission.id),
    };
  },

  async create(accountId, { employeeCode, fullName, phone, email, pinCode: inputPin, status, permissionIds }, req) {
    const existing = await prisma.employee.findFirst({
      where: { accountId, employeeCode, deletedAt: null },
    });
    if (existing) throw new AppError(`Mã nhân viên "${employeeCode}" đã tồn tại`, 409);

    const rawPin = inputPin || generatePin();
    if (!/^\d{6}$/.test(rawPin)) {
      throw new AppError('Mã PIN phải có 6 chữ số', 400);
    }

    const hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);

    const emp = await prisma.employee.create({
      data: {
        accountId,
        employeeCode,
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        pinCode: hashedPin,
        status: status || 'ACTIVE',
      },
    });

    if (permissionIds && permissionIds.length > 0) {
      await setEmployeePermissions(emp.id, permissionIds);
    }

    return {
      employee: mapEmployee(emp),
      generatedPin: inputPin ? undefined : rawPin,
    };
  },

  async update(id, accountId, { employeeCode, fullName, phone, email, pinCode, status, permissionIds }, req) {
    const emp = await prisma.employee.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!emp) throw new AppError('Không tìm thấy nhân viên', 404);

    if (employeeCode && employeeCode !== emp.employeeCode) {
      const duplicate = await prisma.employee.findFirst({
        where: { accountId, employeeCode, deletedAt: null, id: { not: id } },
      });
      if (duplicate) throw new AppError(`Mã nhân viên "${employeeCode}" đã tồn tại`, 409);
    }

    const data = {};
    if (employeeCode !== undefined) data.employeeCode = employeeCode;
    if (fullName !== undefined) data.fullName = fullName.trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (status !== undefined) data.status = status;
    if (pinCode) {
      if (!/^\d{6}$/.test(pinCode)) throw new AppError('Mã PIN phải có 6 chữ số', 400);
      data.pinCode = await bcrypt.hash(pinCode, SALT_ROUNDS);
    }

    const updated = await employeeRepository.update(id, data);

    if (permissionIds !== undefined) {
      await setEmployeePermissions(id, permissionIds);
    }

    return mapEmployee(updated);
  },

  async resetPin(id, accountId) {
    const emp = await prisma.employee.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!emp) throw new AppError('Không tìm thấy nhân viên', 404);

    const rawPin = generatePin();
    const hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);
    await employeeRepository.update(id, { pinCode: hashedPin });

    return { employeeId: id, generatedPin: rawPin };
  },

  async getLogs(id, accountId, query = {}) {
    const emp = await prisma.employee.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!emp) throw new AppError('Không tìm thấy nhân viên', 404);

    const { page, limit } = parsePagination(query);
    const [logs, total] = await activityLogRepository.findByEmployee(id, {
      page,
      limit,
      action: query.action,
      module: query.module,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return paginatedResponse(logs, total, { page, limit });
  },

  async delete(id, accountId, req) {
    const emp = await prisma.employee.findFirst({
      where: { id, accountId, deletedAt: null },
    });
    if (!emp) throw new AppError('Không tìm thấy nhân viên', 404);

    await employeeRepository.softDelete(id);

    await prisma.activityLog.create({
      data: {
        accountId,
        employeeId: id,
        action: 'EMPLOYEE_DELETED',
        module: 'EMPLOYEE',
        details: { employeeId: id, employeeCode: emp.employeeCode },
        ipAddress: req?.headers['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip,
      },
    });
  },
};
