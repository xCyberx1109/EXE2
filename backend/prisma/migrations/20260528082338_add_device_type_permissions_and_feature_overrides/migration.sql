-- CreateTable
CREATE TABLE `device_type_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `deviceType` ENUM('CASHIER', 'KITCHEN', 'TABLET', 'KIOSK', 'WAITER', 'CUSTOMER_DISPLAY', 'MANAGER') NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `device_type_permissions_deviceType_idx`(`deviceType`),
    UNIQUE INDEX `device_type_permissions_deviceType_permissionId_key`(`deviceType`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_feature_overrides` (
    `id` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `device_feature_overrides_deviceId_idx`(`deviceId`),
    UNIQUE INDEX `device_feature_overrides_deviceId_featureId_key`(`deviceId`, `featureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `device_type_permissions` ADD CONSTRAINT `device_type_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_feature_overrides` ADD CONSTRAINT `device_feature_overrides_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `pos_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_feature_overrides` ADD CONSTRAINT `device_feature_overrides_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `features`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
