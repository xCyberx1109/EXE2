/*
  Warnings:

  - You are about to alter the column `role` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `Enum(EnumId(0))`.
  - A unique constraint covering the columns `[branch_id,name]` on the table `ingredients` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `branch_id` to the `ingredients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `ingredients_name_key` ON `ingredients`;

-- AlterTable
ALTER TABLE `categories` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `ingredients` ADD COLUMN `branch_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `menu_items` ADD COLUMN `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `branch_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `pos_device_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `branch_id` VARCHAR(191) NULL,
    MODIFY `role` ENUM('ADMIN', 'BRANCH') NOT NULL DEFAULT 'BRANCH';

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_devices` (
    `id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `device_code` VARCHAR(191) NOT NULL,
    `type` ENUM('CASHIER', 'KIOSK', 'MOBILE', 'KITCHEN') NOT NULL DEFAULT 'CASHIER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_devices_device_code_key`(`device_code`),
    INDEX `pos_devices_branch_id_idx`(`branch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `pos_device_id` VARCHAR(191) NOT NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `opening_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `closing_cash` DECIMAL(12, 2) NULL,

    INDEX `shifts_pos_device_id_idx`(`pos_device_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ingredients_branch_id_idx` ON `ingredients`(`branch_id`);

-- CreateIndex
CREATE UNIQUE INDEX `ingredients_branch_id_name_key` ON `ingredients`(`branch_id`, `name`);

-- CreateIndex
CREATE INDEX `orders_branch_id_idx` ON `orders`(`branch_id`);

-- CreateIndex
CREATE INDEX `orders_pos_device_id_idx` ON `orders`(`pos_device_id`);

-- CreateIndex
CREATE INDEX `users_branch_id_idx` ON `users`(`branch_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_devices` ADD CONSTRAINT `pos_devices_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_pos_device_id_fkey` FOREIGN KEY (`pos_device_id`) REFERENCES `pos_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_pos_device_id_fkey` FOREIGN KEY (`pos_device_id`) REFERENCES `pos_devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
