/*
  Warnings:

  - You are about to alter the column `unit` on the `ingredients` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(5))`.
  - A unique constraint covering the columns `[branchId,pinCode]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branchId,slug]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[devicePin]` on the table `pos_devices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deviceToken]` on the table `pos_devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `branchId` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `order_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `menu_item_ingredients` DROP FOREIGN KEY `menu_item_ingredients_menuItemId_fkey`;

-- DropForeignKey
ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_orderId_fkey`;

-- DropIndex
DROP INDEX `categories_name_key` ON `categories`;

-- DropIndex
DROP INDEX `categories_slug_key` ON `categories`;

-- DropIndex
DROP INDEX `menu_item_ingredients_menuItemId_fkey` ON `menu_item_ingredients`;

-- AlterTable
ALTER TABLE `accounts` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `pinCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `branches` ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `logoUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `categories` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ingredients` MODIFY `unit` ENUM('KG', 'G', 'LITER', 'ML', 'PIECE') NOT NULL;

-- AlterTable
ALTER TABLE `inventory_transactions` ADD COLUMN `afterQuantity` DECIMAL(10, 2) NULL,
    ADD COLUMN `beforeQuantity` DECIMAL(10, 2) NULL,
    ADD COLUMN `referenceId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('IMPORT', 'EXPORT', 'ADJUST', 'RETURN', 'WASTE') NOT NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `note` TEXT NULL,
    ADD COLUMN `total` DECIMAL(10, 2) NOT NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `customerId` VARCHAR(191) NULL,
    ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `note` TEXT NULL,
    ADD COLUMN `serviceCharge` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `shiftId` VARCHAR(191) NULL,
    ADD COLUMN `source` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'PREPARING', 'SERVED', 'COMPLETED', 'CANCELLED') NOT NULL,
    MODIFY `paymentMethod` ENUM('CASH', 'CARD', 'BANKING', 'E_WALLET', 'OTHER') NULL,
    MODIFY `paymentStatus` ENUM('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    MODIFY `tableNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `pos_devices` ADD COLUMN `currentVersion` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `devicePin` VARCHAR(191) NULL,
    ADD COLUMN `deviceToken` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('ONLINE', 'OFFLINE', 'MAINTENANCE') NOT NULL DEFAULT 'OFFLINE';

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `tier` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_branchId_phone_key`(`branchId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `posDeviceId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endTime` DATETIME(3) NULL,
    `lastActive` DATETIME(3) NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT true,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `openingBalance` DECIMAL(10, 2) NOT NULL,
    `closingBalance` DECIMAL(10, 2) NULL,
    `actualBalance` DECIMAL(10, 2) NULL,
    `note` TEXT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `shifts_branchId_accountId_idx`(`branchId`, `accountId`),
    INDEX `shifts_status_isOnline_idx`(`status`, `isOnline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'BANKING', 'E_WALLET', 'OTHER') NOT NULL,
    `status` ENUM('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED') NOT NULL,
    `transactionId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_orderId_idx`(`orderId`),
    INDEX `payments_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `posDeviceId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `details` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `activity_logs_accountId_createdAt_idx`(`accountId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `accounts_branchId_role_idx` ON `accounts`(`branchId`, `role`);

-- CreateIndex
CREATE INDEX `accounts_active_idx` ON `accounts`(`active`);

-- CreateIndex
CREATE UNIQUE INDEX `accounts_branchId_pinCode_key` ON `accounts`(`branchId`, `pinCode`);

-- CreateIndex
CREATE INDEX `categories_branchId_idx` ON `categories`(`branchId`);

-- CreateIndex
CREATE UNIQUE INDEX `categories_branchId_slug_key` ON `categories`(`branchId`, `slug`);

-- CreateIndex
CREATE INDEX `inventory_transactions_branchId_ingredientId_idx` ON `inventory_transactions`(`branchId`, `ingredientId`);

-- CreateIndex
CREATE INDEX `menu_items_branchId_categoryId_idx` ON `menu_items`(`branchId`, `categoryId`);

-- CreateIndex
CREATE INDEX `orders_branchId_createdAt_idx` ON `orders`(`branchId`, `createdAt`);

-- CreateIndex
CREATE INDEX `orders_shiftId_idx` ON `orders`(`shiftId`);

-- CreateIndex
CREATE INDEX `orders_branchId_status_idx` ON `orders`(`branchId`, `status`);

-- CreateIndex
CREATE INDEX `orders_branchId_paymentStatus_idx` ON `orders`(`branchId`, `paymentStatus`);

-- CreateIndex
CREATE UNIQUE INDEX `pos_devices_devicePin_key` ON `pos_devices`(`devicePin`);

-- CreateIndex
CREATE UNIQUE INDEX `pos_devices_deviceToken_key` ON `pos_devices`(`deviceToken`);

-- CreateIndex
CREATE INDEX `pos_devices_status_idx` ON `pos_devices`(`status`);

-- CreateIndex
CREATE INDEX `pos_devices_active_idx` ON `pos_devices`(`active`);

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_posDeviceId_fkey` FOREIGN KEY (`posDeviceId`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `ingredients` RENAME INDEX `ingredients_branchId_fkey` TO `ingredients_branchId_idx`;

-- RenameIndex
ALTER TABLE `order_items` RENAME INDEX `order_items_orderId_fkey` TO `order_items_orderId_idx`;

-- RenameIndex
ALTER TABLE `pos_devices` RENAME INDEX `pos_devices_branchId_fkey` TO `pos_devices_branchId_idx`;
