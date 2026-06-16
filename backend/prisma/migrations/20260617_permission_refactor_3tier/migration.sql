-- 3-Tier Permission Refactor v2
-- Standardizes to: CRUD MODULE / BUSINESS ACTION / SYSTEM
-- Removes: PLAY_NOW, RESERVE, CHECKIN (UI-level actions → business permissions)
-- Adds: BILLIARD_SESSION_CHECKIN
-- Renames: POS_ORDER_QUEUE_PAYMENT → POS_ORDER_QUEUE_PAY
-- Total: 83 permissions
--
-- Strategy:
--   1. Backup old permissions and all dependent rows
--   2. DELETE old permissions (CASCADE removes old child rows)
--   3. Insert 83 new permissions
--   4. Migrate account / feature / device-type permissions via code mapping
--   5. Log unmapped permissions into permission_migration_errors
--   6. Validate and report

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. BACKUP
-- ============================================================================
DROP TABLE IF EXISTS "permissions_backup";
CREATE TABLE "permissions_backup" AS SELECT * FROM "permissions";

DROP TABLE IF EXISTS "account_permissions_backup";
CREATE TABLE "account_permissions_backup" AS SELECT * FROM "account_permissions";

DROP TABLE IF EXISTS "feature_permissions_backup";
CREATE TABLE "feature_permissions_backup" AS SELECT * FROM "feature_permissions";

DROP TABLE IF EXISTS "device_type_permissions_backup";
CREATE TABLE "device_type_permissions_backup" AS SELECT * FROM "device_type_permissions";

-- ============================================================================
-- 2. DELETE OLD PERMISSIONS (CASCADE removes child rows)
-- ============================================================================
DELETE FROM "permissions";

-- ============================================================================
-- 3. MAPPING TABLE
-- ============================================================================
DROP TABLE IF EXISTS "permission_migrations";
CREATE TABLE "permission_migrations" (
    id          SERIAL PRIMARY KEY,
    old_code    VARCHAR(255) NOT NULL,
    new_code    VARCHAR(255) NOT NULL,
    mapping_type VARCHAR(50) DEFAULT '1:1',
    UNIQUE(old_code, new_code)
);

-- 3a. 1:1 – same code preserved
INSERT INTO "permission_migrations" (old_code, new_code, mapping_type) VALUES
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
('INVENTORY_ADJUST', 'INVENTORY_ADJUST', '1:1'),
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
('TABLE_VIEW', 'TABLE_VIEW', '1:1'),
('TABLE_CREATE', 'TABLE_CREATE', '1:1'),
('TABLE_UPDATE', 'TABLE_UPDATE', '1:1'),
('TABLE_DELETE', 'TABLE_DELETE', '1:1'),
('TABLE_LAYOUT_EDIT', 'TABLE_LAYOUT_EDIT', '1:1'),
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
('SETTINGS_UPDATE', 'SETTINGS_UPDATE', '1:1'),
('BILLIARD_TABLE_VIEW', 'BILLIARD_TABLE_VIEW', '1:1'),
('BILLIARD_TABLE_CREATE', 'BILLIARD_TABLE_CREATE', '1:1'),
('BILLIARD_TABLE_UPDATE', 'BILLIARD_TABLE_UPDATE', '1:1'),
('BILLIARD_TABLE_DELETE', 'BILLIARD_TABLE_DELETE', '1:1'),
('BILLIARD_TABLE_LAYOUT_EDIT', 'BILLIARD_TABLE_LAYOUT_EDIT', '1:1'),
('BILLIARD_SESSION_VIEW', 'BILLIARD_SESSION_VIEW', '1:1'),
('BILLIARD_SESSION_START', 'BILLIARD_SESSION_START', '1:1'),
('BILLIARD_SESSION_EXTEND', 'BILLIARD_SESSION_EXTEND', '1:1'),
('BILLIARD_SESSION_FINISH', 'BILLIARD_SESSION_FINISH', '1:1'),
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
('ADMIN_ALL', 'ADMIN_ALL', '1:1');

-- 3b. Renamed 1:1 – old_code → new_code
INSERT INTO "permission_migrations" (old_code, new_code, mapping_type) VALUES
('BILLIARD_TABLE_PLAY_NOW', 'BILLIARD_SESSION_START', 'rename'),
('BILLIARD_TABLE_RESERVE', 'BILLIARD_RESERVATION_CREATE', 'rename'),
('BILLIARD_TABLE_CHECKIN', 'BILLIARD_SESSION_CHECKIN', 'rename'),
('POS_ORDER_QUEUE_PAYMENT', 'POS_ORDER_QUEUE_PAY', 'rename');

