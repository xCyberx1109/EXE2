/*
  Warnings:

  - You are about to drop the column `created_at` on the `branches` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `branches` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `branch_id` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `last_updated` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `min_quantity` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `ingredients` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `ingredients` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,3)` to `Decimal(10,2)`.
  - You are about to alter the column `price` on the `ingredients` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to drop the column `created_at` on the `inventory_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `ingredient_id` on the `inventory_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `inventory_transactions` table. All the data in the column will be lost.
  - The values [IN,OUT] on the enum `inventory_transactions_type` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `quantity` on the `inventory_transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,3)` to `Decimal(10,2)`.
  - You are about to drop the column `ingredient_id` on the `menu_item_ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `menu_item_id` on the `menu_item_ingredients` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `menu_item_ingredients` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,3)` to `Decimal(10,2)`.
  - You are about to drop the column `category_id` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `menu_items` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `menu_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to alter the column `cost` on the `menu_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to drop the column `menu_item_id` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `order_id` on the `order_items` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to alter the column `cost` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to drop the column `branch_id` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `completed_at` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `order_number` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `payment_method` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `pos_device_id` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `table_number` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `orders` table. All the data in the column will be lost.
  - You are about to alter the column `subtotal` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to alter the column `tax` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to alter the column `total` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to alter the column `cost` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to alter the column `profit` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(10,2)`.
  - You are about to drop the column `branch_id` on the `pos_devices` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `pos_devices` table. All the data in the column will be lost.
  - You are about to drop the column `device_code` on the `pos_devices` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `pos_devices` table. All the data in the column will be lost.
  - You are about to alter the column `type` on the `pos_devices` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `Enum(EnumId(3))`.
  - You are about to drop the `revenue_reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shifts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[orderNumber]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deviceCode]` on the table `pos_devices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `plan` to the `branches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subscriptionEnd` to the `branches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subscriptionStart` to the `branches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subscriptionStatus` to the `branches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `branches` table without a default value. This is not possible if the table is not empty.
  - Made the column `address` on table `branches` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `branches` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minQuantity` to the `ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `inventory_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `inventory_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredientId` to the `inventory_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ingredientId` to the `menu_item_ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `menuItemId` to the `menu_item_ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `menu_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryId` to the `menu_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `menu_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `menuItemId` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderId` to the `order_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderNumber` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderType` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentMethod` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentStatus` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `posDeviceId` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `pos_devices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceCode` to the `pos_devices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `pos_devices` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `ingredients` DROP FOREIGN KEY `ingredients_branch_id_fkey`;

-- DropForeignKey
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY `inventory_transactions_ingredient_id_fkey`;

-- DropForeignKey
ALTER TABLE `inventory_transactions` DROP FOREIGN KEY `inventory_transactions_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `menu_item_ingredients` DROP FOREIGN KEY `menu_item_ingredients_ingredient_id_fkey`;

-- DropForeignKey
ALTER TABLE `menu_item_ingredients` DROP FOREIGN KEY `menu_item_ingredients_menu_item_id_fkey`;

-- DropForeignKey
ALTER TABLE `menu_items` DROP FOREIGN KEY `menu_items_category_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_menu_item_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `orders` DROP FOREIGN KEY `orders_branch_id_fkey`;

-- DropForeignKey
ALTER TABLE `orders` DROP FOREIGN KEY `orders_pos_device_id_fkey`;

-- DropForeignKey
ALTER TABLE `orders` DROP FOREIGN KEY `orders_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `pos_devices` DROP FOREIGN KEY `pos_devices_branch_id_fkey`;

-- DropForeignKey
ALTER TABLE `shifts` DROP FOREIGN KEY `shifts_pos_device_id_fkey`;

-- DropForeignKey
ALTER TABLE `shifts` DROP FOREIGN KEY `shifts_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_branch_id_fkey`;

-- DropIndex
DROP INDEX `ingredients_branch_id_idx` ON `ingredients`;

-- DropIndex
DROP INDEX `ingredients_branch_id_name_key` ON `ingredients`;

-- DropIndex
DROP INDEX `inventory_transactions_created_at_idx` ON `inventory_transactions`;

-- DropIndex
DROP INDEX `inventory_transactions_ingredient_id_idx` ON `inventory_transactions`;

-- DropIndex
DROP INDEX `inventory_transactions_user_id_fkey` ON `inventory_transactions`;

-- DropIndex
DROP INDEX `menu_item_ingredients_ingredient_id_fkey` ON `menu_item_ingredients`;

-- DropIndex
DROP INDEX `menu_item_ingredients_menu_item_id_ingredient_id_key` ON `menu_item_ingredients`;

-- DropIndex
DROP INDEX `menu_items_available_idx` ON `menu_items`;

-- DropIndex
DROP INDEX `menu_items_category_id_idx` ON `menu_items`;

-- DropIndex
DROP INDEX `order_items_menu_item_id_idx` ON `order_items`;

-- DropIndex
DROP INDEX `order_items_order_id_idx` ON `order_items`;

-- DropIndex
DROP INDEX `orders_branch_id_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_created_at_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_order_number_key` ON `orders`;

-- DropIndex
DROP INDEX `orders_pos_device_id_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_status_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_table_number_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_user_id_fkey` ON `orders`;

-- DropIndex
DROP INDEX `pos_devices_branch_id_idx` ON `pos_devices`;

-- DropIndex
DROP INDEX `pos_devices_device_code_key` ON `pos_devices`;

-- AlterTable
ALTER TABLE `branches` DROP COLUMN `created_at`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `features` JSON NULL,
    ADD COLUMN `plan` ENUM('BASIC', 'PRO', 'ENTERPRISE') NOT NULL,
    ADD COLUMN `subscriptionEnd` DATETIME(3) NOT NULL,
    ADD COLUMN `subscriptionStart` DATETIME(3) NOT NULL,
    ADD COLUMN `subscriptionStatus` ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED') NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `address` VARCHAR(191) NOT NULL,
    MODIFY `phone` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `categories` DROP COLUMN `created_at`,
    DROP COLUMN `deleted_at`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `ingredients` DROP COLUMN `branch_id`,
    DROP COLUMN `created_at`,
    DROP COLUMN `deleted_at`,
    DROP COLUMN `last_updated`,
    DROP COLUMN `min_quantity`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `available` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `lastUpdated` DATETIME(3) NULL,
    ADD COLUMN `minQuantity` DECIMAL(10, 2) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `quantity` DECIMAL(10, 2) NOT NULL,
    MODIFY `price` DECIMAL(10, 2) NOT NULL,
    MODIFY `supplier` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `inventory_transactions` DROP COLUMN `created_at`,
    DROP COLUMN `ingredient_id`,
    DROP COLUMN `user_id`,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL,
    ADD COLUMN `ingredientId` VARCHAR(191) NOT NULL,
    MODIFY `type` ENUM('IMPORT', 'EXPORT', 'ADJUST') NOT NULL,
    MODIFY `quantity` DECIMAL(10, 2) NOT NULL;

-- AlterTable
ALTER TABLE `menu_item_ingredients` DROP COLUMN `ingredient_id`,
    DROP COLUMN `menu_item_id`,
    ADD COLUMN `ingredientId` VARCHAR(191) NOT NULL,
    ADD COLUMN `menuItemId` VARCHAR(191) NOT NULL,
    MODIFY `amount` DECIMAL(10, 2) NOT NULL;

-- AlterTable
ALTER TABLE `menu_items` DROP COLUMN `category_id`,
    DROP COLUMN `created_at`,
    DROP COLUMN `deleted_at`,
    DROP COLUMN `image_url`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL,
    ADD COLUMN `categoryId` VARCHAR(191) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `imageUrl` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `price` DECIMAL(10, 2) NOT NULL,
    MODIFY `cost` DECIMAL(10, 2) NOT NULL;

-- AlterTable
ALTER TABLE `order_items` DROP COLUMN `menu_item_id`,
    DROP COLUMN `order_id`,
    ADD COLUMN `menuItemId` VARCHAR(191) NOT NULL,
    ADD COLUMN `orderId` VARCHAR(191) NOT NULL,
    MODIFY `price` DECIMAL(10, 2) NOT NULL,
    MODIFY `cost` DECIMAL(10, 2) NOT NULL;

-- AlterTable
ALTER TABLE `orders` DROP COLUMN `branch_id`,
    DROP COLUMN `completed_at`,
    DROP COLUMN `created_at`,
    DROP COLUMN `order_number`,
    DROP COLUMN `payment_method`,
    DROP COLUMN `pos_device_id`,
    DROP COLUMN `table_number`,
    DROP COLUMN `user_id`,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL,
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `createdBy` VARCHAR(191) NOT NULL,
    ADD COLUMN `orderNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `orderType` ENUM('DINE_IN', 'TAKE_AWAY', 'DELIVERY') NOT NULL,
    ADD COLUMN `paymentMethod` ENUM('CASH', 'CARD', 'BANKING', 'E_WALLET') NOT NULL,
    ADD COLUMN `paymentStatus` ENUM('UNPAID', 'PAID', 'REFUNDED') NOT NULL,
    ADD COLUMN `posDeviceId` VARCHAR(191) NOT NULL,
    ADD COLUMN `tableNumber` INTEGER NULL,
    ALTER COLUMN `status` DROP DEFAULT,
    MODIFY `subtotal` DECIMAL(10, 2) NOT NULL,
    MODIFY `tax` DECIMAL(10, 2) NOT NULL,
    MODIFY `total` DECIMAL(10, 2) NOT NULL,
    MODIFY `cost` DECIMAL(10, 2) NOT NULL,
    MODIFY `profit` DECIMAL(10, 2) NOT NULL;

-- AlterTable
ALTER TABLE `pos_devices` DROP COLUMN `branch_id`,
    DROP COLUMN `created_at`,
    DROP COLUMN `device_code`,
    DROP COLUMN `updated_at`,
    ADD COLUMN `branchId` VARCHAR(191) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deviceCode` VARCHAR(191) NOT NULL,
    ADD COLUMN `lastActive` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `type` ENUM('CASHIER', 'TABLET', 'KIOSK') NOT NULL;

-- DropTable
DROP TABLE `revenue_reports`;

-- DropTable
DROP TABLE `shifts`;

-- DropTable
DROP TABLE `users`;

-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'CASHIER', 'STAFF') NOT NULL,
    `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `accounts_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `orders_orderNumber_key` ON `orders`(`orderNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `pos_devices_deviceCode_key` ON `pos_devices`(`deviceCode`);

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_devices` ADD CONSTRAINT `pos_devices_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_posDeviceId_fkey` FOREIGN KEY (`posDeviceId`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
