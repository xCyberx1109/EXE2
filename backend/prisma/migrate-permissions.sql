-- ============================================================================
-- PERMISSION MIGRATION: 87 → 83 permissions
-- ============================================================================
-- Chú thích:
--   Bảng "user_permissions" đã bị drop ở migration trước (cleanup_rbac_schema_drift).
--   Hệ thống hiện dùng "account_permissions" — đây là bảng mapping user ↔ permission.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BACKUP
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS "permissions_backup";
CREATE TABLE "permissions_backup" AS SELECT * FROM "permissions";

DROP TABLE IF EXISTS "account_permissions_backup";
CREATE TABLE "account_permissions_backup" AS SELECT * FROM "account_permissions";

DROP TABLE IF EXISTS "feature_permissions_backup";
CREATE TABLE "feature_permissions_backup" AS SELECT * FROM "feature_permissions";

DROP TABLE IF EXISTS "device_type_permissions_backup";
CREATE TABLE "device_type_permissions_backup" AS SELECT * FROM "device_type_permissions";

-- ============================================================================
-- 2. MAPPING TABLE (old_code → new_code)
-- ============================================================================
DROP TABLE IF EXISTS "permission_migrations";
CREATE TABLE "permission_migrations" (
    id          SERIAL PRIMARY KEY,
    old_code    VARCHAR(255) NOT NULL,
    new_code    VARCHAR(255) NOT NULL,
    mapping_type VARCHAR(50) DEFAULT '1:1',
    UNIQUE(old_code, new_code)
);

