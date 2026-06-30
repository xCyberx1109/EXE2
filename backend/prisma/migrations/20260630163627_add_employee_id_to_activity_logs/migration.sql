-- Add employeeId column
ALTER TABLE "activity_logs" ADD COLUMN "employeeId" TEXT;

-- Add foreign key constraint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old index on branchId
DROP INDEX IF EXISTS "activity_logs_branchId_createdAt_idx";

-- Create new index on employeeId
CREATE INDEX "activity_logs_employeeId_createdAt_idx" ON "activity_logs"("employeeId", "createdAt");

-- Drop branchId column
ALTER TABLE "activity_logs" DROP COLUMN "branchId";
