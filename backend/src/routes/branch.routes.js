import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { sendMail } from '../utils/sendMail.js';
import bcrypt from 'bcrypt';
import { userRepository } from '../repositories/user.repository.js';
import { authenticate, requirePermission } from '../middlewares/auth.js';
import { enforceBranchScope } from '../middlewares/branchScope.js';

const router = Router();

// Tự động inject branch scope cho tất cả branch routes
router.use(authenticate);
router.use(enforceBranchScope);

/** Gán BRANCH_VIEW + BRANCH_UPDATE cho manager account */
async function assignBranchPermissions(accountId) {
  const perms = await prisma.permission.findMany({
    where: { code: { in: ['BRANCH_VIEW', 'BRANCH_UPDATE'] } },
    select: { id: true, code: true },
  });
  const permMap = perms.reduce((acc, p) => { acc[p.code] = p.id; return acc; }, {});
  for (const code of ['BRANCH_VIEW', 'BRANCH_UPDATE']) {
    if (!permMap[code]) continue;
    await prisma.accountPermission.upsert({
      where: { accountId_permissionId: { accountId, permissionId: permMap[code] } },
      update: { allowed: true },
      create: { accountId, permissionId: permMap[code], allowed: true },
    });
  }
}

/** Map DB branch -> frontend-friendly flat format (backward compatible) */
function formatBranch(branch) {
  const { subscriptions, accounts, ...data } = branch;
  const activeSub = subscriptions?.[0] ?? null;
  return {
    ...data,
    account: accounts?.[0] ?? null,
    plan: activeSub?.plan?.code?.toUpperCase() ?? null,
    subscriptionStatus: activeSub?.status ?? null,
    subscriptionStart: activeSub?.startDate ?? null,
    subscriptionEnd: activeSub?.endDate ?? null,
  };
}

/** Resolve subscription-plan by code (accepts upper/lower case) */
async function resolvePlan(planCode) {
  if (!planCode) return null;
  return prisma.subscriptionPlan.findUnique({
    where: { code: planCode.toLowerCase() },
  });
}

// Lấy danh sách chi nhánh (branches) từ database
router.get('/', requirePermission('BRANCH_VIEW'), asyncHandler(async (req, res) => {
  const permissions = req.user.permissions || [];
  const hasBranchAccess = permissions.includes('ADMIN_ALL') || permissions.some(p => p.startsWith('BRANCH_'));

  const where = hasBranchAccess ? {} : (req.user.branchId ? { id: req.user.branchId } : {});

  const branches = await prisma.branch.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      accounts: {
        orderBy: { grantedAt: 'asc' },
        take: 1,
      },
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
        orderBy: { startDate: 'desc' },
        take: 1,
        include: { plan: true },
      },
    },
  });

  sendSuccess(res, {
    message: 'Lấy danh sách chi nhánh thành công',
    data: branches.map(formatBranch),
  });
}));

