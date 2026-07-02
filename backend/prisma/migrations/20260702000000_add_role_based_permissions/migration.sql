-- Them tang Role tai su dung duoc cho Employee (nhan vien dang nhap PIN tren may POS).
-- Truoc day quyen cua Employee tinh thuan theo loai may POS ho dang nhap vao, khong
-- theo tung ca nhan - tang nay cho phep gan quyen theo dung nguoi, giao (intersection)
-- voi quyen theo thiet bi khi tinh hieu luc cuoi cung.

CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_accountId_name_key" ON "roles"("accountId", "name");
CREATE INDEX IF NOT EXISTS "roles_accountId_idx" ON "roles"("accountId");

CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "role_permissions_roleId_idx" ON "role_permissions"("roleId");

DO $$ BEGIN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Employee.roleId: nullable de tuong thich nguoc, backfill sau bang script rieng
-- (backfill-employee-roles.js). Xoa Role thi SET NULL, khong chan viec xoa.
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
CREATE INDEX IF NOT EXISTS "employees_roleId_idx" ON "employees"("roleId");

DO $$ BEGIN
    ALTER TABLE "employees" ADD CONSTRAINT "employees_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- device_sessions.employee_id: biet chinh xac nhan vien nao dang hoat dong tren 1 phien
-- thiet bi (truoc day hoan toan khong luu, thiet bi va nguoi dung bi coi la mot).
ALTER TABLE "device_sessions" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;
CREATE INDEX IF NOT EXISTS "device_sessions_employee_id_idx" ON "device_sessions"("employee_id");
