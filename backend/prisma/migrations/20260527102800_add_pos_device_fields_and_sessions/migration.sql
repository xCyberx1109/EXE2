-- AlterTable: Rename columns (safe rename with CHANGE COLUMN preserves data)
ALTER TABLE `pos_devices` CHANGE COLUMN `lastActive` `last_active` DATETIME(3) NULL;
ALTER TABLE `pos_devices` CHANGE COLUMN `currentVersion` `current_version` VARCHAR(191) NULL;

-- AlterTable: Add new columns
ALTER TABLE `pos_devices` ADD COLUMN `setup_pin_hash` VARCHAR(191) NULL,
    ADD COLUMN `setup_pin_expires_at` DATETIME(3) NULL,
    ADD COLUMN `activated_at` DATETIME(3) NULL,
    ADD COLUMN `activation_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `device_token_hash` VARCHAR(191) NULL,
    ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `last_login_at` DATETIME(3) NULL,
    ADD COLUMN `metadata` JSON NULL;

-- AlterTable: Extend enums
ALTER TABLE `pos_devices` MODIFY COLUMN `type` ENUM('CASHIER', 'KITCHEN', 'TABLET', 'KIOSK') NOT NULL;
ALTER TABLE `pos_devices` MODIFY COLUMN `status` ENUM('ONLINE', 'OFFLINE', 'MAINTENANCE', 'ACTIVATED', 'PENDING_ACTIVATION') NOT NULL DEFAULT 'PENDING_ACTIVATION';

-- AlterTable: Drop old index on renamed column, add new ones
DROP INDEX `pos_devices_lastActive_idx` ON `pos_devices`;
CREATE INDEX `pos_devices_deviceCode_idx` ON `pos_devices`(`deviceCode`);
CREATE INDEX `pos_devices_last_active_idx` ON `pos_devices`(`last_active`);

-- CreateTable: device_sessions
CREATE TABLE `device_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `device_sessions_device_id_idx`(`device_id`),
    INDEX `device_sessions_token_hash_idx`(`token_hash`),
    INDEX `device_sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: staff_sessions
CREATE TABLE `staff_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `shift_id` VARCHAR(191) NULL,
    `login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `logout_at` DATETIME(3) NULL,
    `last_activity_at` DATETIME(3) NULL,

    INDEX `staff_sessions_account_id_idx`(`account_id`),
    INDEX `staff_sessions_device_id_idx`(`device_id`),
    INDEX `staff_sessions_shift_id_idx`(`shift_id`),
    INDEX `staff_sessions_login_at_idx`(`login_at`),
    INDEX `staff_sessions_logout_at_idx`(`logout_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeys
ALTER TABLE `device_sessions` ADD CONSTRAINT `device_sessions_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `staff_sessions` ADD CONSTRAINT `staff_sessions_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `staff_sessions` ADD CONSTRAINT `staff_sessions_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `staff_sessions` ADD CONSTRAINT `staff_sessions_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