-- 2a. 1:1 mapping (same code)
INSERT INTO "permission_migrations" (old_code, new_code, mapping_type) VALUES
('ADMIN_ALL', 'ADMIN_ALL', '1:1'),
('DASHBOARD_VIEW', 'DASHBOARD_VIEW', '1:1'),
('ORDER_VIEW', 'ORDER_VIEW', '1:1'),
('ORDER_CREATE', 'ORDER_CREATE', '1:1'),
('ORDER_UPDATE', 'ORDER_UPDATE', '1:1'),
('ORDER_DELETE', 'ORDER_DELETE', '1:1'),
('ORDER_HISTORY_VIEW', 'ORDER_HISTORY_VIEW', '1:1'),
('MENU_VIEW', 'MENU_VIEW', '1:1'),
('MENU_CREATE', 'MENU_CREATE', '1:1'),
('MENU_UPDATE', 'MENU_UPDATE', '1:1'),
('MENU_DELETE', 'MENU_DELETE', '1:1'),
('CATEGORY_VIEW', 'CATEGORY_VIEW', '1:1'),
('CATEGORY_CREATE', 'CATEGORY_CREATE', '1:1'),
('CATEGORY_UPDATE', 'CATEGORY_UPDATE', '1:1'),
('CATEGORY_DELETE', 'CATEGORY_DELETE', '1:1'),
('INVENTORY_VIEW', 'INVENTORY_VIEW', '1:1'),
('INVENTORY_CREATE', 'INVENTORY_CREATE', '1:1'),
('INVENTORY_UPDATE', 'INVENTORY_UPDATE', '1:1'),
('INVENTORY_DELETE', 'INVENTORY_DELETE', '1:1'),
('INVENTORY_IMPORT', 'INVENTORY_IMPORT', '1:1'),
('INVENTORY_EXPORT', 'INVENTORY_EXPORT', '1:1'),
('INVENTORY_TRANSACTION_VIEW', 'INVENTORY_TRANSACTION_VIEW', '1:1'),
('TABLE_VIEW', 'TABLE_VIEW', '1:1'),
('TABLE_CREATE', 'TABLE_CREATE', '1:1'),
('TABLE_UPDATE', 'TABLE_UPDATE', '1:1'),
('TABLE_DELETE', 'TABLE_DELETE', '1:1'),
('TABLE_LAYOUT_EDIT', 'TABLE_LAYOUT_EDIT', '1:1'),
('BILLIARD_TABLE_VIEW', 'BILLIARD_TABLE_VIEW', '1:1'),
('BILLIARD_TABLE_CREATE', 'BILLIARD_TABLE_CREATE', '1:1'),
('BILLIARD_TABLE_UPDATE', 'BILLIARD_TABLE_UPDATE', '1:1'),
('BILLIARD_TABLE_DELETE', 'BILLIARD_TABLE_DELETE', '1:1'),
('BILLIARD_TABLE_LAYOUT_EDIT', 'BILLIARD_TABLE_LAYOUT_EDIT', '1:1'),
('BILLIARD_SESSION_VIEW', 'BILLIARD_SESSION_VIEW', '1:1'),
('BILLIARD_SESSION_START', 'BILLIARD_SESSION_START', '1:1'),
('BILLIARD_SESSION_EXTEND', 'BILLIARD_SESSION_EXTEND', '1:1'),
('BILLIARD_SESSION_FINISH', 'BILLIARD_SESSION_FINISH', '1:1'),
('BILLIARD_SESSION_CHECKIN', 'BILLIARD_SESSION_CHECKIN', '1:1'),
('BILLIARD_RESERVATION_VIEW', 'BILLIARD_RESERVATION_VIEW', '1:1'),
('BILLIARD_RESERVATION_CREATE', 'BILLIARD_RESERVATION_CREATE', '1:1'),
('BILLIARD_RESERVATION_CANCEL', 'BILLIARD_RESERVATION_CANCEL', '1:1'),
('BILLIARD_ORDER_VIEW', 'BILLIARD_ORDER_VIEW', '1:1'),
('BILLIARD_ORDER_CREATE', 'BILLIARD_ORDER_CREATE', '1:1'),
('BILLIARD_ORDER_UPDATE', 'BILLIARD_ORDER_UPDATE', '1:1'),
('BILLIARD_ORDER_DELETE', 'BILLIARD_ORDER_DELETE', '1:1'),
('BILLIARD_ORDER_ADD_ITEM', 'BILLIARD_ORDER_ADD_ITEM', '1:1'),
('BILLIARD_PAY_VIEW', 'BILLIARD_PAY_VIEW', '1:1'),
('BILLIARD_PAY_PROCESS', 'BILLIARD_PAY_PROCESS', '1:1'),
('BILLIARD_REPORT_VIEW', 'BILLIARD_REPORT_VIEW', '1:1'),
('REPORT_VIEW', 'REPORT_VIEW', '1:1'),
('REPORT_EXPORT', 'REPORT_EXPORT', '1:1'),
('BRANCH_VIEW', 'BRANCH_VIEW', '1:1'),
('BRANCH_CREATE', 'BRANCH_CREATE', '1:1'),
('BRANCH_UPDATE', 'BRANCH_UPDATE', '1:1'),
('BRANCH_DELETE', 'BRANCH_DELETE', '1:1'),
('BRANCH_LOCK', 'BRANCH_LOCK', '1:1'),
('BRANCH_UNLOCK', 'BRANCH_UNLOCK', '1:1'),
('BRANCH_FORCE_DELETE', 'BRANCH_FORCE_DELETE', '1:1'),
('POS_OPEN', 'POS_OPEN', '1:1'),
('POS_CLOSE', 'POS_CLOSE', '1:1'),
('POS_CREATE_ORDER', 'POS_CREATE_ORDER', '1:1'),
('POS_CANCEL_ORDER', 'POS_CANCEL_ORDER', '1:1'),
('POS_ORDER_QUEUE_VIEW', 'POS_ORDER_QUEUE_VIEW', '1:1'),
('POS_ORDER_QUEUE_CREATE', 'POS_ORDER_QUEUE_CREATE', '1:1'),
('POS_ORDER_QUEUE_UPDATE', 'POS_ORDER_QUEUE_UPDATE', '1:1'),
('POS_ORDER_QUEUE_DELETE', 'POS_ORDER_QUEUE_DELETE', '1:1'),
('POS_DEVICE_VIEW', 'POS_DEVICE_VIEW', '1:1'),
('POS_DEVICE_CREATE', 'POS_DEVICE_CREATE', '1:1'),
('POS_DEVICE_UPDATE', 'POS_DEVICE_UPDATE', '1:1'),
('POS_DEVICE_DELETE', 'POS_DEVICE_DELETE', '1:1'),
('SHIFT_VIEW', 'SHIFT_VIEW', '1:1'),
('SHIFT_CREATE', 'SHIFT_CREATE', '1:1'),
('SHIFT_UPDATE', 'SHIFT_UPDATE', '1:1'),
('SHIFT_CLOSE', 'SHIFT_CLOSE', '1:1'),
('CUSTOMER_VIEW', 'CUSTOMER_VIEW', '1:1'),
('CUSTOMER_CREATE', 'CUSTOMER_CREATE', '1:1'),
('CUSTOMER_UPDATE', 'CUSTOMER_UPDATE', '1:1'),
('CUSTOMER_DELETE', 'CUSTOMER_DELETE', '1:1'),
('PERMISSION_VIEW', 'PERMISSION_VIEW', '1:1'),
('PERMISSION_ASSIGN', 'PERMISSION_ASSIGN', '1:1'),
('PERMISSION_MANAGE', 'PERMISSION_MANAGE', '1:1'),
('SETTINGS_VIEW', 'SETTINGS_VIEW', '1:1'),
('SETTINGS_UPDATE', 'SETTINGS_UPDATE', '1:1');

