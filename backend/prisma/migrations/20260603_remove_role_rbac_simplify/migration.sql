-- Migration: Remove Role model, RolePermission, and roleId from Account
-- Safe production migration for RBAC simplification

-- 1. Drop FK constraint linking accounts to roles
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_roleId_fkey";

-- 2. Drop the roleId column from accounts
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "roleId";

-- 3. Drop the role_permissions join table
DROP TABLE IF EXISTS "role_permissions";

-- 4. Drop the roles table
DROP TABLE IF EXISTS "roles";
