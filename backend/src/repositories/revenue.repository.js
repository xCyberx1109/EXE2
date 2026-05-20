import prisma from '../prisma/client.js';

export const revenueRepository = {
  findReports: (where = {}) =>
    prisma.revenueReport.findMany({
      where,
      orderBy: { reportDate: 'asc' },
    }),

  findByDate: (reportDate) =>
    prisma.revenueReport.findUnique({ where: { reportDate } }),

  upsert: (reportDate, data) =>
    prisma.revenueReport.upsert({
      where: { reportDate },
      create: { reportDate, ...data },
      update: data,
    }),

  deleteAll: () => prisma.revenueReport.deleteMany(),
};
