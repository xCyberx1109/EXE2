-- Update existing STAFF records to COOK before changing the enum
UPDATE `accounts` SET `role` = 'COOK' WHERE `role` = 'STAFF';

-- Alter the ENUM column to replace STAFF with COOK
ALTER TABLE `accounts` MODIFY `role` ENUM('ADMIN', 'MANAGER', 'CASHIER', 'COOK') NOT NULL;

-- Drop isSuperAdmin column (data already migrated to role-based)
ALTER TABLE `accounts` DROP COLUMN `isSuperAdmin`;
