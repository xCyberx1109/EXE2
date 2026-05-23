-- DropForeignKey
ALTER TABLE orders DROP FOREIGN KEY orders_customerId_fkey;

-- DropForeignKey
ALTER TABLE customers DROP FOREIGN KEY customers_branchId_fkey;

-- AlterTable
ALTER TABLE orders DROP COLUMN customerId;

-- DropTable
DROP TABLE customers;