router.post('/', requirePermission('BRANCH_CREATE'), asyncHandler(async (req, res) => {
  const {
    name,
    address,
    phone,
    plan: planCode,
    subscriptionStatus = 'ACTIVE',
    subscriptionStart,
    subscriptionEnd,
    active = true,
    email,
    fullName = '',
  } = req.body;

  if (!name || !address || !phone || !planCode || !subscriptionStart || !subscriptionEnd || !email) {
    return sendError(res, {
      statusCode: 400,
      message: 'Vui lòng nhập đầy đủ tên chi nhánh, địa chỉ, số điện thoại, email, gói và thời hạn đăng ký',
    });
  }

  const subscriptionPlan = await resolvePlan(planCode);
  if (!subscriptionPlan) {
    return sendError(res, {
      statusCode: 400,
      message: `Gói đăng ký "${planCode}" không hợp lệ`,
    });
  }

  // Tạo branch trước
  const branch = await prisma.branch.create({
    data: {
      name,
      address,
      phone,
      email,
      active: Boolean(active),
    },
  });

  // Tạo subscription gắn với branch
  const subscription = await prisma.subscription.create({
    data: {
      branchId: branch.id,
      planId: subscriptionPlan.id,
      status: subscriptionStatus,
      startDate: new Date(subscriptionStart),
      endDate: new Date(subscriptionEnd),
      autoRenew: true,
    },
    include: { plan: true },
  });

  // Sinh mật khẩu ngẫu nhiên
  const password = crypto.randomBytes(4).toString('hex');
  const hashedPassword = await bcrypt.hash(password, 10);

      // Tạo account cho branch
      const account = await userRepository.create({
        email,
        password: hashedPassword,
        fullName,
        branchId: branch.id,
      });

  // Gán quyền quản lý branch cho manager
  await assignBranchPermissions(account.id);

  const formattedBranch = formatBranch({ ...branch, subscriptions: [subscription], accounts: [account] });

  // Gửi email thông báo mật khẩu
  try {
    await sendMail({
      to: email,
      subject: 'Tài khoản quản lý chi nhánh mới',
      html: `<p>Xin chào,</p>
        <p>Chi nhánh <b>${name}</b> đã được tạo thành công.</p>
        <p>Tài khoản quản lý:</p>
        <ul>
          <li>Email: <b>${email}</b></li>
          <li>Mật khẩu: <b>${password}</b></li>
        </ul>
        <p>Vui lòng đăng nhập và đổi mật khẩu sau khi sử dụng lần đầu.</p>`,
    });
  } catch (err) {
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo chi nhánh thành công nhưng gửi email thất bại',
      data: formattedBranch,
    });
  }

  sendSuccess(res, {
    statusCode: 201,
    message: 'Tạo chi nhánh thành công, đã gửi email tài khoản quản lý',
    data: formattedBranch,
  });
}));

router.put('/:id', requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hasBranchAccess = req.user.permissions?.includes('ADMIN_ALL') || req.user.permissions?.some(p => p.startsWith('BRANCH_'));
  if (!hasBranchAccess && req.user.branchId && id !== req.user.branchId) {
    return sendError(res, { statusCode: 403, message: 'Bạn không có quyền cập nhật chi nhánh này' });
  }
  const {
    name,
    address,
    phone,
    plan: planCode,
    subscriptionStatus,
    subscriptionStart,
    subscriptionEnd,
    active,
    email,
    fullName = '',
  } = req.body;

  // Chỉ cập nhật các trường branch hợp lệ (không có subscription fields)
  const branchData = {};
  if (name !== undefined) branchData.name = name;
  if (address !== undefined) branchData.address = address;
  if (phone !== undefined) branchData.phone = phone;
  if (active !== undefined) branchData.active = Boolean(active);

  if (Object.keys(branchData).length > 0) {
    await prisma.branch.update({ where: { id }, data: branchData });
  }

  // Xử lý subscription changes riêng
  const hasSubChanges = planCode || subscriptionStatus || subscriptionStart || subscriptionEnd;
  if (hasSubChanges) {
    const existingSub = await prisma.subscription.findFirst({
      where: { branchId: id, status: { in: ['ACTIVE', 'TRIAL'] } },
      orderBy: { startDate: 'desc' },
    });

    const subData = {};
    if (planCode) {
      const plan = await resolvePlan(planCode);
      if (plan) subData.planId = plan.id;
    }
    if (subscriptionStatus) subData.status = subscriptionStatus;
    if (subscriptionStart) subData.startDate = new Date(subscriptionStart);
    if (subscriptionEnd) subData.endDate = new Date(subscriptionEnd);

    if (existingSub && Object.keys(subData).length > 0) {
      await prisma.subscription.update({ where: { id: existingSub.id }, data: subData });
    } else if (!existingSub && planCode && subscriptionStart && subscriptionEnd) {
      const plan = await resolvePlan(planCode);
      if (plan) {
        await prisma.subscription.create({
          data: {
            branchId: id,
            planId: plan.id,
            status: subscriptionStatus || 'ACTIVE',
            startDate: new Date(subscriptionStart),
            endDate: new Date(subscriptionEnd),
            autoRenew: true,
          },
        });
      }
    }
  }

  let account = null;
  // Cập nhật email hoặc tạo account nếu được gửi lên
  if (email) {
    const existingAccount = await prisma.account.findFirst({
      where: { branchId: id },
      orderBy: { grantedAt: 'asc' },
    });

    if (existingAccount) {
      account = await prisma.account.update({
        where: { id: existingAccount.id },
        data: { email, fullName: fullName || existingAccount.fullName },
      });
    } else {
      const password = crypto.randomBytes(4).toString('hex');
      const hashedPassword = await bcrypt.hash(password, 10);

      account = await userRepository.create({
        email,
        password: hashedPassword,
        fullName: fullName || '',
        branchId: id,
      });

      // Gán quyền quản lý branch cho account
      await assignBranchPermissions(account.id);

      try {
        await sendMail({
          to: email,
          subject: 'Tài khoản quản lý chi nhánh mới (Cập nhật)',
          html: `<p>Xin chào,</p>
            <p>Tài khoản quản lý cho chi nhánh <b>${branchData.name || ''}</b> đã được thiết lập.</p>
            <p>Thông tin đăng nhập:</p>
            <ul>
              <li>Email: <b>${email}</b></li>
              <li>Mật khẩu: <b>${password}</b></li>
            </ul>
            <p>Vui lòng đăng nhập và đổi mật khẩu sau khi sử dụng lần đầu.</p>`,
        });
      } catch (err) {
        console.error('Lỗi khi gửi email cập nhật account:', err);
      }
    }
  }

  // Lấy chi nhánh sau khi cập nhật kèm account + subscription
  const updatedBranch = await prisma.branch.findUnique({
    where: { id },
    include: {
      accounts: {
        orderBy: { grantedAt: 'asc' },
        take: 1,
      },
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
        orderBy: { startDate: 'desc' },
        take: 1,
        include: { plan: true },
      },
    },
  });

  sendSuccess(res, {
    message: 'Cập nhật chi nhánh thành công',
    data: formatBranch(updatedBranch),
  });
}));

