-- DropForeignKey
ALTER TABLE `activity_logs` DROP FOREIGN KEY `activity_logs_accountId_fkey`;

-- DropForeignKey
ALTER TABLE `shifts` DROP FOREIGN KEY `shifts_accountId_fkey`;

-- DropIndex
DROP INDEX `shifts_accountId_fkey` ON `shifts`;

-- AlterTable
ALTER TABLE `activity_logs` MODIFY `accountId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `shifts` MODIFY `accountId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
