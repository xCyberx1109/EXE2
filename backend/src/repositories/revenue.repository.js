import prisma from '../prisma/client.js';

export const revenueRepository = {
  findReports: (where = {}) =>
    prisma.revenueReport.findMany({
      where,
      orderBy: { reportDate: 'asc' },
    }),

  findByDate: (branchId, reportDate) =>
    prisma.revenueReport.findUnique({
      where: { branchId_reportDate: { branchId, reportDate } },
    }),

  upsert: (branchId, reportDate, data) =>
    prisma.revenueReport.upsert({
      where: { branchId_reportDate: { branchId, reportDate } },
      create: { branchId, reportDate, ...data },
      update: data,
    }),

  deleteAll: () => prisma.revenueReport.deleteMany(),
};