router.put('/:id/reset-password', requirePermission('BRANCH_UPDATE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hasBranchAccess = req.user.permissions?.includes('ADMIN_ALL') || req.user.permissions?.some(p => p.startsWith('BRANCH_'));
  if (!hasBranchAccess && req.user.branchId && id !== req.user.branchId) {
    return sendError(res, { statusCode: 403, message: 'Bạn không có quyền đặt lại mật khẩu chi nhánh này' });
  }

  const branch = await prisma.branch.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!branch) {
    return sendError(res, {
      statusCode: 404,
      message: 'Không tìm thấy chi nhánh',
    });
  }

  const manager = await prisma.account.findFirst({
    where: {
      branchId: id,
    },
    orderBy: { grantedAt: 'asc' },
  });

  if (!manager) {
    return sendError(res, {
      statusCode: 404,
      message: 'Không tìm thấy tài khoản quản lý chi nhánh',
    });
  }

  // Auto-generate random new password
  const newPassword = crypto.randomBytes(4).toString('hex'); // 8 characters
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.account.update({
    where: { id: manager.id },
    data: { 
      password: hashedPassword,
      mustChangePassword: true,
    },
  });

  // Gửi email thông báo mật khẩu mới và yêu cầu đổi mật khẩu
  try {
    await sendMail({
      to: manager.email,
      subject: `Đặt lại mật khẩu cho quản lý chi nhánh ${branch.name}`,
      html: `<p>Xin chào <b>${manager.fullName || 'Quản lý'}</b>,</p>
        <p>Mật khẩu của bạn đã được đặt lại thành công.</p>
        <p>Thông tin đăng nhập mới:</p>
        <ul>
          <li>Email: <b>${manager.email}</b></li>
          <li>Mật khẩu mới: <b>${newPassword}</b></li>
        </ul>
        <p><b>Yêu cầu:</b> Vui lòng đăng nhập bằng mật khẩu mới này và thực hiện đổi mật khẩu ngay sau khi đăng nhập để đảm bảo bảo mật.</p>`,
    });
  } catch (err) {
    console.error('Lỗi gửi email reset password:', err);
    return sendError(res, {
      statusCode: 500,
      message: 'Đặt lại mật khẩu thành công nhưng gửi email thất bại. Vui lòng kiểm tra cấu hình SMTP.',
    });
  }

  sendSuccess(res, {
    message: `Đặt lại mật khẩu thành công cho branch "${branch.name}". Mật khẩu mới đã được gửi tới email ${manager.email}.`,
    data: {
      branchId: branch.id,
      branchName: branch.name,
      accountEmail: manager.email,
      accountFullName: manager.fullName,
    },
  });
}));

