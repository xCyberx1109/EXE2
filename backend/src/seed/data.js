/** Dữ liệu seed khớp frontend mockData.ts */

export const categories = [
  { name: 'Món chính', slug: 'mon-chinh', description: 'Các món ăn chính' },
  { name: 'Món phụ', slug: 'mon-phu', description: 'Món ăn kèm, snack' },
  { name: 'Đồ uống', slug: 'do-uong', description: 'Thức uống các loại' },
];

export const menuItems = [
  { name: 'Phở Bò', category: 'Món chính', price: 65000, cost: 35000, description: 'Phở bò truyền thống Hà Nội', imageUrl: 'https://images.unsplash.com/photo-1591814468924-42a140c26160?w=400' },
  { name: 'Bún Chả', category: 'Món chính', price: 55000, cost: 30000, description: 'Bún chả Hà Nội đặc sản', imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400' },
  { name: 'Cơm Tấm', category: 'Món chính', price: 45000, cost: 25000, description: 'Cơm tấm sườn bì chả', imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25ad6d3e?w=400' },
  { name: 'Bánh Mì', category: 'Món phụ', price: 25000, cost: 12000, description: 'Bánh mì thịt nguội pate', imageUrl: 'https://images.unsplash.com/photo-1553909489-9a58f0e3a921?w=400' },
  { name: 'Cà Phê Đen', category: 'Đồ uống', price: 25000, cost: 8000, description: 'Cà phê phin truyền thống', imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400' },
  { name: 'Cà Phê Sữa', category: 'Đồ uống', price: 30000, cost: 10000, description: 'Cà phê sữa đá', imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400' },
  { name: 'Trà Chanh', category: 'Đồ uống', price: 20000, cost: 6000, description: 'Trà chanh tươi mát', imageUrl: 'https://images.unsplash.com/photo-1556675593-ef062e68f493?w=400' },
  { name: 'Nem Rán', category: 'Món phụ', price: 35000, cost: 18000, description: 'Nem rán giòn rụm', imageUrl: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400' },
];

export const ingredients = [
  { name: 'Thịt Bò', unit: 'KG', quantity: 45, minQuantity: 20, price: 280000, supplier: 'Công ty Thực Phẩm A' },
  { name: 'Gạo', unit: 'KG', quantity: 150, minQuantity: 50, price: 18000, supplier: 'Công ty Lương Thực B' },
  { name: 'Rau Sống', unit: 'KG', quantity: 15, minQuantity: 10, price: 25000, supplier: 'Nông Trại C' },
  { name: 'Cà Phê Hạt', unit: 'KG', quantity: 12, minQuantity: 5, price: 350000, supplier: 'Công ty Cà Phê D' },
  { name: 'Đường', unit: 'KG', quantity: 30, minQuantity: 15, price: 22000, supplier: 'Công ty Thực Phẩm A' },
  { name: 'Sữa Tươi', unit: 'LITER', quantity: 8, minQuantity: 10, price: 35000, supplier: 'Công ty Sữa E' },
  { name: 'Bánh Mì', unit: 'PIECE', quantity: 50, minQuantity: 30, price: 8000, supplier: 'Tiệm Bánh F' },
  { name: 'Chanh', unit: 'KG', quantity: 18, minQuantity: 8, price: 15000, supplier: 'Nông Trại C' },
];

/** Liên kết món - nguyên liệu (amount per serving) */
export const menuIngredientLinks = [
  { menuItem: 'Phở Bò', ingredient: 'Thịt Bò', amount: 0.15 },
  { menuItem: 'Phở Bò', ingredient: 'Rau Sống', amount: 0.05 },
  { menuItem: 'Cà Phê Đen', ingredient: 'Cà Phê Hạt', amount: 0.02 },
  { menuItem: 'Cà Phê Sữa', ingredient: 'Cà Phê Hạt', amount: 0.02 },
  { menuItem: 'Cà Phê Sữa', ingredient: 'Sữa Tươi', amount: 0.05 },
  { menuItem: 'Bánh Mì', ingredient: 'Bánh Mì', amount: 1 },
];

export const features = [
  { code: 'pos_cashier', name: 'POS Thu ngân', module: 'pos', isCore: true, sortOrder: 1 },
  { code: 'pos_kitchen', name: 'POS Bếp', module: 'pos', isCore: true, sortOrder: 2 },
  { code: 'inventory', name: 'Quản lý kho', module: 'inventory', isCore: true, sortOrder: 3 },
  { code: 'menu_management', name: 'Quản lý thực đơn', module: 'menu', isCore: true, sortOrder: 5 },
  { code: 'customer_loyalty', name: 'Khách hàng thân thiết', module: 'customer', isCore: false, sortOrder: 6 },
  { code: 'online_ordering', name: 'Đặt hàng online', module: 'orders', isCore: false, sortOrder: 7 },
  { code: 'multi_branch', name: 'Đa chi nhánh', module: 'branch', isCore: false, sortOrder: 8 },
  { code: 'voucher', name: 'Mã giảm giá', module: 'marketing', isCore: false, sortOrder: 9 },
  { code: 'kitchen_display', name: 'Màn hình hiển thị bếp', module: 'kitchen', isCore: true, sortOrder: 10 },
  // Billiard Management
  { code: 'billiard_table', name: 'Bàn Billiard', module: 'billiard', isCore: false, sortOrder: 11 },
  { code: 'billiard_session', name: 'Phiên chơi Billiard', module: 'billiard', isCore: false, sortOrder: 12 },
  { code: 'billiard_reservation', name: 'Đặt bàn Billiard', module: 'billiard', isCore: false, sortOrder: 13 },
  { code: 'billiard_layout', name: 'Sơ đồ bàn Billiard', module: 'billiard', isCore: false, sortOrder: 14 },
  { code: 'billiard_report', name: 'Báo cáo Billiard', module: 'billiard', isCore: false, sortOrder: 15 },
  { code: 'billiard_order', name: 'Gọi món Billiard', module: 'billiard', isCore: false, sortOrder: 16 },
  { code: 'billiard_pay', name: 'Thanh toán Billiard', module: 'billiard', isCore: false, sortOrder: 17 },
  { code: 'pos_order_queue', name: 'POS Order Queue', module: 'pos', isCore: true, sortOrder: 18 },
  // Staff Management
  { code: 'staff_management', name: 'Quản lý nhân viên POS', module: 'staff', isCore: false, sortOrder: 19 },
];

export const permissions = [
  // ================= ADMIN =================
  { code: 'VIEW_AUDIT_LOG', name: 'Xem nhật ký hệ thống', module: 'admin' },

  // ================= BILLIARD =================
  { code: 'BILLIARD_TABLE_VIEW', name: 'Xem bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_TABLE_CREATE', name: 'Tạo bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_TABLE_UPDATE', name: 'Cập nhật bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_TABLE_DELETE', name: 'Xóa bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_TABLE_LAYOUT_EDIT', name: 'Chỉnh sửa sơ đồ bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_SESSION_VIEW', name: 'Xem phiên chơi', module: 'billiard' },
  { code: 'BILLIARD_SESSION_START', name: 'Bắt đầu phiên chơi', module: 'billiard' },
  { code: 'BILLIARD_SESSION_EXTEND', name: 'Gia hạn phiên chơi', module: 'billiard' },
  { code: 'BILLIARD_SESSION_FINISH', name: 'Kết thúc phiên chơi', module: 'billiard' },
  { code: 'BILLIARD_SESSION_CHECKIN', name: 'Check-in bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_RESERVATION_VIEW', name: 'Xem đặt bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_RESERVATION_CREATE', name: 'Tạo đặt bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_RESERVATION_CANCEL', name: 'Hủy đặt bàn Billiard', module: 'billiard' },
  { code: 'BILLIARD_ORDER_VIEW', name: 'Xem đơn Billiard', module: 'billiard' },
  { code: 'BILLIARD_ORDER_CREATE', name: 'Tạo đơn Billiard', module: 'billiard' },
  { code: 'BILLIARD_ORDER_UPDATE', name: 'Cập nhật đơn Billiard', module: 'billiard' },
  { code: 'BILLIARD_ORDER_DELETE', name: 'Xóa đơn Billiard', module: 'billiard' },
  { code: 'BILLIARD_ORDER_ADD_ITEM', name: 'Thêm món Billiard', module: 'billiard' },
  { code: 'BILLIARD_PAY_VIEW', name: 'Xem thanh toán Billiard', module: 'billiard' },
  { code: 'BILLIARD_PAY_PROCESS', name: 'Thanh toán Billiard', module: 'billiard' },
  { code: 'BILLIARD_REPORT_VIEW', name: 'Xem báo cáo Billiard', module: 'billiard' },

  // ================= BRANCH =================
  { code: 'BRANCH_VIEW', name: 'Xem chi nhánh', module: 'branch' },
  { code: 'BRANCH_CREATE', name: 'Tạo chi nhánh', module: 'branch' },
  { code: 'BRANCH_UPDATE', name: 'Cập nhật chi nhánh', module: 'branch' },
  { code: 'BRANCH_DELETE', name: 'Xóa chi nhánh', module: 'branch' },
  { code: 'BRANCH_LOCK', name: 'Khóa chi nhánh', module: 'branch' },
  { code: 'BRANCH_UNLOCK', name: 'Mở khóa chi nhánh', module: 'branch' },
  { code: 'BRANCH_FORCE_DELETE', name: 'Xóa vĩnh viễn chi nhánh', module: 'branch' },

  // ================= CATEGORY =================
  { code: 'CATEGORY_VIEW', name: 'Xem danh mục', module: 'category' },
  { code: 'CATEGORY_CREATE', name: 'Tạo danh mục', module: 'category' },
  { code: 'CATEGORY_UPDATE', name: 'Cập nhật danh mục', module: 'category' },
  { code: 'CATEGORY_DELETE', name: 'Xóa danh mục', module: 'category' },

  // ================= CUSTOMER =================
  { code: 'CUSTOMER_VIEW', name: 'Xem khách hàng', module: 'customer' },
  { code: 'CUSTOMER_CREATE', name: 'Thêm khách hàng', module: 'customer' },
  { code: 'CUSTOMER_UPDATE', name: 'Cập nhật khách hàng', module: 'customer' },
  { code: 'CUSTOMER_DELETE', name: 'Xóa khách hàng', module: 'customer' },

  // ================= DASHBOARD =================
  { code: 'DASHBOARD_VIEW', name: 'Xem dashboard', module: 'dashboard' },

  // ================= INVENTORY =================
  { code: 'INVENTORY_VIEW', name: 'Xem tồn kho', module: 'inventory' },
  { code: 'INVENTORY_CREATE', name: 'Tạo nguyên liệu', module: 'inventory' },
  { code: 'INVENTORY_UPDATE', name: 'Cập nhật nguyên liệu', module: 'inventory' },
  { code: 'INVENTORY_DELETE', name: 'Xóa nguyên liệu', module: 'inventory' },
  { code: 'INVENTORY_IMPORT', name: 'Nhập kho', module: 'inventory' },
  { code: 'INVENTORY_EXPORT', name: 'Xuất kho', module: 'inventory' },
  { code: 'INVENTORY_ADJUST', name: 'Điều chỉnh tồn kho', module: 'inventory' },

  // ================= MENU =================
  { code: 'MENU_VIEW', name: 'Xem thực đơn', module: 'menu' },
  { code: 'MENU_CREATE', name: 'Thêm món', module: 'menu' },
  { code: 'MENU_UPDATE', name: 'Cập nhật món', module: 'menu' },
  { code: 'MENU_DELETE', name: 'Xóa món', module: 'menu' },

  // ================= ORDER =================
  { code: 'ORDER_VIEW', name: 'Xem đơn hàng', module: 'orders' },
  { code: 'ORDER_CREATE', name: 'Tạo đơn hàng', module: 'orders' },
  { code: 'ORDER_UPDATE', name: 'Cập nhật đơn hàng', module: 'orders' },
  { code: 'ORDER_DELETE', name: 'Xóa đơn hàng', module: 'orders' },
  { code: 'ORDER_HISTORY_VIEW', name: 'Xem lịch sử đơn hàng', module: 'orders' },

  // ================= POS =================
  { code: 'POS_OPEN', name: 'Mở ca POS', module: 'pos' },
  { code: 'POS_CLOSE', name: 'Đóng ca POS', module: 'pos' },
  { code: 'POS_CREATE_ORDER', name: 'Tạo đơn hàng POS', module: 'pos' },
  { code: 'POS_CANCEL_ORDER', name: 'Hủy đơn hàng POS', module: 'pos' },

  // ================= POS_DEVICE =================
  { code: 'POS_DEVICE_VIEW', name: 'Xem thiết bị POS', module: 'pos_device' },
  { code: 'POS_DEVICE_CREATE', name: 'Tạo thiết bị POS', module: 'pos_device' },
  { code: 'POS_DEVICE_UPDATE', name: 'Cập nhật thiết bị POS', module: 'pos_device' },
  { code: 'POS_DEVICE_DELETE', name: 'Xóa thiết bị POS', module: 'pos_device' },

  // ================= POS_ORDER_QUEUE =================
  { code: 'POS_ORDER_QUEUE_VIEW', name: 'Xem Order Queue POS', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_CREATE', name: 'Tạo Order Queue', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_UPDATE', name: 'Cập nhật Order Queue', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_DELETE', name: 'Hủy Order Queue', module: 'pos_order_queue' },
  { code: 'POS_ORDER_QUEUE_PAY', name: 'Thanh toán Order Queue', module: 'pos_order_queue' },

  // ================= REPORT =================
  { code: 'REPORT_VIEW', name: 'Xem báo cáo', module: 'reports' },
  { code: 'REPORT_EXPORT', name: 'Xuất báo cáo', module: 'reports' },

  // ================= SETTINGS =================
  { code: 'SETTINGS_VIEW', name: 'Xem cài đặt', module: 'settings' },
  { code: 'SETTINGS_UPDATE', name: 'Cập nhật cài đặt', module: 'settings' },

  // ================= PERMISSION =================
  { code: 'PERMISSION_VIEW', name: 'Xem quyền', module: 'settings' },
  { code: 'PERMISSION_ASSIGN', name: 'Phân quyền', module: 'settings' },
  { code: 'PERMISSION_MANAGE', name: 'Quản lý quyền hệ thống', module: 'settings' },

  // ================= SHIFT =================
  { code: 'SHIFT_VIEW', name: 'Xem ca làm việc', module: 'shift' },
  { code: 'SHIFT_CREATE', name: 'Tạo ca', module: 'shift' },
  { code: 'SHIFT_UPDATE', name: 'Cập nhật ca', module: 'shift' },
  { code: 'SHIFT_CLOSE', name: 'Đóng ca', module: 'shift' },

  // ================= TABLE =================
  { code: 'TABLE_VIEW', name: 'Xem bàn', module: 'table' },
  { code: 'TABLE_CREATE', name: 'Tạo bàn', module: 'table' },
  { code: 'TABLE_UPDATE', name: 'Cập nhật bàn', module: 'table' },
  { code: 'TABLE_DELETE', name: 'Xóa bàn', module: 'table' },
  { code: 'TABLE_LAYOUT_EDIT', name: 'Chỉnh sửa sơ đồ bàn', module: 'table' },

  // ================= RESTAURANT =================
  { code: 'RESTAURANT_TABLE_VIEW', name: 'Xem bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_TABLE_CREATE', name: 'Tạo bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_TABLE_UPDATE', name: 'Cập nhật bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_TABLE_DELETE', name: 'Xóa bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_TABLE_LAYOUT_EDIT', name: 'Chỉnh sửa sơ đồ bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_TABLE_TRANSFER', name: 'Chuyển bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_TABLE_MERGE', name: 'Gộp bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_TABLE_SPLIT', name: 'Tách bàn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_ORDER_VIEW', name: 'Xem đơn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_ORDER_CREATE', name: 'Tạo đơn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_ORDER_UPDATE', name: 'Cập nhật đơn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_ORDER_DELETE', name: 'Xóa đơn nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_ORDER_ADD_ITEM', name: 'Thêm món nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_PAY_VIEW', name: 'Xem thanh toán nhà hàng', module: 'restaurant' },
  { code: 'RESTAURANT_PAY_PROCESS', name: 'Thanh toán nhà hàng', module: 'restaurant' },

  // ================= STAFF =================
  { code: 'STAFF_VIEW', name: 'Xem danh sách nhân viên', module: 'staff' },
  { code: 'STAFF_CREATE', name: 'Thêm nhân viên mới', module: 'staff' },
  { code: 'STAFF_UPDATE', name: 'Cập nhật thông tin nhân viên', module: 'staff' },
  { code: 'STAFF_DELETE', name: 'Xóa nhân viên', module: 'staff' },
  { code: 'STAFF_MANAGE', name: 'Quản lý toàn bộ nhân viên', module: 'staff' },
  { code: 'STAFF_MANAGE_PIN', name: 'Quản lý mã PIN nhân viên', module: 'staff' },
  { code: 'STAFF_RESET_PIN', name: 'Đặt lại mã PIN nhân viên', module: 'staff' },
  { code: 'STAFF_VIEW_PIN', name: 'Xem mã PIN nhân viên (Admin)', module: 'staff' },
  { code: 'STAFF_ASSIGN_POS_MACHINE', name: 'Gán máy POS cho nhân viên', module: 'staff' },
  { code: 'STAFF_REMOVE_POS_MACHINE', name: 'Gỡ máy POS khỏi nhân viên', module: 'staff' },
  { code: 'STAFF_VIEW_POS_MACHINE', name: 'Xem máy POS được gán', module: 'staff' },
  { code: 'STAFF_VIEW_ACTIVITY', name: 'Xem hoạt động nhân viên', module: 'staff' },
  { code: 'STAFF_VIEW_LOGIN_HISTORY', name: 'Xem lịch sử đăng nhập POS', module: 'staff' },
  { code: 'STAFF_VIEW_PERFORMANCE', name: 'Xem hiệu suất nhân viên', module: 'staff' },
  { code: 'STAFF_SESSION_VIEW', name: 'Xem phiên làm việc POS', module: 'staff' },
  { code: 'STAFF_SESSION_FORCE_LOGOUT', name: 'Buộc đăng xuất phiên POS', module: 'staff' },
];

export const subscriptionPlans = [
  { code: 'basic', name: 'Cơ bản', price: 0, billingInterval: 'MONTHLY' },
  { code: 'pro', name: 'Chuyên nghiệp', price: 499000, billingInterval: 'MONTHLY' },
  { code: 'enterprise', name: 'Doanh nghiệp', price: 1999000, billingInterval: 'MONTHLY' },
];

/** Gói Cơ bản */
const BASIC_FEATURES = [
  'pos_cashier',
  'pos_kitchen',
  'menu_management',
  'kitchen_display',
  'pos_order_queue',
];
/** Gói Chuyên nghiệp */
const PRO_FEATURES = [
  ...BASIC_FEATURES,
  'inventory',
  'customer_loyalty',
  'online_ordering',
  'voucher',
  'staff_management',
];
/** Gói Doanh nghiệp */
const ENTERPRISE_FEATURES = [
  ...PRO_FEATURES,
  'multi_branch',
  'billiard_table',
  'billiard_session',
  'billiard_reservation',
  'billiard_layout',
  'billiard_report',
  'billiard_order',
  'billiard_pay',
];

export const subscriptionPlanFeatures = [
  { planCode: 'basic', featureCodes: BASIC_FEATURES },
  { planCode: 'pro', featureCodes: PRO_FEATURES },
  { planCode: 'enterprise', featureCodes: ENTERPRISE_FEATURES },
];
