-- ============================================================================
-- SEED PERMISSIONS — Xóa dữ liệu cũ và insert đúng danh sách 99 permissions
-- ============================================================================
-- Yêu cầu:
--  1. Xóa toàn bộ dữ liệu bảng permissions (CASCADE sẽ xóa account_permissions,
--     feature_permissions, device_type_permissions — cần re-grant sau khi seed)
--  2. Insert đúng 99 permissions từ danh sách, không thêm/bớt/sửa tên
--     (83 cũ + 16 RESTAURANT mới)
--  3. Mỗi permission là 1 record, code unique, không null field
-- ============================================================================

BEGIN;

-- 1. Xóa toàn bộ dữ liệu cũ trong bảng permissions
DELETE FROM "permissions";

-- 2. Insert 83 permissions mới
INSERT INTO "permissions" ("id", "code", "name", "module", "isSystem", "createdAt", "updatedAt") VALUES

-- ADMIN (1 permission)
(gen_random_uuid()::text, 'VIEW_AUDIT_LOG', 'Xem nhật ký hệ thống', 'admin', false, NOW(), NOW()),

-- BILLIARD (21 permissions)
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

-- BRANCH (7 permissions)
(gen_random_uuid()::text, 'BRANCH_VIEW', 'Xem chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_CREATE', 'Tạo chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_UPDATE', 'Cập nhật chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_DELETE', 'Xóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_LOCK', 'Khóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_UNLOCK', 'Mở khóa chi nhánh', 'branch', false, NOW(), NOW()),
(gen_random_uuid()::text, 'BRANCH_FORCE_DELETE', 'Xóa vĩnh viễn chi nhánh', 'branch', false, NOW(), NOW()),

