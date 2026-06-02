import { revenueService } from '../modules/revenue/revenue.service.js';
import { inventoryService } from '../modules/inventory/inventory.service.js';
import { menuService } from '../modules/menu/menu.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** Tổng quan Dashboard - khớp trang Dashboard.tsx */
export const getDashboard = asyncHandler(async (req, res) => {
  console.log('[Dashboard] user:', { id: req.user?.id, email: req.user?.email, branchId: req.user?.branchId, permissions: req.user?.permissions });

  const [overview, topItems, lowStock, menuItems] = await Promise.all([
    revenueService.getSummary({ range: '30days' }, req.user),
    revenueService.getTopSellingItems(5, req.user),
    inventoryService.getLowStock(req.user),
    menuService.listMenuItems({ available: 'true' }, req.user),
  ]);

  sendSuccess(res, {
    message: 'Lấy dữ liệu dashboard thành công',
    data: {
      stats: {
        totalRevenue: overview.totalRevenue,
        totalProfit: overview.totalProfit,
        totalOrders: overview.totalOrders,
        availableMenuItems: menuItems.length,
        lowStockCount: lowStock.length,
      },
      topMenuItems: topItems,
      lowStockItems: lowStock.slice(0, 5),
    },
  });
});