-- 2b. Renamed 1:1 (old legacy code → new code)
INSERT INTO "permission_migrations" (old_code, new_code, mapping_type) VALUES
('BILLIARD_TABLE_PLAY_NOW', 'BILLIARD_SESSION_START', 'rename'),
('BILLIARD_TABLE_RESERVE', 'BILLIARD_RESERVATION_CREATE', 'rename'),
('BILLIARD_TABLE_CHECKIN', 'BILLIARD_SESSION_CHECKIN', 'rename'),
('POS_ORDER_QUEUE_PAYMENT', 'POS_ORDER_QUEUE_PAY', 'rename');

-- 2c. MANAGE → CRUD split (1:N expansion)
INSERT INTO "permission_migrations" (old_code, new_code, mapping_type) VALUES
('ORDER_MANAGE', 'ORDER_CREATE', '1:N-expand'),
('ORDER_MANAGE', 'ORDER_UPDATE', '1:N-expand'),
('ORDER_MANAGE', 'ORDER_DELETE', '1:N-expand'),
('MENU_MANAGE', 'MENU_CREATE', '1:N-expand'),
('INVENTORY_MANAGE', 'INVENTORY_CREATE', '1:N-expand'),
('INVENTORY_MANAGE', 'INVENTORY_UPDATE', '1:N-expand'),
('INVENTORY_MANAGE', 'INVENTORY_DELETE', '1:N-expand'),
('BRANCH_MANAGE', 'BRANCH_CREATE', '1:N-expand'),
('BRANCH_MANAGE', 'BRANCH_UPDATE', '1:N-expand'),
('BRANCH_MANAGE', 'BRANCH_DELETE', '1:N-expand'),
('CUSTOMER_MANAGE', 'CUSTOMER_CREATE', '1:N-expand'),
('CUSTOMER_MANAGE', 'CUSTOMER_UPDATE', '1:N-expand'),
('CUSTOMER_MANAGE', 'CUSTOMER_DELETE', '1:N-expand'),
('SHIFT_MANAGE', 'SHIFT_CREATE', '1:N-expand'),
('SHIFT_MANAGE', 'SHIFT_UPDATE', '1:N-expand'),
('SHIFT_MANAGE', 'SHIFT_CLOSE', '1:N-expand'),
('SETTINGS_MANAGE', 'SETTINGS_VIEW', '1:N-expand'),
('SETTINGS_MANAGE', 'SETTINGS_UPDATE', '1:N-expand'),
('MANAGE_POS_DEVICES', 'POS_DEVICE_VIEW', '1:N-expand'),
('MANAGE_POS_DEVICES', 'POS_DEVICE_CREATE', '1:N-expand'),
('MANAGE_POS_DEVICES', 'POS_DEVICE_UPDATE', '1:N-expand'),
('MANAGE_POS_DEVICES', 'POS_DEVICE_DELETE', '1:N-expand');

