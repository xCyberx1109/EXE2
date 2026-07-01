import type { MenuItem, InventoryItem } from '../../app/types';

export function buildInventoryMap(items: InventoryItem[]): Map<string, InventoryItem> {
  const map = new Map<string, InventoryItem>();
  if (!Array.isArray(items)) return map;
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
}

export function isItemOutOfStock(
  item: MenuItem,
  inventoryMap: Map<string, InventoryItem>
): boolean {
  if (!item.ingredients || item.ingredients.length === 0) {
    return false;
  }

  for (const recipe of item.ingredients) {
    const stock = inventoryMap.get(recipe.ingredientId);
    if (!stock) continue;
    if (Number(stock.quantity) < Number(recipe.amount)) {
      return true;
    }
  }

  return false;
}
