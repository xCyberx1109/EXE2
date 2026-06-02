-- AlterTable
ALTER TABLE `device_sessions` ADD COLUMN `device_name` VARCHAR(191) NULL,
    ADD COLUMN `fingerprint` VARCHAR(191) NULL,
    ADD COLUMN `refresh_token_hash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `pos_devices` ADD COLUMN `last_fingerprint` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `trusted_devices` (
    `id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `device_name` VARCHAR(191) NULL,
    `is_trusted` BOOLEAN NOT NULL DEFAULT true,
    `trusted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `trusted_devices_fingerprint_idx`(`fingerprint`),
    UNIQUE INDEX `trusted_devices_device_id_fingerprint_key`(`device_id`, `fingerprint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `device_sessions_refresh_token_hash_idx` ON `device_sessions`(`refresh_token_hash`);

-- CreateIndex
CREATE INDEX `device_sessions_fingerprint_idx` ON `device_sessions`(`fingerprint`);

-- AddForeignKey
ALTER TABLE `trusted_devices` ADD CONSTRAINT `trusted_devices_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `pos_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
