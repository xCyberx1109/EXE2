const DEFAULT_TABLE_WIDTH = 180;
const DEFAULT_TABLE_HEIGHT = 120;

export function rectsOverlap(a, b) {
  const aWidth = a.width ?? DEFAULT_TABLE_WIDTH;
  const aHeight = a.height ?? DEFAULT_TABLE_HEIGHT;
  const bWidth = b.width ?? DEFAULT_TABLE_WIDTH;
  const bHeight = b.height ?? DEFAULT_TABLE_HEIGHT;
  const aRight = a.posX + aWidth;
  const aBottom = a.posY + aHeight;
  const bRight = b.posX + bWidth;
  const bBottom = b.posY + bHeight;
  return !(aRight <= b.posX || a.posX >= bRight || aBottom <= b.posY || a.posY >= bBottom);
}

export { DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT };
