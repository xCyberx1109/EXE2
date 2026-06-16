-- AlterTable: Add hourlyRate to tables
ALTER TABLE "tables" ADD COLUMN "hourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
