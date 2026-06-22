const DEFAULT_TABLE_WIDTH_PERCENT = 10;
const DEFAULT_TABLE_HEIGHT_PERCENT = 12;

export function rectsOverlap(a, b) {
  const aWidth = a.width ?? DEFAULT_TABLE_WIDTH_PERCENT;
  const aHeight = a.height ?? DEFAULT_TABLE_HEIGHT_PERCENT;
  const bWidth = b.width ?? DEFAULT_TABLE_WIDTH_PERCENT;
  const bHeight = b.height ?? DEFAULT_TABLE_HEIGHT_PERCENT;
  const aRight = a.posX + aWidth;
  const aBottom = a.posY + aHeight;
  const bRight = b.posX + bWidth;
  const bBottom = b.posY + bHeight;
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

export function findAvailablePosition(existingTables, reqWidth = DEFAULT_TABLE_WIDTH_PERCENT, reqHeight = DEFAULT_TABLE_HEIGHT_PERCENT) {
  const stepX = reqWidth + 2;
  const stepY = reqHeight + 2;

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const posX = 1 + col * stepX;
      const posY = 1 + row * stepY;
      const candidate = { posX, posY, width: reqWidth, height: reqHeight };
      const overlap = existingTables.some(t => rectsOverlap(candidate, t));
      if (!overlap) {
        return { x: posX, y: posY };
      }
    }
  }
  return { x: 1, y: 1 };
}

export { DEFAULT_TABLE_WIDTH_PERCENT, DEFAULT_TABLE_HEIGHT_PERCENT };
