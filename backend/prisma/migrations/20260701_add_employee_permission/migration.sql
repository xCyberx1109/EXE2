-- Create EmployeePermission model
CREATE TABLE "employee_permissions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_permissions_pkey" PRIMARY KEY ("id")
);

-- Unique: one permission per employee
CREATE UNIQUE INDEX "employee_permissions_employeeId_permissionId_key" ON "employee_permissions"("employeeId", "permissionId");
CREATE INDEX "employee_permissions_employeeId_idx" ON "employee_permissions"("employeeId");

-- Foreign keys
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_permissions" ADD CONSTRAINT "employee_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