router.patch('/:id/lock', requirePermission('BRANCH_LOCK'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hasBranchAccess = req.user.permissions?.includes('ADMIN_ALL') || req.user.permissions?.some(p => p.startsWith('BRANCH_'));
  if (!hasBranchAccess && req.user.branchId && id !== req.user.branchId) {
    return sendError(res, { statusCode: 403, message: 'Bạn không có quyền khóa chi nhánh này' });
  }

  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true, name: true, active: true } });
  if (!branch) {
    return sendError(res, { statusCode: 404, message: 'Không tìm thấy chi nhánh' });
  }

  await prisma.branch.update({ where: { id }, data: { active: false } });

  sendSuccess(res, { message: `Đã khóa chi nhánh "${branch.name}"`, data: { id, active: false } });
}));

router.patch('/:id/unlock', requirePermission('BRANCH_UNLOCK'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hasBranchAccess = req.user.permissions?.includes('ADMIN_ALL') || req.user.permissions?.some(p => p.startsWith('BRANCH_'));
  if (!hasBranchAccess && req.user.branchId && id !== req.user.branchId) {
    return sendError(res, { statusCode: 403, message: 'Bạn không có quyền mở khóa chi nhánh này' });
  }

  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true, name: true, active: true } });
  if (!branch) {
    return sendError(res, { statusCode: 404, message: 'Không tìm thấy chi nhánh' });
  }

  await prisma.branch.update({ where: { id }, data: { active: true } });

  sendSuccess(res, { message: `Đã mở khóa chi nhánh "${branch.name}"`, data: { id, active: true } });
}));

/**
 * Safety check: branch có thể bị force delete không?
 * Trả về object { safe, reasons[] }
 */
async function checkForceDeleteSafety(branchId) {
  const reasons = [];

  const [pendingOrders, openShifts, activePosDevices, recentCustomers] = await Promise.all([
    prisma.order.count({ where: { branchId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } } }),
    prisma.shift.count({ where: { branchId, status: 'OPEN' } }),
    prisma.posDevice.count({ where: { branchId, active: true } }),
    prisma.customer.count({ where: { branchId } }),
  ]);

  if (pendingOrders > 0) reasons.push(`Còn ${pendingOrders} đơn hàng đang xử lý`);
  if (openShifts > 0) reasons.push(`Còn ${openShifts} ca POS đang mở`);
  if (activePosDevices > 0) reasons.push(`Còn ${activePosDevices} thiết bị POS đang hoạt động`);

  return { safe: reasons.length === 0, reasons };
}

/**
 * Xoá vĩnh viễn toàn bộ dữ liệu branch + relations
 * Chỉ dùng cho branch test / tạo nhầm / chưa go-live
 * Permission riêng: BRANCH_FORCE_DELETE
 */
router.delete('/:id/force', requirePermission('BRANCH_FORCE_DELETE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hasBranchAccess = req.user.permissions?.includes('ADMIN_ALL') || req.user.permissions?.some(p => p.startsWith('BRANCH_'));
  if (!hasBranchAccess && req.user.branchId && id !== req.user.branchId) {
    return sendError(res, { statusCode: 403, message: 'Bạn không có quyền xóa chi nhánh này' });
  }

  const branch = await prisma.branch.findUnique({
    where: { id },
    select: { id: true, name: true, active: true },
  });
  if (!branch) {
    return sendError(res, { statusCode: 404, message: 'Không tìm thấy chi nhánh' });
  }

  // Safety check: nếu branch đang active và còn dữ liệu hoạt động → cảnh báo
  const { safe, reasons } = await checkForceDeleteSafety(id);
  if (!safe) {
    return sendError(res, {
      statusCode: 400,
      message: `Không thể xoá chi nhánh "${branch.name}":\n- ${reasons.join('\n- ')}\n\nVui lòng khoá chi nhánh, đóng ca POS và huỷ đơn hàng trước.`,
    });
  }

  const stats = {};

  await prisma.$transaction(async (tx) => {
    // Level 1: Deepest dependents (no FK to other branch tables)
    stats.redeemedVouchers = await tx.redeemedVoucher.deleteMany({
      where: { OR: [{ order: { branchId: id } }, { customer: { branchId: id } }, { voucher: { branchId: id } }] },
    });

    // OrderItemModifier → OrderItem cascade
    stats.orderItemModifiers = await tx.orderItemModifier.deleteMany({
      where: { orderItem: { order: { branchId: id } } },
    }).catch(() => ({ count: 0 }));
    stats.orderItems = await tx.orderItem.deleteMany({
      where: { order: { branchId: id } },
    });
    stats.payments = await tx.payment.deleteMany({
      where: { order: { branchId: id } },
    });
    stats.kots = await tx.kot.deleteMany({ where: { branchId: id } });

    // MenuItemIngredient (Restrict from Ingredient → delete BEFORE Ingredient & MenuItem)
    stats.menuItemIngredients = await tx.menuItemIngredient.deleteMany({
      where: { OR: [{ menuItem: { branchId: id } }, { ingredient: { branchId: id } }] },
    });

    // MenuItemModifier (Cascade from MenuItem)
    stats.menuItemModifiers = await tx.menuItemModifier.deleteMany({
      where: { menuItem: { branchId: id } },
    });

    // Device-level
    stats.deviceSessions = await tx.deviceSession.deleteMany({
      where: { device: { branchId: id } },
    });
    stats.trustedDevices = await tx.trustedDevice.deleteMany({
      where: { device: { branchId: id } },
    });
    // Model may not exist in all Prisma versions → safe catch
    stats.deviceFeatureOverrides = await tx.deviceFeatureOverride?.deleteMany({
      where: { device: { branchId: id } },
    }).catch(() => ({ count: 0 })) ?? { count: 0 };

    // StaffSession (FK to Account, PosDevice, Shift)
    stats.staffSessions = await tx.staffSession.deleteMany({
      where: { OR: [{ account: { branchId: id } }, { device: { branchId: id } }, { shift: { branchId: id } }] },
    });

    // Inventory
    stats.stockAlerts = await tx.stockAlert.deleteMany({ where: { branchId: id } });
    stats.stockAudits = await tx.stockAudit.deleteMany({ where: { branchId: id } });
    stats.inventoryTransactions = await tx.inventoryTransaction.deleteMany({ where: { branchId: id } });

    // ActivityLog (FK to Branch, Account)
    stats.activityLogs = await tx.activityLog.deleteMany({ where: { branchId: id } });

    // AccountPermission (FK to Account)
    stats.accountPermissions = await tx.accountPermission.deleteMany({
      where: { account: { branchId: id } },
    });

    // BillingInvoice (FK to Subscription, no cascade)
    const subIds = (await tx.subscription.findMany({
      where: { branchId: id },
      select: { id: true },
    })).map(s => s.id);
    if (subIds.length > 0) {
      stats.billingInvoices = await tx.billingInvoice.deleteMany({
        where: { subscriptionId: { in: subIds } },
      });
    } else {
      stats.billingInvoices = { count: 0 };
    }

    // Branch-scoped entities
    // RevenueReport removed
    stats.vouchers = await tx.voucher.deleteMany({ where: { branchId: id } });
    stats.loyaltyPoints = await tx.loyaltyPoint.deleteMany({ where: { branchId: id } });

    // Core entities (FK to Branch + others, processed after children)
    stats.orders = await tx.order.deleteMany({ where: { branchId: id } });
    stats.shifts = await tx.shift.deleteMany({ where: { branchId: id } });
    stats.menuItems = await tx.menuItem.deleteMany({ where: { branchId: id } });
    stats.categories = await tx.category.deleteMany({ where: { branchId: id } });
    stats.ingredients = await tx.ingredient.deleteMany({ where: { branchId: id } });
    stats.customers = await tx.customer.deleteMany({ where: { branchId: id } });
    stats.posDevices = await tx.posDevice.deleteMany({ where: { branchId: id } });
    stats.accounts = await tx.account.deleteMany({ where: { branchId: id } });

    // Subscription + BranchFeature (Cascade from Branch — delete explicit)
    stats.subscriptions = await tx.subscription.deleteMany({ where: { branchId: id } });
    stats.branchFeatures = await tx.branchFeature.deleteMany({ where: { branchId: id } });

    // Final: Branch itself
    await tx.branch.delete({ where: { id } });
  });

  // Audit log
  await prisma.activityLog.create({
    data: {
      branchId: null,
      accountId: req.user.id,
      action: 'FORCE_DELETE_BRANCH',
      module: 'BRANCH',
      details: {
        branchId: id,
        branchName: branch.name,
        deletedBy: req.user.email,
        stats,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  sendSuccess(res, {
    message: `Đã xoá vĩnh viễn chi nhánh "${branch.name}"`,
    data: { branchName: branch.name, stats },
  });
}));

/** Xoá chi nhánh (basic) — dùng cho branch sạch, không có dữ liệu phức tạp */
router.delete('/:id', requirePermission('BRANCH_DELETE'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hasBranchAccess = req.user.permissions?.includes('ADMIN_ALL') || req.user.permissions?.some(p => p.startsWith('BRANCH_'));
  if (!hasBranchAccess && req.user.branchId && id !== req.user.branchId) {
    return sendError(res, { statusCode: 403, message: 'Bạn không có quyền xóa chi nhánh này' });
  }

  const branch = await prisma.branch.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!branch) {
    return sendError(res, { statusCode: 404, message: 'Không tìm thấy chi nhánh' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.redeemedVoucher.deleteMany({
      where: { OR: [{ order: { branchId: id } }, { customer: { branchId: id } }, { voucher: { branchId: id } }] },
    });
    await tx.billingInvoice.deleteMany({
      where: { subscription: { branchId: id } },
    });
    await tx.orderItem.deleteMany({ where: { order: { branchId: id } } });
    await tx.payment.deleteMany({ where: { order: { branchId: id } } });
    await tx.kot.deleteMany({ where: { branchId: id } });
    await tx.menuItemIngredient.deleteMany({
      where: { OR: [{ menuItem: { branchId: id } }, { ingredient: { branchId: id } }] },
    });
    await tx.order.deleteMany({ where: { branchId: id } });
    await tx.shift.deleteMany({ where: { branchId: id } });
    await tx.menuItem.deleteMany({ where: { branchId: id } });
    await tx.posDevice.deleteMany({ where: { branchId: id } });
    await tx.ingredient.deleteMany({ where: { branchId: id } });
    await tx.inventoryTransaction.deleteMany({ where: { branchId: id } });
    await tx.activityLog.deleteMany({ where: { branchId: id } });
    await tx.accountPermission.deleteMany({ where: { account: { branchId: id } } });
    await tx.account.deleteMany({ where: { branchId: id } });
    await tx.category.deleteMany({ where: { branchId: id } });
    await tx.customer.deleteMany({ where: { branchId: id } });
    await tx.voucher.deleteMany({ where: { branchId: id } });
    await tx.stockAlert.deleteMany({ where: { branchId: id } });
    await tx.stockAudit.deleteMany({ where: { branchId: id } });
    await tx.loyaltyPoint.deleteMany({ where: { branchId: id } });
    // RevenueReport removed
    await tx.subscription.deleteMany({ where: { branchId: id } });
    await tx.branchFeature.deleteMany({ where: { branchId: id } });
    await tx.branch.delete({ where: { id } });
  });

  sendSuccess(res, { message: `Đã xoá chi nhánh "${branch.name}"`, data: null });
}));

export default router;
