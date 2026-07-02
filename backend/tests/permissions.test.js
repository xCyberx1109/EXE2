import { jest } from '@jest/globals';
import { assertBranchAccess, buildBranchWhere, branchDataForCreate, enforceBranchScope } from '../src/middlewares/branchScope.js';
import { requirePermission, requireBranchAccess } from '../src/middlewares/auth.js';
import { AppError } from '../src/utils/AppError.js';

// ============================================================
// Helper to simulate req/res/next
// ============================================================
function mockReq(user) {
  return { user, params: {}, body: {}, headers: {} };
}

function mockRes() {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
}

function mockNext() {
  return jest.fn(() => {});
}

describe('Permission Logic', () => {

  // ==========================================================
  // 1. requirePermission — direct permission match, no bypass for any code
  // (ADMIN_ALL đã bị loại bỏ khỏi hệ thống — xem seed data / requirement #4.
  // "Toàn quyền" hiện nay được cấp bằng cách gán đủ từng permission cụ thể,
  // không qua một mã bypass đặc biệt nào.)
  // ==========================================================
  describe('Account Management (RBAC) — exact permission match', () => {
    const regularUser = {
      id: 'user-1',
      accountId: 'user-1',
      permissions: ['PERMISSION_VIEW'],
    };

    it('requirePermission denies regular user without the required permission', () => {
      const req = mockReq(regularUser);
      const res = mockRes();
      const next = mockNext();

      requirePermission('BRANCH_CREATE')(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it('requirePermission allows regular user with the required permission', () => {
      const req = mockReq(regularUser);
      const res = mockRes();
      const next = mockNext();

      requirePermission('PERMISSION_VIEW')(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('requirePermission returns 401 if no user', () => {
      const req = mockReq(null);
      const res = mockRes();
      const next = mockNext();

      requirePermission('PERMISSION_VIEW')(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });
  });

  // ==========================================================
  // 2. ADMIN_ALL does NOT bypass business module isolation
  // ==========================================================
  describe('Business Module Isolation — NO ADMIN_ALL bypass', () => {
    const adminAllUser = {
      id: 'admin-1',
      accountId: 'admin-1',
      permissions: ['ADMIN_ALL'],
    };
    const regularUser = {
      id: 'user-1',
      accountId: 'user-1',
      permissions: ['ORDER_VIEW'],
    };

    it('assertBranchAccess throws for ADMIN_ALL accessing another account data', () => {
      expect(() => {
        assertBranchAccess(
          { accountId: 'other-account' },
          adminAllUser,
          'đơn hàng'
        );
      }).toThrow(AppError);
    });

    it('assertBranchAccess passes for ADMIN_ALL accessing own account data', () => {
      expect(() => {
        assertBranchAccess(
          { accountId: 'admin-1' },
          adminAllUser,
          'đơn hàng'
        );
      }).not.toThrow();
    });

    it('assertBranchAccess throws for regular user accessing another account data', () => {
      expect(() => {
        assertBranchAccess(
          { accountId: 'other-account' },
          regularUser,
          'đơn hàng'
        );
      }).toThrow(AppError);
    });

    it('assertBranchAccess passes for regular user accessing own data', () => {
      expect(() => {
        assertBranchAccess(
          { accountId: 'user-1' },
          regularUser,
          'đơn hàng'
        );
      }).not.toThrow();
    });

    it('assertBranchAccess handles missing resource gracefully', () => {
      expect(() => {
        assertBranchAccess(null, adminAllUser, 'dữ liệu');
      }).not.toThrow();
    });

    it('buildBranchWhere filters by accountId for ADMIN_ALL user', () => {
      const where = buildBranchWhere(adminAllUser, {}, 'accountId');
      expect(where).toEqual({ accountId: 'admin-1' });
    });

    it('buildBranchWhere filters by accountId for regular user', () => {
      const where = buildBranchWhere(regularUser, {}, 'accountId');
      expect(where).toEqual({ accountId: 'user-1' });
    });

    it('buildBranchWhere merges additional where conditions', () => {
      const where = buildBranchWhere(adminAllUser, { status: 'ACTIVE' }, 'accountId');
      expect(where).toEqual({ accountId: 'admin-1', status: 'ACTIVE' });
    });

    it('buildBranchWhere returns additionalWhere only if no user', () => {
      const where = buildBranchWhere(null, { status: 'ACTIVE' }, 'accountId');
      expect(where).toEqual({ status: 'ACTIVE' });
    });

    it('branchDataForCreate sets accountId for ADMIN_ALL user', () => {
      const data = branchDataForCreate(adminAllUser);
      expect(data).toEqual({ accountId: 'admin-1' });
    });

    it('branchDataForCreate sets accountId for regular user', () => {
      const data = branchDataForCreate(regularUser);
      expect(data).toEqual({ accountId: 'user-1' });
    });

    it('branchDataForCreate returns empty object if no user', () => {
      const data = branchDataForCreate(null);
      expect(data).toEqual({});
    });
  });

  // ==========================================================
  // 3. Regular user isolation
  // ==========================================================
  describe('Regular User Isolation', () => {
    const user = {
      id: 'user-1',
      accountId: 'user-1',
      permissions: ['PERMISSION_VIEW', 'ORDER_VIEW'],
    };

    it('requirePermission allows user with specific permission', () => {
      const req = mockReq(user);
      const res = mockRes();
      const next = mockNext();

      requirePermission('ORDER_VIEW')(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('requirePermission denies user without specific permission', () => {
      const req = mockReq(user);
      const res = mockRes();
      const next = mockNext();

      requirePermission('BRANCH_CREATE')(req, res, next);
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it('buildBranchWhere correctly scopes to user accountId', () => {
      const where = buildBranchWhere(user, { deletedAt: null });
      expect(where).toEqual({ accountId: 'user-1', deletedAt: null });
    });

    it('assertBranchAccess prevents cross-account data access', () => {
      expect(() => {
        assertBranchAccess({ accountId: 'other-user' }, user, 'bàn');
      }).toThrow('bàn này thuộc tài khoản khác');
    });
  });

  // ==========================================================
  // 4. requireBranchAccess middleware
  // requireBranchAccess checks own accountId (no cross-account)
  // ==========================================================
  describe('requireBranchAccess middleware', () => {

    it('blocks regular user from accessing other account via params', () => {
      const req = mockReq({
        id: 'user-1',
        accountId: 'user-1',
        permissions: ['PERMISSION_VIEW'],
      });
      req.params.accountId = 'other-account';
      const res = mockRes();
      const next = mockNext();

      requireBranchAccess(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it('blocks regular user from accessing other account via body', () => {
      const req = mockReq({
        id: 'user-1',
        accountId: 'user-1',
        permissions: ['PERMISSION_VIEW'],
      });
      req.body.accountId = 'other-account';
      const res = mockRes();
      const next = mockNext();

      requireBranchAccess(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });

  // ==========================================================
  // 5. enforceBranchScope middleware
  // ==========================================================
  describe('enforceBranchScope middleware', () => {
    it('sets branchScope.accountId from user', () => {
      const req = mockReq({ id: 'user-1', accountId: 'user-1' });
      const res = mockRes();
      const next = mockNext();

      enforceBranchScope(req, res, next);
      expect(req.branchScope).toEqual({ hasAccess: true, accountId: 'user-1' });
      expect(next).toHaveBeenCalledWith();
    });

    it('sets branchScope.accountId from posDevice', () => {
      const req = { posDevice: { id: 'device-1', accountId: 'branch-1' }, user: undefined };
      const res = mockRes();
      const next = mockNext();

      enforceBranchScope(req, res, next);
      expect(req.branchScope).toEqual({ hasAccess: true, accountId: 'branch-1' });
      expect(next).toHaveBeenCalledWith();
    });

    it('returns 401 if no user or device', () => {
      const req = mockReq(null);
      const res = mockRes();
      const next = mockNext();

      enforceBranchScope(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });
  });
});
