import { revenueService } from '../modules/revenue/revenue.service.js';
import { inventoryService } from '../modules/inventory/inventory.service.js';
import { menuService } from '../modules/menu/menu.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

/** Tổng quan Dashboard - khớp trang Dashboard.tsx */
export const getDashboard = asyncHandler(async (_req, res) => {
  const [overview, topItems, lowStock, menuItems] = await Promise.all([
    revenueService.getSummary({ range: '30days' }),
    revenueService.getTopSellingItems(5),
    inventoryService.getLowStock(),
    menuService.listMenuItems({ available: 'true' }),
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
