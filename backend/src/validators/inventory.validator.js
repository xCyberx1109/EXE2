import { body, param, query } from 'express-validator';

// Loại giao dịch được phép chọn khi nhập kho / xuất kho thủ công.
// Phải là tập con của enum InventoryTransactionType trong schema.prisma.
export const STOCK_IN_TYPES = ['IMPORT', 'RETURN', 'ADJUST'];
export const STOCK_OUT_TYPES = ['OUT', 'WASTE', 'RETURN', 'ADJUST'];
// Các loại giao dịch bắt buộc phải có lý do (note) vì ảnh hưởng tới đối soát/thất thoát.
export const REASON_REQUIRED_TYPES = ['WASTE', 'ADJUST'];

export const ingredientRules = [
  body('name').trim().notEmpty().withMessage('Tên nguyên liệu là bắt buộc'),
  body('unit').trim().notEmpty().withMessage('Đơn vị là bắt buộc'),
  body('quantity').optional().isFloat({ min: 0 }),
  body('price').isFloat({ min: 0 }).withMessage('Đơn giá phải >= 0'),
  body('supplier').trim().notEmpty().withMessage('Nhà cung cấp là bắt buộc'),
  body('warningQuantity').optional().isFloat({ min: 0 }).withMessage('Ngưỡng cảnh báo phải >= 0'),
];

export const ingredientUpdateRules = [
  body('name').optional().trim().notEmpty(),
  body('unit').optional().trim().notEmpty(),
  body('quantity').optional().isFloat({ min: 0 }),
  body('price').optional().isFloat({ min: 0 }),
  body('supplier').optional().trim().notEmpty(),
  body('warningQuantity').optional().isFloat({ min: 0 }),
  // Lý do điều chỉnh: hiện để optional vì frontend edit-form chưa có ô nhập lý do.
  // Service layer vẫn ghi lại lịch sử InventoryTransaction(type=ADJUST) khi quantity thực sự đổi.
  body('note').optional({ values: 'falsy' }).trim(),
];

function buildStockTransactionRules(allowedTypes) {
  return [
    body('quantity').isFloat({ gt: 0 }).withMessage('Số lượng phải > 0'),
    body('type')
      .optional({ values: 'falsy' })
      .trim()
      .customSanitizer((value) => (typeof value === 'string' ? value.toUpperCase() : value))
      .isIn(allowedTypes)
      .withMessage(`Loại giao dịch không hợp lệ. Cho phép: ${allowedTypes.join(', ')}`),
    body('note').optional({ values: 'falsy' }).trim(),
    body('note').custom((value, { req }) => {
      const type = (req.body.type || allowedTypes[0]).toString().trim().toUpperCase();
      if (REASON_REQUIRED_TYPES.includes(type) && !value) {
        throw new Error('Vui lòng nhập lý do cho loại giao dịch này (hao hụt/điều chỉnh)');
      }
      return true;
    }),
  ];
}

export const stockInRules = buildStockTransactionRules(STOCK_IN_TYPES);
export const stockOutRules = buildStockTransactionRules(STOCK_OUT_TYPES);

export const ingredientIdParam = [param('id').isString().notEmpty().withMessage('ID nguyên liệu không hợp lệ')];

export const inventoryListQuery = [
  query('search').optional().trim(),
  query('lowStock').optional().isIn(['true', 'false']),
  query('status').optional().trim(),
  query('includeInactive').optional().isIn(['true', 'false']),
];
