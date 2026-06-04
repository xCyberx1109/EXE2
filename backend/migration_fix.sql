-- ============================================================
-- Fix missing required permissions for account cmpxn8g0n003l0w2000bf7loj
-- ============================================================
-- Required permission IDs:
--   cmpxn80mo00110w207j8e84li (PERMISSION_VIEW)
--   cmpxn80sr00120w20dmjuh7wu (PERMISSION_ASSIGN)
-- ============================================================

-- Insert missing account_permissions, skipping any that already exist
INSERT INTO account_permissions (id, "accountId", "permissionId", allowed, "createdAt")
SELECT
  gen_random_uuid()::text,
  'cmpxn8g0n003l0w2000bf7loj',
  pid,
  true,
  NOW()
FROM (VALUES
  ('cmpxn80mo00110w207j8e84li'),
  ('cmpxn80sr00120w20dmjuh7wu')
) AS t(pid)
WHERE NOT EXISTS (
  SELECT 1 FROM account_permissions ap
  WHERE ap."accountId" = 'cmpxn8g0n003l0w2000bf7loj'
    AND ap."permissionId" = t.pid
);

-- Verify the fix
SELECT
  ap.id,
  ap."accountId",
  ap."permissionId",
  p.code AS permission_code,
  p.name AS permission_name,
  ap.allowed,
  ap."createdAt"
FROM account_permissions ap
JOIN permissions p ON p.id = ap."permissionId"
WHERE ap."accountId" = 'cmpxn8g0n003l0w2000bf7loj'
  AND ap."permissionId" IN (
    'cmpxn80mo00110w207j8e84li',
    'cmpxn80sr00120w20dmjuh7wu'
  );
