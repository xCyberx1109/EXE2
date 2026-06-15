-- AlterTable: Add inventoryId to order_items (nullable, backward compatible)
ALTER TABLE "order_items" ADD COLUMN "inventory_id" TEXT;
CREATE INDEX IF NOT EXISTS order_items_inventory_id_idx ON "order_items" ("inventory_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