-- 2d. F&B Table → Billiard expansion (cross-module)
INSERT INTO "permission_migrations" (old_code, new_code, mapping_type) VALUES
('TABLE_VIEW', 'BILLIARD_TABLE_VIEW', 'cross-expand'),
('TABLE_CREATE', 'BILLIARD_TABLE_CREATE', 'cross-expand'),
('TABLE_UPDATE', 'BILLIARD_TABLE_UPDATE', 'cross-expand'),
('TABLE_DELETE', 'BILLIARD_TABLE_DELETE', 'cross-expand'),
('TABLE_LAYOUT_EDIT', 'BILLIARD_TABLE_LAYOUT_EDIT', 'cross-expand');

-- ============================================================================
-- 3. LOG UNMAPPED (permissions that exist in DB but have no mapping rule)
-- ============================================================================
DROP TABLE IF EXISTS "permission_migration_missing";
CREATE TABLE "permission_migration_missing" (
    id SERIAL PRIMARY KEY,
    old_code VARCHAR(255) NOT NULL,
    old_name VARCHAR(255),
    old_module VARCHAR(255),
    affected_users INTEGER DEFAULT 0,
    reason TEXT DEFAULT 'No mapping rule found',
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO "permission_migration_missing" (old_code, old_name, old_module, affected_users)
SELECT
    p.code,
    p.name,
    p.module,
    COUNT(DISTINCT ap."accountId")::INTEGER
FROM "permissions_backup" p
LEFT JOIN "account_permissions_backup" ap ON ap."permissionId" = p.id AND ap."allowed" = true
LEFT JOIN "permission_migrations" pm ON pm.old_code = p.code
WHERE pm.old_code IS NULL
GROUP BY p.code, p.name, p.module;

-- ============================================================================
-- 4. DELETE OLD PERMISSIONS (CASCADE removes old account_permissions, feature_permissions, device_type_permissions)
-- ============================================================================
DELETE FROM "permissions";

-- ============================================================================
-- 5. INSERT 83 NEW PERMISSIONS
-- ============================================================================
INSERT INTO "permissions" ("id", "code", "name", "module", "isSystem", "createdAt", "updatedAt") VALUES

-- ADMIN (1)
(gen_random_uuid()::text, 'ADMIN_ALL', 'Toàn quyền hệ thống', 'admin', true, NOW(), NOW()),

-- BILLIARD (21)
(gen_random_uuid()::text, 'BILLIARD_TABLE_VIEW', 'Xem bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_CREATE', 'Tạo bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_UPDATE', 'Cập nhật bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_DELETE', 'Xóa bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_LAYOUT_EDIT', 'Chỉnh sửa sơ đồ bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_VIEW', 'Xem phiên chơi', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_START', 'Bắt đầu phiên chơi', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_EXTEND', 'Gia hạn phiên chơi', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_FINISH', 'Kết thúc phiên chơi', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_CHECKIN', 'Check-in bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_RESERVATION_VIEW', 'Xem đặt bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_RESERVATION_CREATE', 'Tạo đặt bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_RESERVATION_CANCEL', 'Hủy đặt bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_VIEW', 'Xem đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_CREATE', 'Tạo đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_UPDATE', 'Cập nhật đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_DELETE', 'Xóa đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_ADD_ITEM', 'Thêm món Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_PAY_VIEW', 'Xem thanh toán Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_PAY_PROCESS', 'Thanh toán Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_REPORT_VIEW', 'Xem báo cáo Billiard', 'billiard', false, NOW(), NOW()),

-- BRANCH (7)
(gen_random_uuid()::text, 'BRANCH_VIEW', 'Xem chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_CREATE', 'Tạo chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_UPDATE', 'Cập nhật chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_DELETE', 'Xóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_LOCK', 'Khóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_UNLOCK', 'Mở khóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_FORCE_DELETE', 'Xóa vĩnh viễn chi nhánh', 'branch', false, NOW(), NOW()),

-- CUSTOMER (4)
(gen_random_uuid()::text, 'CUSTOMER_VIEW', 'Xem khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_CREATE', 'Thêm khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_UPDATE', 'Cập nhật khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_DELETE', 'Xóa khách hàng', 'customer', false, NOW(), NOW()),

-- DASHBOARD (1)
(gen_random_uuid()::text, 'DASHBOARD_VIEW', 'Xem dashboard', 'dashboard', false, NOW(), NOW()),

-- INVENTORY (7)
(gen_random_uuid()::text, 'INVENTORY_VIEW', 'Xem tồn kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_CREATE', 'Tạo nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_UPDATE', 'Cập nhật nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_DELETE', 'Xóa nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_IMPORT', 'Nhập kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_EXPORT', 'Xuất kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_TRANSACTION_VIEW', 'Xem lịch sử xuất nhập kho', 'inventory', false, NOW(), NOW()),

-- MENU (4)
(gen_random_uuid()::text, 'MENU_VIEW', 'Xem thực đơn', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_CREATE', 'Thêm món', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_UPDATE', 'Cập nhật món', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_DELETE', 'Xóa món', 'menu', false, NOW(), NOW()),

-- ORDER (5)
(gen_random_uuid()::text, 'ORDER_VIEW', 'Xem đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_CREATE', 'Tạo đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_UPDATE', 'Cập nhật đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_DELETE', 'Xóa đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_HISTORY_VIEW', 'Xem lịch sử đơn hàng', 'orders', false, NOW(), NOW()),

-- POS (4)
(gen_random_uuid()::text, 'POS_OPEN', 'Mở ca POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CLOSE', 'Đóng ca POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CREATE_ORDER', 'Tạo đơn hàng POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CANCEL_ORDER', 'Hủy đơn hàng POS', 'pos', false, NOW(), NOW()),

-- POS_DEVICE (4)
(gen_random_uuid()::text, 'POS_DEVICE_VIEW', 'Xem thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_CREATE', 'Tạo thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_UPDATE', 'Cập nhật thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_DELETE', 'Xóa thiết bị POS', 'pos_device', false, NOW(), NOW()),

-- POS_ORDER_QUEUE (5)
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_VIEW', 'Xem Order Queue POS', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_CREATE', 'Tạo Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_UPDATE', 'Cập nhật Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_DELETE', 'Hủy Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_PAY', 'Thanh toán Order Queue', 'pos_order_queue', false, NOW(), NOW()),

-- REPORT (2)
(gen_random_uuid()::text, 'REPORT_VIEW', 'Xem báo cáo', 'reports', false, NOW(), NOW()),
(gen_random_uuid()::text, 'REPORT_EXPORT', 'Xuất báo cáo', 'reports', false, NOW(), NOW()),

-- SETTINGS (2)
(gen_random_uuid()::text, 'SETTINGS_VIEW', 'Xem cài đặt', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SETTINGS_UPDATE', 'Cập nhật cài đặt', 'settings', false, NOW(), NOW()),

-- PERMISSION (3)
(gen_random_uuid()::text, 'PERMISSION_VIEW', 'Xem quyền', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'PERMISSION_ASSIGN', 'Phân quyền', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'PERMISSION_MANAGE', 'Quản lý quyền hệ thống', 'settings', false, NOW(), NOW()),

-- SHIFT (4)
(gen_random_uuid()::text, 'SHIFT_VIEW', 'Xem ca làm việc', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_CREATE', 'Tạo ca', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_UPDATE', 'Cập nhật ca', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_CLOSE', 'Đóng ca', 'shift', false, NOW(), NOW()),

-- TABLE (5)
(gen_random_uuid()::text, 'TABLE_VIEW', 'Xem bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_CREATE', 'Tạo bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_UPDATE', 'Cập nhật bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_DELETE', 'Xóa bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_LAYOUT_EDIT', 'Chỉnh sửa sơ đồ bàn', 'table', false, NOW(), NOW());

-- ============================================================================
-- 6. BUILD ID MAPPING (old backup permission ID → new permission ID)
-- ============================================================================
DROP TABLE IF EXISTS "perm_id_migration";
CREATE TABLE "perm_id_migration" AS
SELECT
    p_old.id      AS old_permission_id,
    p_new.id      AS new_permission_id,
    pm.old_code,
    pm.new_code,
    pm.mapping_type
FROM "permission_migrations" pm
JOIN "permissions_backup" p_old ON p_old.code = pm.old_code
JOIN "permissions"        p_new ON p_new.code = pm.new_code;

CREATE INDEX idx_pim_old ON "perm_id_migration" (old_permission_id);
CREATE INDEX idx_pim_new ON "perm_id_migration" (new_permission_id);

-- ============================================================================
-- 7. MIGRATE account_permissions
-- ============================================================================
INSERT INTO "account_permissions" ("id", "accountId", "permissionId", "allowed", "grantedBy", "createdAt", "expiresAt")
SELECT DISTINCT ON (ap."accountId", m.new_permission_id)
    gen_random_uuid()::text,
    ap."accountId",
    m.new_permission_id,
    ap."allowed",
    ap."grantedBy",
    ap."createdAt",
    ap."expiresAt"
FROM "account_permissions_backup" ap
JOIN "perm_id_migration" m ON m.old_permission_id = ap."permissionId"
WHERE ap."allowed" = true
  AND NOT EXISTS (
    SELECT 1 FROM "account_permissions" ap_ex
    WHERE ap_ex."accountId" = ap."accountId"
      AND ap_ex."permissionId" = m.new_permission_id
  )
ORDER BY ap."accountId", m.new_permission_id, ap."createdAt" ASC;

-- ============================================================================
-- 8. MIGRATE feature_permissions
-- ============================================================================
INSERT INTO "feature_permissions" ("id", "featureId", "permissionId")
SELECT DISTINCT
    gen_random_uuid()::text,
    fp."featureId",
    m.new_permission_id
FROM "feature_permissions_backup" fp
JOIN "perm_id_migration" m ON m.old_permission_id = fp."permissionId"
WHERE NOT EXISTS (
    SELECT 1 FROM "feature_permissions" fp_ex
    WHERE fp_ex."featureId" = fp."featureId"
      AND fp_ex."permissionId" = m.new_permission_id
);

-- ============================================================================
-- 9. MIGRATE device_type_permissions
-- ============================================================================
INSERT INTO "device_type_permissions" ("id", "deviceType", "permissionId", "isRequired", "createdAt", "updatedAt")
SELECT DISTINCT
    gen_random_uuid()::text,
    dtp."deviceType",
    m.new_permission_id,
    dtp."isRequired",
    dtp."createdAt",
    NOW()
FROM "device_type_permissions_backup" dtp
JOIN "perm_id_migration" m ON m.old_permission_id = dtp."permissionId"
WHERE NOT EXISTS (
    SELECT 1 FROM "device_type_permissions" dtp_ex
    WHERE dtp_ex."deviceType" = dtp."deviceType"
      AND dtp_ex."permissionId" = m.new_permission_id
);

-- ============================================================================
-- 10. VALIDATION
-- ============================================================================
DO $$
DECLARE
    cnt INTEGER;
    dup INTEGER;
    missing_cnt INTEGER;
    user_without_perm INTEGER;
    total_users INTEGER;
    total_new_perms INTEGER;
BEGIN
    -- 10a. Check no orphan account_permissions
    SELECT COUNT(*) INTO cnt FROM "account_permissions" ap
    LEFT JOIN "permissions" p ON p.id = ap."permissionId" WHERE p.id IS NULL;
    IF cnt > 0 THEN RAISE WARNING 'Orphan account_permissions: %', cnt;
    ELSE RAISE NOTICE 'OK: No orphan account_permissions'; END IF;

    -- 10b. Check no orphan feature_permissions
    SELECT COUNT(*) INTO cnt FROM "feature_permissions" fp
    LEFT JOIN "permissions" p ON p.id = fp."permissionId" WHERE p.id IS NULL;
    IF cnt > 0 THEN RAISE WARNING 'Orphan feature_permissions: %', cnt;
    ELSE RAISE NOTICE 'OK: No orphan feature_permissions'; END IF;

    -- 10c. Check no orphan device_type_permissions
    SELECT COUNT(*) INTO cnt FROM "device_type_permissions" dtp
    LEFT JOIN "permissions" p ON p.id = dtp."permissionId" WHERE p.id IS NULL;
    IF cnt > 0 THEN RAISE WARNING 'Orphan device_type_permissions: %', cnt;
    ELSE RAISE NOTICE 'OK: No orphan device_type_permissions'; END IF;

    -- 10d. Check no duplicate account_permissions
    SELECT COUNT(*) INTO dup FROM (
        SELECT "accountId", "permissionId" FROM "account_permissions"
        GROUP BY "accountId", "permissionId" HAVING COUNT(*) > 1
    ) d;
    IF dup > 0 THEN RAISE WARNING 'Duplicate account_permissions: %', dup;
    ELSE RAISE NOTICE 'OK: No duplicate account_permissions'; END IF;

    -- 10e. Check total new permissions
    SELECT COUNT(*) INTO total_new_perms FROM "permissions";
    RAISE NOTICE 'Total new permissions: %', total_new_perms;

    -- 10f. Check no user lost ALL permissions
    SELECT COUNT(*) INTO total_users FROM "account_permissions_backup";
    SELECT COUNT(*) INTO user_without_perm FROM (
        SELECT DISTINCT apb."accountId" FROM "account_permissions_backup" apb
        EXCEPT
        SELECT DISTINCT ap."accountId" FROM "account_permissions" ap
    ) u;
    IF user_without_perm > 0 THEN
        RAISE WARNING 'Users who lost ALL permissions after migration: %', user_without_perm;
    ELSE
        RAISE NOTICE 'OK: No user lost all permissions';
    END IF;

    -- 10g. Check unmapped permissions
    SELECT COUNT(*) INTO missing_cnt FROM "permission_migration_missing";
    IF missing_cnt > 0 THEN
        RAISE WARNING 'Unmapped permissions (check permission_migration_missing table): %', missing_cnt;
    ELSE
        RAISE NOTICE 'OK: No unmapped permissions';
    END IF;

    -- 10h. Verify ADMIN_ALL exists and isSystem = true
    SELECT COUNT(*) INTO cnt FROM "permissions" WHERE code = 'ADMIN_ALL' AND "isSystem" = true;
    IF cnt = 0 THEN RAISE WARNING 'ADMIN_ALL missing or isSystem = false!';
    ELSE RAISE NOTICE 'OK: ADMIN_ALL exists with isSystem = true'; END IF;

    -- 10i. Verify accounts with permissions
    SELECT COUNT(DISTINCT "accountId") INTO cnt FROM "account_permissions";
    RAISE NOTICE 'Accounts with permissions after migration: %', cnt;
    IF cnt = 0 THEN RAISE WARNING 'No accounts have any permissions!'; END IF;
END $$;

-- ============================================================================
-- 11. CLEANUP temporary tables
-- ============================================================================
-- Giữ lại backup tables để kiểm tra, có thể drop sau khi xác nhận OK:
-- DROP TABLE IF EXISTS "permissions_backup";
-- DROP TABLE IF EXISTS "account_permissions_backup";
-- DROP TABLE IF EXISTS "feature_permissions_backup";
-- DROP TABLE IF EXISTS "device_type_permissions_backup";
-- DROP TABLE IF EXISTS "perm_id_migration";
-- DROP TABLE IF EXISTS "permission_migrations";

COMMIT;

-- ============================================================================
-- POST-MIGRATION INSPECTION QUERIES
-- ============================================================================
-- SELECT * FROM "permission_migration_missing";
-- SELECT COUNT(*) FROM "permissions";
-- SELECT * FROM "migration_summary";
--
-- Check user permissions after migration:
-- SELECT a.email, a."fullName", p.code, p.name, p.module
-- FROM "account_permissions" ap
-- JOIN "accounts" a ON a.id = ap."accountId"
-- JOIN "permissions" p ON p.id = ap."permissionId"
-- WHERE ap."allowed" = true
-- ORDER BY a.email, p.module, p.code;
