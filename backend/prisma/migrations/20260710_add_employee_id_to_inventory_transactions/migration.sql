-- AlterTable: Add employeeId column to inventory_transactions
ALTER TABLE "inventory_transactions" ADD COLUMN "employeeId" TEXT;

-- CreateIndex: Index on employeeId
CREATE INDEX "inventory_transactions_employeeId_idx" ON "inventory_transactions"("employeeId");

-- AddForeignKey: Link employeeId to employees table
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
