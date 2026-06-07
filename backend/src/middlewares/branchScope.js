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
 *
 * @param {Object} resource - Resource từ database (phải có accountId)
 * @param {Object} user - req.user hoặc context
 * @param {string} [name='dữ liệu'] - Tên resource cho message lỗi
 */
export function assertBranchAccess(resource, user, name = 'dữ liệu') {
  if (!resource || !user) return;
  if (user.permissions?.includes('ADMIN_ALL')) return;
  const userAccountId = user.accountId || user.id;
  const resourceId = resource.branchId || resource.accountId;
  if (resourceId && userAccountId && resourceId !== userAccountId) {
    throw new AppError(`${name} này thuộc tài khoản khác`, 403);
  }
}

/**
 * Build Prisma where clause với account isolation.
 * Hỗ trợ cả user auth và device auth.
 *
 * @param {Object} user - req.user hoặc context
 * @param {Object} additionalWhere - Additional where conditions
 * @returns {Object} Where clause an toàn account
 */
export function buildBranchWhere(user, additionalWhere = {}, fieldName = 'branchId') {
  if (!user) return additionalWhere;
  if (user.permissions?.includes('ADMIN_ALL')) return additionalWhere;
  const id = user.accountId || user.id;
  if (!id) return additionalWhere;
  return { ...additionalWhere, [fieldName]: id };
}

/**
 * Trả về { accountId } cho create data, rỗng nếu là global admin.
 *
 * @param {Object} user - req.user
 * @returns {Object} { accountId } hoặc {}
 */
export function branchDataForCreate(user) {
  if (!user) return {};
  const accountId = user.accountId || user.id;
  if (!accountId) return {};
  if (user.permissions?.includes('ADMIN_ALL') && !user.accountId) return {};
  return { accountId };
}
