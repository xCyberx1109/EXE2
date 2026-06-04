-- Cleanup RBAC schema drift
-- Removes UserPermission model, adds missing Shift/PosDevice/Order fields

-- 1. Drop user_permissions table
DROP TABLE IF EXISTS "user_permissions";

-- 2. Ensure roles and role_permissions are dropped (safe if already dropped)
DROP TABLE IF EXISTS "role_permissions";
DROP TABLE IF EXISTS "roles";

-- 3. Ensure roleId is removed from accounts (safe if already removed)
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_roleId_fkey";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "roleId";

-- 4. Add PAID to PaymentStatus enum
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAID';

-- 5. Add missing columns to shifts
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "lastActive" TIMESTAMPTZ;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "cardSales" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "otherSales" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "totalOrders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- 6. Add setup_pin_expires_at to pos_devices
ALTER TABLE "pos_devices" ADD COLUMN IF NOT EXISTS "setup_pin_expires_at" TIMESTAMPTZ;

-- 7. Add source to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- 8. Create indexes for new columns
CREATE INDEX IF NOT EXISTS "shifts_is_online_idx" ON "shifts"("isOnline");
CREATE INDEX IF NOT EXISTS "shifts_last_active_idx" ON "shifts"("lastActive");