-- 3c. MANAGE → CRUD split (1:N)
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

-- 3d. F&B table → billiard expansion (1:N)
INSERT INTO "permission_migrations" (old_code, new_code, mapping_type) VALUES
('TABLE_VIEW', 'BILLIARD_TABLE_VIEW', '1:N-expand'),
('TABLE_CREATE', 'BILLIARD_TABLE_CREATE', '1:N-expand'),
('TABLE_UPDATE', 'BILLIARD_TABLE_UPDATE', '1:N-expand'),
('TABLE_DELETE', 'BILLIARD_TABLE_DELETE', '1:N-expand'),
('TABLE_LAYOUT_EDIT', 'BILLIARD_TABLE_LAYOUT_EDIT', '1:N-expand');

-- ============================================================================
-- 4. INSERT 83 NEW PERMISSIONS (no conflicts – table was emptied)
-- ============================================================================
INSERT INTO "permissions" ("id", "code", "name", "module", "isSystem", "createdAt", "updatedAt") VALUES

-- DASHBOARD
(gen_random_uuid()::text, 'DASHBOARD_VIEW', 'Xem dashboard', 'dashboard', false, NOW(), NOW()),

-- ORDERS (F&B)
(gen_random_uuid()::text, 'ORDER_VIEW', 'Xem đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_CREATE', 'Tạo đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_UPDATE', 'Cập nhật đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_DELETE', 'Xóa đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_HISTORY_VIEW', 'Xem lịch sử đơn hàng', 'orders', false, NOW(), NOW()),