-- CATEGORY (4 permissions)
(gen_random_uuid()::text, 'CATEGORY_VIEW', 'Xem danh mục', 'category', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CATEGORY_CREATE', 'Tạo danh mục', 'category', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CATEGORY_UPDATE', 'Cập nhật danh mục', 'category', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CATEGORY_DELETE', 'Xóa danh mục', 'category', false, NOW(), NOW()),

-- CUSTOMER (4 permissions)
(gen_random_uuid()::text, 'CUSTOMER_VIEW', 'Xem khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_CREATE', 'Thêm khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_UPDATE', 'Cập nhật khách hàng', 'customer', false, NOW(), NOW()),
(gen_random_uuid()::text, 'CUSTOMER_DELETE', 'Xóa khách hàng', 'customer', false, NOW(), NOW()),

-- DASHBOARD (1 permission)
(gen_random_uuid()::text, 'DASHBOARD_VIEW', 'Xem dashboard', 'dashboard', false, NOW(), NOW()),

-- INVENTORY (7 permissions)
(gen_random_uuid()::text, 'INVENTORY_VIEW', 'Xem tồn kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_CREATE', 'Tạo nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_UPDATE', 'Cập nhật nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_DELETE', 'Xóa nguyên liệu', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_IMPORT', 'Nhập kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_EXPORT', 'Xuất kho', 'inventory', false, NOW(), NOW()),
(gen_random_uuid()::text, 'INVENTORY_TRANSACTION_VIEW', 'Xem lịch sử xuất nhập kho', 'inventory', false, NOW(), NOW()),

-- MENU (4 permissions)
(gen_random_uuid()::text, 'MENU_VIEW', 'Xem thực đơn', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_CREATE', 'Thêm món', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_UPDATE', 'Cập nhật món', 'menu', false, NOW(), NOW()),
(gen_random_uuid()::text, 'MENU_DELETE', 'Xóa món', 'menu', false, NOW(), NOW()),

-- ORDER (5 permissions)
(gen_random_uuid()::text, 'ORDER_VIEW', 'Xem đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_CREATE', 'Tạo đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_UPDATE', 'Cập nhật đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_DELETE', 'Xóa đơn hàng', 'orders', false, NOW(), NOW()),
(gen_random_uuid()::text, 'ORDER_HISTORY_VIEW', 'Xem lịch sử đơn hàng', 'orders', false, NOW(), NOW()),

-- POS (4 permissions)
(gen_random_uuid()::text, 'POS_OPEN', 'Mở ca POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CLOSE', 'Đóng ca POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CREATE_ORDER', 'Tạo đơn hàng POS', 'pos', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_CANCEL_ORDER', 'Hủy đơn hàng POS', 'pos', false, NOW(), NOW()),

-- POS_DEVICE (4 permissions)
(gen_random_uuid()::text, 'POS_DEVICE_VIEW', 'Xem thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_CREATE', 'Tạo thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_UPDATE', 'Cập nhật thiết bị POS', 'pos_device', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_DEVICE_DELETE', 'Xóa thiết bị POS', 'pos_device', false, NOW(), NOW()),

-- POS_ORDER_QUEUE (5 permissions)
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_VIEW', 'Xem Order Queue POS', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_CREATE', 'Tạo Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_UPDATE', 'Cập nhật Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_DELETE', 'Hủy Order Queue', 'pos_order_queue', false, NOW(), NOW()),
(gen_random_uuid()::text, 'POS_ORDER_QUEUE_PAY', 'Thanh toán Order Queue', 'pos_order_queue', false, NOW(), NOW()),

-- REPORT (2 permissions)
(gen_random_uuid()::text, 'REPORT_VIEW', 'Xem báo cáo', 'reports', false, NOW(), NOW()),
(gen_random_uuid()::text, 'REPORT_EXPORT', 'Xuất báo cáo', 'reports', false, NOW(), NOW()),

-- SETTINGS (2 permissions)
(gen_random_uuid()::text, 'SETTINGS_VIEW', 'Xem cài đặt', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SETTINGS_UPDATE', 'Cập nhật cài đặt', 'settings', false, NOW(), NOW()),

-- PERMISSION (3 permissions)
(gen_random_uuid()::text, 'PERMISSION_VIEW', 'Xem quyền', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'PERMISSION_ASSIGN', 'Phân quyền', 'settings', false, NOW(), NOW()),
(gen_random_uuid()::text, 'PERMISSION_MANAGE', 'Quản lý quyền hệ thống', 'settings', false, NOW(), NOW()),

-- SHIFT (4 permissions)
(gen_random_uuid()::text, 'SHIFT_VIEW', 'Xem ca làm việc', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_CREATE', 'Tạo ca', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_UPDATE', 'Cập nhật ca', 'shift', false, NOW(), NOW()),
(gen_random_uuid()::text, 'SHIFT_CLOSE', 'Đóng ca', 'shift', false, NOW(), NOW()),

-- TABLE (5 permissions)
(gen_random_uuid()::text, 'TABLE_VIEW', 'Xem bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_CREATE', 'Tạo bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_UPDATE', 'Cập nhật bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_DELETE', 'Xóa bàn', 'table', false, NOW(), NOW()),
(gen_random_uuid()::text, 'TABLE_LAYOUT_EDIT', 'Chỉnh sửa sơ đồ bàn', 'table', false, NOW(), NOW()),

-- RESTAURANT (16 permissions)
(gen_random_uuid()::text, 'RESTAURANT_TABLE_VIEW', 'Xem bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_TABLE_CREATE', 'Tạo bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_TABLE_UPDATE', 'Cập nhật bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_TABLE_DELETE', 'Xóa bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_TABLE_LAYOUT_EDIT', 'Chỉnh sửa sơ đồ bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_TABLE_TRANSFER', 'Chuyển bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_TABLE_MERGE', 'Gộp bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_TABLE_SPLIT', 'Tách bàn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_ORDER_VIEW', 'Xem đơn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_ORDER_CREATE', 'Tạo đơn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_ORDER_UPDATE', 'Cập nhật đơn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_ORDER_DELETE', 'Xóa đơn nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_ORDER_ADD_ITEM', 'Thêm món nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_PAY_VIEW', 'Xem thanh toán nhà hàng', 'restaurant', false, NOW(), NOW()),
(gen_random_uuid()::text, 'RESTAURANT_PAY_PROCESS', 'Thanh toán nhà hàng', 'restaurant', false, NOW(), NOW());

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT COUNT(*) AS total_permissions FROM "permissions";
