-- Drop FK safely
ALTER TABLE "tables"
DROP CONSTRAINT IF EXISTS "tables_branchId_fkey";

-- Drop UNIQUE constraint (NOT index)
ALTER TABLE "tables"
DROP CONSTRAINT IF EXISTS "tables_branchId_tableCode_key";

-- Rename column
ALTER TABLE "tables"
RENAME COLUMN "branchId" TO "accountId";

-- Recreate unique constraint correctly
ALTER TABLE "tables"
ADD CONSTRAINT "tables_accountId_tableCode_key"
UNIQUE ("accountId", "tableCode");

-- Recreate index (optional but OK)
CREATE INDEX IF NOT EXISTS "tables_accountId_idx"
ON "tables"("accountId");