-- MENU
(gen_random_uuid()::text, 'MENU_VIEW', 'Xem thực đơn', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_CREATE', 'Thêm món', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_UPDATE', 'Cập nhật món', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_DELETE', 'Xóa món', 'menu', false, NOW(), NOW()),

-- CATEGORY
(gen_random_uuid()::text, 'CATEGORY_VIEW', 'Xem danh mục', 'category', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CATEGORY_CREATE', 'Tạo danh mục', 'category', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CATEGORY_UPDATE', 'Cập nhật danh mục', 'category', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CATEGORY_DELETE', 'Xóa danh mục', 'category', false, NOW(), NOW()),

-- INVENTORY
(gen_random_uuid()::text, 'INVENTORY_VIEW', 'Xem tồn kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_CREATE', 'Tạo nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_UPDATE', 'Cập nhật nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_DELETE', 'Xóa nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_IMPORT', 'Nhập kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_EXPORT', 'Xuất kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_ADJUST', 'Điều chỉnh tồn kho', 'inventory', false, NOW(), NOW()),

-- TABLE (F&B)
(gen_random_uuid()::text, 'TABLE_VIEW', 'Xem bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_CREATE', 'Tạo bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_UPDATE', 'Cập nhật bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_DELETE', 'Xóa bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_LAYOUT_EDIT', 'Chỉnh sửa sơ đồ bàn', 'table', false, NOW(), NOW()),

-- BILLIARD TABLE
(gen_random_uuid()::text, 'BILLIARD_TABLE_VIEW', 'Xem bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_CREATE', 'Tạo bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_UPDATE', 'Cập nhật bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_DELETE', 'Xóa bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_TABLE_LAYOUT_EDIT', 'Chỉnh sửa sơ đồ bàn Billiard', 'billiard', false, NOW(), NOW()),

-- BILLIARD SESSION
(gen_random_uuid()::text, 'BILLIARD_SESSION_VIEW', 'Xem phiên chơi', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_START', 'Bắt đầu phiên chơi', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_CHECKIN', 'Check-in bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_EXTEND', 'Gia hạn phiên chơi', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_SESSION_FINISH', 'Kết thúc phiên chơi', 'billiard', false, NOW(), NOW()),

-- BILLIARD RESERVATION
(gen_random_uuid()::text, 'BILLIARD_RESERVATION_VIEW', 'Xem đặt bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_RESERVATION_CREATE', 'Tạo đặt bàn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_RESERVATION_CANCEL', 'Hủy đặt bàn Billiard', 'billiard', false, NOW(), NOW()),

-- BILLIARD ORDER
(gen_random_uuid()::text, 'BILLIARD_ORDER_VIEW', 'Xem đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_CREATE', 'Tạo đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_UPDATE', 'Cập nhật đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_DELETE', 'Xóa đơn Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_ORDER_ADD_ITEM', 'Thêm món Billiard', 'billiard', false, NOW(), NOW()),

-- BILLIARD PAY
(gen_random_uuid()::text, 'BILLIARD_PAY_VIEW', 'Xem thanh toán Billiard', 'billiard', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BILLIARD_PAY_PROCESS', 'Thanh toán Billiard', 'billiard', false, NOW(), NOW()),

-- BILLIARD REPORT
(gen_random_uuid()::text, 'BILLIARD_REPORT_VIEW', 'Xem báo cáo Billiard', 'billiard', false, NOW(), NOW()),

-- REPORTS
(gen_random_uuid()::text, 'REPORT_VIEW', 'Xem báo cáo', 'reports', false, NOW(), NOW()),
(gen_random_uuid()::text, 'REPORT_EXPORT', 'Xuất báo cáo', 'reports', false, NOW(), NOW()),

-- BRANCH
(gen_random_uuid()::text, 'BRANCH_VIEW', 'Xem chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_CREATE', 'Tạo chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_UPDATE', 'Cập nhật chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_DELETE', 'Xóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_LOCK', 'Khóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_UNLOCK', 'Mở khóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_FORCE_DELETE', 'Xóa vĩnh viễn chi nhánh', 'branch', false, NOW(), NOW()),

-- POS
(gen_random_uuid()::text, 'POS_OPEN', 'Mở ca POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CLOSE', 'Đóng ca POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CREATE_ORDER', 'Tạo đơn hàng POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CANCEL_ORDER', 'Hủy đơn hàng POS', 'pos', false, NOW(), NOW()),

-- POS ORDER QUEUE
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_VIEW', 'Xem Order Queue POS', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_CREATE', 'Tạo Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_UPDATE', 'Cập nhật Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_DELETE', 'Hủy Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_PAY', 'Thanh toán Order Queue', 'pos_order_queue', false, NOW(), NOW()),

-- POS DEVICE
(gen_random_uuid()::text, 'POS_DEVICE_VIEW', 'Xem thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_CREATE', 'Tạo thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_UPDATE', 'Cập nhật thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_DELETE', 'Xóa thiết bị POS', 'pos_device', false, NOW(), NOW()),

-- SHIFT
(gen_random_uuid()::text, 'SHIFT_VIEW', 'Xem ca làm việc', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_CREATE', 'Tạo ca', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_UPDATE', 'Cập nhật ca', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_CLOSE', 'Đóng ca', 'shift', false, NOW(), NOW()),

-- CUSTOMER
(gen_random_uuid()::text, 'CUSTOMER_VIEW', 'Xem khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_CREATE', 'Thêm khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_UPDATE', 'Cập nhật khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_DELETE', 'Xóa khách hàng', 'customer', false, NOW(), NOW()),

-- SETTINGS / PERMISSION
(gen_random_uuid()::text, 'PERMISSION_VIEW', 'Xem quyền', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'PERMISSION_ASSIGN', 'Phân quyền', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'PERMISSION_MANAGE', 'Quản lý quyền hệ thống', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SETTINGS_VIEW', 'Xem cài đặt', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SETTINGS_UPDATE', 'Cập nhật cài đặt', 'settings', false, NOW(), NOW()),

-- ADMIN
(gen_random_uuid()::text, 'ADMIN_ALL', 'Toàn quyền hệ thống', 'admin', true, NOW(), NOW());

-- ============================================================================
-- 5. BUILD ID MAPPING (old backup ID → new permission ID)
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
-- 6. LOG UNMAPPED PERMISSIONS
-- ============================================================================
DROP TABLE IF EXISTS "permission_migration_errors";
CREATE TABLE "permission_migration_errors" (
    id SERIAL PRIMARY KEY,
    old_code VARCHAR(255) NOT NULL,
    old_name VARCHAR(255),
    old_module VARCHAR(255),
    affected_users INTEGER DEFAULT 0,
    reason TEXT DEFAULT 'No mapping rule found for this permission',
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO "permission_migration_errors" (old_code, old_name, old_module, affected_users)
SELECT
    p.code,
    p.name,
    p.module,
    COUNT(DISTINCT ap."accountId")::INTEGER
FROM "permissions_backup" p
LEFT JOIN "account_permissions_backup" ap ON ap."permissionId" = p.id AND ap."allowed" = true
WHERE p.code NOT IN (SELECT DISTINCT old_code FROM "permission_migrations")
GROUP BY p.code, p.name, p.module;

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
    err_cnt INTEGER;
BEGIN
    SELECT COUNT(*) INTO cnt FROM "account_permissions" ap
    LEFT JOIN "permissions" p ON p.id = ap."permissionId" WHERE p.id IS NULL;
    IF cnt > 0 THEN RAISE WARNING 'Orphan account_permissions: %', cnt;
    ELSE RAISE NOTICE 'OK: No orphan account_permissions'; END IF;

    SELECT COUNT(*) INTO cnt FROM "feature_permissions" fp
    LEFT JOIN "permissions" p ON p.id = fp."permissionId" WHERE p.id IS NULL;
    IF cnt > 0 THEN RAISE WARNING 'Orphan feature_permissions: %', cnt;
    ELSE RAISE NOTICE 'OK: No orphan feature_permissions'; END IF;

    SELECT COUNT(*) INTO cnt FROM "device_type_permissions" dtp
    LEFT JOIN "permissions" p ON p.id = dtp."permissionId" WHERE p.id IS NULL;
    IF cnt > 0 THEN RAISE WARNING 'Orphan device_type_permissions: %', cnt;
    ELSE RAISE NOTICE 'OK: No orphan device_type_permissions'; END IF;

    SELECT COUNT(*) INTO dup FROM (
        SELECT "accountId", "permissionId" FROM "account_permissions"
        GROUP BY "accountId", "permissionId" HAVING COUNT(*) > 1
    ) d;
    IF dup > 0 THEN RAISE WARNING 'Duplicate account_permissions: %', dup;
    ELSE RAISE NOTICE 'OK: No duplicate account_permissions'; END IF;

    SELECT COUNT(*) INTO cnt FROM "permissions";
    RAISE NOTICE 'Total new permissions: %', cnt;

    SELECT COUNT(DISTINCT "accountId") INTO cnt FROM "account_permissions";
    RAISE NOTICE 'Accounts with permissions: %', cnt;
    IF cnt = 0 THEN RAISE WARNING 'No accounts have any permissions!'; END IF;

    SELECT COUNT(*) INTO err_cnt FROM "permission_migration_errors";
    IF err_cnt > 0 THEN
        RAISE WARNING 'Migration errors (unmapped permissions): %', err_cnt;
    ELSE
        RAISE NOTICE 'OK: No unmapped permissions';
    END IF;
END $$;

-- ============================================================================
-- 11. REPORTS (persist for post-migration inspection)
-- ============================================================================

-- Summary: mapping with user impact
DROP TABLE IF EXISTS "migration_summary";
CREATE TABLE "migration_summary" AS
SELECT
    pm.old_code,
    pm.new_code,
    pm.mapping_type,
    COUNT(DISTINCT ap."accountId") AS users_affected
FROM "permission_migrations" pm
JOIN "perm_id_migration" m ON m.old_code = pm.old_code AND m.new_code = pm.new_code
LEFT JOIN "account_permissions_backup" ap ON ap."permissionId" = m.old_permission_id AND ap."allowed" = true
GROUP BY pm.old_code, pm.new_code, pm.mapping_type
ORDER BY pm.old_code, pm.new_code;

-- ============================================================================
-- 12. CLEANUP (backup tables kept for safety)
-- ============================================================================
DROP TABLE IF EXISTS "perm_id_migration";
DROP TABLE IF EXISTS "permission_migrations";

COMMIT;

-- ============================================================================
-- POST-MIGRATION QUERIES:
-- ============================================================================
-- SELECT * FROM "migration_summary";
-- SELECT * FROM "permission_migration_errors";
-- SELECT COUNT(*) FROM "permissions";
-- SELECT a.email, a."fullName", p.code, p.name, p.module
-- FROM "account_permissions" ap
-- JOIN "accounts" a ON a.id = ap."accountId"
-- JOIN "permissions" p ON p.id = ap."permissionId"
-- WHERE ap."allowed" = true
-- ORDER BY a.email, p.module, p.code;
