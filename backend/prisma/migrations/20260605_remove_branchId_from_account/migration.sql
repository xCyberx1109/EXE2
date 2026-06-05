-- Drop FK constraint on accounts.branchId if it still exists
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_branchId_fkey";

-- Drop index on branchId
DROP INDEX IF EXISTS "accounts_branchId_idx";

-- Drop the branchId column from accounts table
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "branchId";

-- Drop the branches table and all dependent FK constraints
DROP TABLE IF EXISTS "branches" CASCADE;
