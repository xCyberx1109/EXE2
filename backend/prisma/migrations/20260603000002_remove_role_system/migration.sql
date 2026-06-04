-- Remove role column from accounts table
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "role";

-- Drop index on role column if it exists
DROP INDEX IF EXISTS "accounts_role_idx";

-- Drop AccountRole enum type
DROP TYPE IF EXISTS "AccountRole";
