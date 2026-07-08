export const APP_NAME = "POSitive";

export const INGREDIENT_UNITS = [
  { value: 'KG', label: 'kg' },
  { value: 'LITER', label: 'lít' },
  { value: 'PIECE', label: 'cái' },
  { value: 'PACK', label: 'gói' },
  { value: 'BOX', label: 'hộp' },
  { value: 'BOTTLE', label: 'chai' },
  { value: 'CAN', label: 'lon' },
] as const;

export function getUnitLabel(unit: string): string {
  return INGREDIENT_UNITS.find(u => u.value === unit)?.label || unit;
}

// Phải khớp với STOCK_IN_TYPES trong backend/src/validators/inventory.validator.js
export const STOCK_IN_TYPES = [
  { value: 'IMPORT', label: 'Nhập hàng từ nhà cung cấp' },
  { value: 'RETURN', label: 'Khách/chi nhánh trả hàng' },
  { value: 'ADJUST', label: 'Điều chỉnh tăng (kiểm kho phát hiện dư)' },
] as const;

// Phải khớp với STOCK_OUT_TYPES trong backend/src/validators/inventory.validator.js
export const STOCK_OUT_TYPES = [
  { value: 'OUT', label: 'Xuất kho thông thường' },
  { value: 'WASTE', label: 'Hao hụt / hủy hàng' },
  { value: 'RETURN', label: 'Trả hàng cho nhà cung cấp' },
  { value: 'ADJUST', label: 'Điều chỉnh giảm (kiểm kho phát hiện thiếu)' },
] as const;

// Các loại giao dịch bắt buộc phải nhập lý do — phải khớp REASON_REQUIRED_TYPES ở backend.
export const REASON_REQUIRED_STOCK_TYPES: string[] = ['WASTE', 'ADJUST'];

// Nhãn hiển thị cho toàn bộ enum InventoryTransactionType (dùng ở màn hình lịch sử giao dịch,
// bao gồm cả loại tự động sinh ra khi bán hàng: OUT/SALE).
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  IMPORT: 'Nhập kho',
  OUT: 'Xuất kho',
  ADJUST: 'Điều chỉnh',
  RETURN: 'Trả hàng',
  WASTE: 'Hao hụt / hủy hàng',
  AUDIT: 'Kiểm kho',
  SALE: 'Bán hàng trực tiếp',
};
