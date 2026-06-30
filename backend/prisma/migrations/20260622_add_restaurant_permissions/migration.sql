-- ============================================================
-- Migration: Add RESTAURANT permission codes
-- These permissions are required by restaurant.routes.js and
-- billiard.routes.js but were missing from the permissions table.
-- ============================================================

INSERT INTO permissions (id, code, name, module, "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.*
FROM (VALUES
  ('RESTAURANT_TABLE_VIEW',     'Xem bàn nhà hàng',               'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_TABLE_CREATE',   'Tạo bàn nhà hàng',               'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_TABLE_UPDATE',   'Cập nhật bàn nhà hàng',          'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_TABLE_DELETE',   'Xóa bàn nhà hàng',               'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_TABLE_LAYOUT_EDIT', 'Chỉnh sửa sơ đồ bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_TABLE_TRANSFER', 'Chuyển bàn nhà hàng',            'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_TABLE_MERGE',    'Gộp bàn nhà hàng',               'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_TABLE_SPLIT',    'Tách bàn nhà hàng',              'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_ORDER_VIEW',     'Xem đơn nhà hàng',               'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_ORDER_CREATE',   'Tạo đơn nhà hàng',               'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_ORDER_UPDATE',   'Cập nhật đơn nhà hàng',          'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_ORDER_DELETE',   'Xóa đơn nhà hàng',               'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_ORDER_ADD_ITEM', 'Thêm món nhà hàng',              'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_PAY_VIEW',       'Xem thanh toán nhà hàng',        'restaurant', false, NOW(), NOW()),
  ('RESTAURANT_PAY_PROCESS',    'Thanh toán nhà hàng',            'restaurant', false, NOW(), NOW())
) AS v(code, name, module, isSystem, createdAt, updatedAt)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);

-- Also ensure MENU_VIEW exists (needed by CASHIER, KITCHEN, CASHIER_KITCHEN, BILLIARD, RESTAURANT)
INSERT INTO permissions (id, code, name, module, "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'MENU_VIEW', 'Xem thực đơn', 'menu', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = 'MENU_VIEW');
