-- Add warningQuantity column to ingredients table
ALTER TABLE `ingredients` ADD COLUMN `warningQuantity` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `minQuantity`;
