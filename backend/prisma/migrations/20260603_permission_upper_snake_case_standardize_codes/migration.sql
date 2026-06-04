-- Standardize permission codes (UPPER_SNAKE_CASE) and migrate account_permissions
-- Legacy codes to remove:
--   order:view, order:create, order:update, order:delete
--   menu:view, menu:create, menu:update, menu:delete
--   inventory:view, inventory:create, inventory:update, inventory:delete
--   customer:view, customer:create, customer:update, customer:delete

DO $$
BEGIN
  -- 1) Ensure target permissions exist
  -- Orders
  INSERT INTO "permissions" ("id","code","name","description","module","isSystem","createdAt","updatedAt","deletedAt")
  SELECT
    COALESCE(p.id, gen_random_uuid()::text),
    v.code,
    v.name,
    NULL,
    v.module,
    v.isSystem,
    NOW(),
    NOW(),
    NULL
  FROM (VALUES
    ('ORDER_VIEW','Xem đơn hàng','orders',false),
    ('ORDER_MANAGE','Quản lý đơn hàng','orders',false),
    ('MENU_VIEW','Xem thực đơn','menu',false),
    ('MENU_MANAGE','Quản lý thực đơn','menu',false),
    ('INVENTORY_VIEW','Xem tồn kho','inventory',false),
    ('INVENTORY_MANAGE','Quản lý tồn kho','inventory',false),
    ('CUSTOMER_VIEW','Xem khách hàng','customer',false),
    ('CUSTOMER_MANAGE','Quản lý khách hàng','customer',false)
  ) AS v(code,name,module,isSystem)
  LEFT JOIN "permissions" p ON p.code = v.code
  WHERE p.code IS NULL;

EXCEPTION WHEN undefined_function THEN
  -- gen_random_uuid() might not exist; fall back to letting Prisma/default handle IDs
  -- If your environment doesn't allow this, you can run seed afterwards to insert these permissions.
  RAISE NOTICE 'gen_random_uuid not available; ensure target permissions exist via seed.';
END $$;

-- 2) Migrate account_permissions from legacy permissionId to standardized permissionId
WITH mapping(old_code, new_code) AS (
  VALUES
    -- orders
    ('order:view','ORDER_VIEW'),
    ('order:create','ORDER_MANAGE'),
    ('order:update','ORDER_MANAGE'),
    ('order:delete','ORDER_MANAGE'),

    -- menu
    ('menu:view','MENU_VIEW'),
    ('menu:create','MENU_MANAGE'),
    ('menu:update','MENU_MANAGE'),
    ('menu:delete','MENU_MANAGE'),

    -- inventory
    ('inventory:view','INVENTORY_VIEW'),
    ('inventory:create','INVENTORY_MANAGE'),
    ('inventory:update','INVENTORY_MANAGE'),
    ('inventory:delete','INVENTORY_MANAGE'),

    -- customer
    ('customer:view','CUSTOMER_VIEW'),
    ('customer:create','CUSTOMER_MANAGE'),
    ('customer:update','CUSTOMER_MANAGE'),
    ('customer:delete','CUSTOMER_MANAGE')
)
UPDATE "account_permissions" ap
SET "permissionId" = newp.id
FROM "permissions" oldp
JOIN mapping m ON m.old_code = oldp.code
JOIN "permissions" newp ON newp.code = m.new_code
WHERE ap."permissionId" = oldp.id;

-- 3) Merge duplicates in account_permissions (keep the smallest id)
WITH ranked AS (
  SELECT
    ap.*,
    ROW_NUMBER() OVER (PARTITION BY ap."accountId", ap."permissionId" ORDER BY ap.id) AS rn
  FROM "account_permissions" ap
)
DELETE FROM ranked
WHERE rn > 1;

-- 4) Delete legacy permissions
DELETE FROM "permissions"
WHERE code IN (
  'order:view','order:create','order:update','order:delete',
  'menu:view','menu:create','menu:update','menu:delete',
  'inventory:view','inventory:create','inventory:update','inventory:delete',
  'customer:view','customer:create','customer:update','customer:delete'
);
