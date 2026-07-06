-- DropForeignKey
ALTER TABLE "menu_items" DROP CONSTRAINT "menu_items_categoryId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "menu_items_branchId_categoryId_idx";

-- AlterTable
ALTER TABLE "menu_items" DROP COLUMN "categoryId";

-- DropTable
DROP TABLE IF EXISTS "categories";
