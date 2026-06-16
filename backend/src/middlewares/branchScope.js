import { AppError } from '../utils/AppError.js';

/**
 * Middleware: tự động inject accountId vào req.branchScope.
 * 
 * Hỗ trợ cả user auth (req.user) và device auth (req.posDevice).
 * Với user auth, accountId = user.id (mỗi account là một tenant riêng).
 * Với device auth, accountId = posDevice.accountId.
 * 
 * Sử dụng ở route:
 *   router.use(enforceBranchScope);
 * 
 * Trong service/repository:
 *   const where = buildBranchWhere(req.user, { ... });
 *   const data = { ...branchDataForCreate(req.user) };
 */
export function enforceBranchScope(req, _res, next) {
  const ctx = req.user || req.posDevice;
  if (!ctx) {
    return next(new AppError('Authentication required', 401));
  }

  const accountId = ctx.accountId || ctx.id;

  req.branchScope = {
    hasAccess: true,
    accountId,
  };

  next();
}

/**
 * Kiểm tra resource có thuộc account của user không.
 * Ném 403 nếu không thuộc.
 * KHÔNG có ADMIN_ALL bypass - mọi user đều bị kiểm tra.
 *
 * @param {Object} resource - Resource từ database (phải có accountId)
 * @param {Object} user - req.user hoặc context
 * @param {string} [name='dữ liệu'] - Tên resource cho message lỗi
 */
export function assertBranchAccess(resource, user, name = 'dữ liệu') {
  if (!resource || !user) return;
  const userAccountId = user.accountId || user.id;
  const resourceId = resource.branchId || resource.accountId;
  if (resourceId && userAccountId && resourceId !== userAccountId) {
    throw new AppError(`${name} này thuộc tài khoản khác`, 403);
  }
}

/**
 * Build Prisma where clause với account isolation.
 * KHÔNG có ADMIN_ALL bypass - mọi user đều bị scope vào account của họ.
 *
 * @param {Object} user - req.user hoặc context
 * @param {Object} additionalWhere - Additional where conditions
 * @param {string} fieldName - Tên field dùng để filter (mặc định 'accountId')
 * @returns {Object} Where clause an toàn account
 */
export function buildBranchWhere(user, additionalWhere = {}, fieldName = 'accountId') {
  if (!user) return additionalWhere;
  const id = user.accountId || user.id;
  if (!id) return additionalWhere;
  return { ...additionalWhere, [fieldName]: id };
}

/**
 * Trả về { accountId } cho create data.
 * KHÔNG có ADMIN_ALL bypass - mọi user đều được gán accountId.
 *
 * @param {Object} user - req.user
 * @returns {Object} { accountId }
 */
export function branchDataForCreate(user) {
  if (!user) return {};
  const accountId = user.accountId || user.id;
  if (!accountId) return {};
  return { accountId };
}
