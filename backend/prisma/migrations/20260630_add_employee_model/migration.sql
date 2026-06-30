-- Add EmployeeStatus enum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- Create employees table (PIN đăng nhập POS thuộc về Employee)
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "pinCode" TEXT NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one employeeCode per branch
CREATE UNIQUE INDEX "employees_accountId_employeeCode_key" ON "employees"("accountId", "employeeCode");
CREATE INDEX "employees_accountId_idx" ON "employees"("accountId");
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- Add foreign key from employees to accounts
ALTER TABLE "employees" ADD CONSTRAINT "employees_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create pos_machine_sessions table (optional: lưu lịch sử nhân viên đăng nhập máy POS)
CREATE TABLE "pos_machine_sessions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "posMachineId" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_machine_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_machine_sessions_employeeId_idx" ON "pos_machine_sessions"("employeeId");
CREATE INDEX "pos_machine_sessions_posMachineId_idx" ON "pos_machine_sessions"("posMachineId");
CREATE INDEX "pos_machine_sessions_isActive_idx" ON "pos_machine_sessions"("isActive");

ALTER TABLE "pos_machine_sessions" ADD CONSTRAINT "pos_machine_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_machine_sessions" ADD CONSTRAINT "pos_machine_sessions_posMachineId_fkey" FOREIGN KEY ("posMachineId") REFERENCES "pos_machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove pinCode from pos_machines (PIN đã chuyển sang Employee)
ALTER TABLE "pos_machines" DROP COLUMN "pinCode";
