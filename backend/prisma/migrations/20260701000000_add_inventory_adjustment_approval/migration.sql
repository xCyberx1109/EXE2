-- Them tinh nang phe duyet dieu chinh/hao hut ton kho lon

-- 1. Nguong gia tri (VND) tu do WASTE/ADJUST phai cho phe duyet, cau hinh rieng theo account
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "inventoryApprovalThreshold" DECIMAL(12,2) NOT NULL DEFAULT 500000;

-- 2. Enum trang thai yeu cau dieu chinh
DO $$ BEGIN
    CREATE TYPE "InventoryAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Bang luu yeu cau dieu chinh/hao hut cho duyet
CREATE TABLE IF NOT EXISTS "inventory_adjustment_requests" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "beforeQuantity" DECIMAL(10,2) NOT NULL,
    "afterQuantity" DECIMAL(10,2) NOT NULL,
    "estimatedValue" DECIMAL(14,2) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "InventoryAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_adjustment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_adjustment_requests_accountId_status_idx" ON "inventory_adjustment_requests"("accountId", "status");
CREATE INDEX IF NOT EXISTS "inventory_adjustment_requests_ingredientId_idx" ON "inventory_adjustment_requests"("ingredientId");

DO $$ BEGIN
    ALTER TABLE "inventory_adjustment_requests" ADD CONSTRAINT "inventory_adjustment_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_adjustment_requests" ADD CONSTRAINT "inventory_adjustment_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_adjustment_requests" ADD CONSTRAINT "inventory_adjustment_requests_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Permission moi
INSERT INTO "permissions" ("id", "code", "name", "module", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'INVENTORY_APPROVE', 'Phê duyệt điều chỉnh/hao hụt tồn kho lớn', 'inventory', false, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'INVENTORY_APPROVE');
