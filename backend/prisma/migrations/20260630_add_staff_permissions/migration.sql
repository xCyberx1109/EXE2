-- Add STAFF module permissions for Employee POS management
-- All permissions belong to module 'staff'

INSERT INTO permissions (id, code, name, module, "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.*
FROM (VALUES
  -- Employee CRUD
  ('STAFF_VIEW',                'Xem danh sách nhân viên',           'staff', false, NOW(), NOW()),
  ('STAFF_CREATE',              'Thêm nhân viên mới',                'staff', false, NOW(), NOW()),
  ('STAFF_UPDATE',              'Cập nhật thông tin nhân viên',      'staff', false, NOW(), NOW()),
  ('STAFF_DELETE',              'Xóa nhân viên',                     'staff', false, NOW(), NOW()),
  ('STAFF_MANAGE',              'Quản lý toàn bộ nhân viên',         'staff', false, NOW(), NOW()),

  -- PIN & POS login
  ('STAFF_MANAGE_PIN',          'Quản lý mã PIN nhân viên',          'staff', false, NOW(), NOW()),
  ('STAFF_RESET_PIN',           'Đặt lại mã PIN nhân viên',          'staff', false, NOW(), NOW()),
  ('STAFF_VIEW_PIN',            'Xem mã PIN nhân viên (Admin)',      'staff', false, NOW(), NOW()),

  -- POS machine assignment
  ('STAFF_ASSIGN_POS_MACHINE',  'Gán máy POS cho nhân viên',         'staff', false, NOW(), NOW()),
  ('STAFF_REMOVE_POS_MACHINE',  'Gỡ máy POS khỏi nhân viên',        'staff', false, NOW(), NOW()),
  ('STAFF_VIEW_POS_MACHINE',    'Xem máy POS được gán',              'staff', false, NOW(), NOW()),

  -- Monitoring
  ('STAFF_VIEW_ACTIVITY',       'Xem hoạt động nhân viên',           'staff', false, NOW(), NOW()),
  ('STAFF_VIEW_LOGIN_HISTORY',  'Xem lịch sử đăng nhập POS',         'staff', false, NOW(), NOW()),
  ('STAFF_VIEW_PERFORMANCE',    'Xem hiệu suất nhân viên',           'staff', false, NOW(), NOW()),

  -- POS Session management
  ('STAFF_SESSION_VIEW',        'Xem phiên làm việc POS',            'staff', false, NOW(), NOW()),
  ('STAFF_SESSION_FORCE_LOGOUT','Buộc đăng xuất phiên POS',          'staff', false, NOW(), NOW())
) AS v(code, name, module, isSystem, createdAt, updatedAt)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);
