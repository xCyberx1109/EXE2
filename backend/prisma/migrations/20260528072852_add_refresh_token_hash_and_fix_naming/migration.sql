-- Safe rename: use RENAME COLUMN instead of DROP+ADD to preserve existing data
ALTER TABLE `device_sessions` RENAME COLUMN `createdAt` TO `created_at`;

-- Add refresh_token_hash to pos_devices
ALTER TABLE `pos_devices` ADD COLUMN `refresh_token_hash` VARCHAR(191) NULL;

-- Safe rename for trusted_devices
ALTER TABLE `trusted_devices` RENAME COLUMN `createdAt` TO `created_at`;
ALTER TABLE `trusted_devices` RENAME COLUMN `updatedAt` TO `updated_at`;

-- Add index for trusted_devices.device_id
CREATE INDEX `trusted_devices_device_id_idx` ON `trusted_devices`(`device_id`);
