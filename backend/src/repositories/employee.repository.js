import prisma from '../prisma/client.js';

export const employeeRepository = {
  findById: (id) =>
    prisma.employee.findUnique({
      where: { id },
      include: { posMachines: true },
    }),

  findByIdWithAccount: (id) =>
    prisma.employee.findFirst({
      where: { id, deletedAt: null },
    }),

  findByAccountId: (accountId, { search, status, page, limit } = {}) => {
    const where = { accountId, deletedAt: null };
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (page && limit) {
      const skip = (page - 1) * limit;
      return Promise.all([
        prisma.employee.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.employee.count({ where }),
      ]);
    }
    return prisma.employee.findMany({ where, orderBy: { createdAt: 'desc' } });
  },

  findAssignedMachineIds: (employeeId) =>
    prisma.employeePosMachine.findMany({
      where: { employeeId },
      select: { posMachineId: true },
    }),

  create: (data) =>
    prisma.employee.create({ data }),

  update: (id, data) =>
    prisma.employee.update({ where: { id }, data }),

  softDelete: (id) =>
    prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),

  assignMachines: (employeeId, machineIds) =>
    prisma.$transaction(async (tx) => {
      await tx.employeePosMachine.deleteMany({ where: { employeeId } });
      if (machineIds.length > 0) {
        await tx.employeePosMachine.createMany({
          data: machineIds.map((posMachineId) => ({ employeeId, posMachineId })),
        });
      }
    }),
};
