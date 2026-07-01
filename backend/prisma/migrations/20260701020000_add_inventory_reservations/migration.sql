-- Them bang giu cho tam thoi ton kho khi tao/sua don hang, ngan 2 don cung luc
-- ban qua so hang thuc te dang con (rieng biet voi Ingredient.quantity, khong anh huong
-- du lieu cu -- khong can backfill vi la du lieu tam thoi theo vong doi don hang).

CREATE TABLE IF NOT EXISTS "inventory_reservations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_reservations_ingredientId_idx" ON "inventory_reservations"("ingredientId");
CREATE INDEX IF NOT EXISTS "inventory_reservations_orderId_idx" ON "inventory_reservations"("orderId");

DO $$ BEGIN
    ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
