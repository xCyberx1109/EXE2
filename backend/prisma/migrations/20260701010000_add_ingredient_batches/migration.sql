-- Them tinh nang theo doi ton kho theo lo + han su dung (FEFO)

-- 1. Enum trang thai lo hang
DO $$ BEGIN
    CREATE TYPE "IngredientBatchStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Bang luu tung lo nhap kho
CREATE TABLE IF NOT EXISTS "ingredient_batches" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "initialQuantity" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "expiryDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "IngredientBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredient_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ingredient_batches_ingredientId_status_expiryDate_idx" ON "ingredient_batches"("ingredientId", "status", "expiryDate");
CREATE INDEX IF NOT EXISTS "ingredient_batches_accountId_idx" ON "ingredient_batches"("accountId");

DO $$ BEGIN
    ALTER TABLE "ingredient_batches" ADD CONSTRAINT "ingredient_batches_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ingredient_batches" ADD CONSTRAINT "ingredient_batches_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Backfill: nguyen lieu da co san so luong truoc khi co tinh nang nay -> tao 1 lo
--    "LEGACY-INIT" khong ro han su dung, de tong batch luon khop voi Ingredient.quantity.
--    Idempotent: chi chay cho ingredient nao CHUA co batch nao.
INSERT INTO "ingredient_batches" (
    "id", "accountId", "ingredientId", "batchCode", "quantity", "initialQuantity",
    "unitCost", "expiryDate", "receivedDate", "status", "note", "createdBy", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    i."accountId",
    i."id",
    'LEGACY-INIT',
    i."quantity",
    i."quantity",
    i."price",
    NULL,
    i."createdAt",
    CASE WHEN i."quantity" > 0 THEN 'ACTIVE' ELSE 'DEPLETED' END,
    'Tự động tạo khi triển khai tính năng theo dõi lô/hạn sử dụng, không rõ hạn dùng thực tế.',
    i."accountId",
    NOW(),
    NOW()
FROM "ingredients" i
WHERE NOT EXISTS (SELECT 1 FROM "ingredient_batches" b WHERE b."ingredientId" = i."id");
