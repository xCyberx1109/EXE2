import { AppError } from '../utils/AppError.js';

/**
 * Middleware: tự động inject branchId vào req.branchScope.
 * 
 * Hỗ trợ cả user auth (req.user) và device auth (req.posDevice).
 * 
 * - Có BRANCH_ALL_ACCESS → req.branchScope = { hasAccess: true, branchId: null }
 * - User thường → req.branchScope = { hasAccess: false, branchId: user.branchId }
 * - POS Device → req.branchScope = { hasAccess: false, branchId: posDevice.branchId }
 * 
 * Sử dụng ở route:
 *   router.use(enforceBranchScope);
 *   router.get('/', listHandler);
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

  const canAccessAll = ctx.permissions?.includes('BRANCH_ALL_ACCESS') || ctx.permissions?.includes('CROSS_BRANCH_ACCESS');
  const branchId = canAccessAll ? null : (ctx.branchId || req.branch?.id);

  req.branchScope = {
    hasAccess: !!canAccessAll,
    branchId,
  };

  next();
}

/**
 * Kiểm tra resource có thuộc branch của user không.
 * Ném 403 nếu không thuộc.
 *
 * @param {Object} resource - Resource từ database (phải có branchId)
 * @param {Object} user - req.user hoặc context
 * @param {string} [name='dữ liệu'] - Tên resource cho message lỗi
 */
export function assertBranchAccess(resource, user, name = 'dữ liệu') {
  if (!resource || !user) return;
  if (user.permissions?.includes('BRANCH_ALL_ACCESS')) return;
  if (user.permissions?.includes('CROSS_BRANCH_ACCESS')) return;
  const userBranchId = user.branchId || (user.branch?.id);
  if (resource.branchId && userBranchId && resource.branchId !== userBranchId) {
    console.error('[assertBranchAccess] Branch mismatch:', {
      resourceType: name,
      resourceId: resource.id,
      resourceBranchId: resource.branchId,
      userBranchId: userBranchId,
      userId: user.id,
      userRole: user.role,
      userPermissions: user.permissions,
    });
    throw new AppError(`${name} này thuộc chi nhánh khác`, 403);
  }
}

/**
 * Build Prisma where clause with branch isolation.
 * Hỗ trợ cả user auth và device auth.
 *
 * @param {Object} user - req.user hoặc context
 * @param {Object} additionalWhere - Additional where conditions
 * @returns {Object} Where clause an toàn branch
 */
export function buildBranchWhere(user, additionalWhere = {}) {
  if (!user) return additionalWhere;
  if (user.permissions?.includes('BRANCH_ALL_ACCESS')) return additionalWhere;
  if (user.permissions?.includes('CROSS_BRANCH_ACCESS')) return additionalWhere;
  const branchId = user.branchId || (user.branch?.id);
  if (!branchId) return additionalWhere;
  return { ...additionalWhere, branchId };
}

/**
 * Trả về { branchId } cho create data, rỗng nếu là global admin.
 *
 * @param {Object} user - req.user
 * @returns {Object} { branchId } hoặc {}
 */
export function branchDataForCreate(user) {
  if (!user) return {};
  const branchId = user.branchId || (user.branch?.id);
  if (!branchId) return {};
  if (user.permissions?.includes('BRANCH_ALL_ACCESS') && !user.branchId) return {};
  if (user.permissions?.includes('CROSS_BRANCH_ACCESS') && !user.branchId) return {};
  return { branchId };
}
