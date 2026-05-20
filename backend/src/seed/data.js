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
  { name: 'Thịt Bò', unit: 'kg', quantity: 45, minQuantity: 20, price: 280000, supplier: 'Công ty Thực Phẩm A' },
  { name: 'Gạo', unit: 'kg', quantity: 150, minQuantity: 50, price: 18000, supplier: 'Công ty Lương Thực B' },
  { name: 'Rau Sống', unit: 'kg', quantity: 15, minQuantity: 10, price: 25000, supplier: 'Nông Trại C' },
  { name: 'Cà Phê Hạt', unit: 'kg', quantity: 12, minQuantity: 5, price: 350000, supplier: 'Công ty Cà Phê D' },
  { name: 'Đường', unit: 'kg', quantity: 30, minQuantity: 15, price: 22000, supplier: 'Công ty Thực Phẩm A' },
  { name: 'Sữa Tươi', unit: 'lít', quantity: 8, minQuantity: 10, price: 35000, supplier: 'Công ty Sữa E' },
  { name: 'Bánh Mì', unit: 'chiếc', quantity: 50, minQuantity: 30, price: 8000, supplier: 'Tiệm Bánh F' },
  { name: 'Chanh', unit: 'kg', quantity: 18, minQuantity: 8, price: 15000, supplier: 'Nông Trại C' },
];

/** Báo cáo doanh thu 14 ngày - khớp revenueRecords */
export const revenueReports = [
  { date: '2026-03-01', orderCount: 85, revenue: 4250000, cost: 2125000, profit: 2125000 },
  { date: '2026-03-02', orderCount: 92, revenue: 4600000, cost: 2300000, profit: 2300000 },
  { date: '2026-03-03', orderCount: 78, revenue: 3900000, cost: 1950000, profit: 1950000 },
  { date: '2026-03-04', orderCount: 105, revenue: 5250000, cost: 2625000, profit: 2625000 },
  { date: '2026-03-05', orderCount: 98, revenue: 4900000, cost: 2450000, profit: 2450000 },
  { date: '2026-03-06', orderCount: 88, revenue: 4400000, cost: 2200000, profit: 2200000 },
  { date: '2026-03-07', orderCount: 95, revenue: 4750000, cost: 2375000, profit: 2375000 },
  { date: '2026-03-08', orderCount: 110, revenue: 5500000, cost: 2750000, profit: 2750000 },
  { date: '2026-03-09', orderCount: 102, revenue: 5100000, cost: 2550000, profit: 2550000 },
  { date: '2026-03-10', orderCount: 89, revenue: 4450000, cost: 2225000, profit: 2225000 },
  { date: '2026-03-11', orderCount: 93, revenue: 4650000, cost: 2325000, profit: 2325000 },
  { date: '2026-03-12', orderCount: 97, revenue: 4850000, cost: 2425000, profit: 2425000 },
  { date: '2026-03-13', orderCount: 108, revenue: 5400000, cost: 2700000, profit: 2700000 },
  { date: '2026-03-14', orderCount: 115, revenue: 5750000, cost: 2875000, profit: 2875000 },
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
