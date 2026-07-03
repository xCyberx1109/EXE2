import prisma from '../prisma/client.js';

export function logAction({ accountId, employeeId, action, module, details, ipAddress, userAgent }) {
  prisma.activityLog.create({
    data: {
      accountId: accountId || null,
      employeeId: employeeId || null,
      action,
      module,
      details: details || undefined,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  }).catch(err => {
    console.error('[AuditLogger] Failed to write log:', err);
  });
}

export function getClientIp(req) {
  return req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || null;
}
