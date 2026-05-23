-- Update any accounts with CASHIER or COOK role to MANAGER before changing enum
UPDATE accounts SET role = 'MANAGER' WHERE role IN ('CASHIER', 'COOK');

-- Alter accounts role enum: remove CASHIER, COOK (now only ADMIN, MANAGER)
ALTER TABLE accounts MODIFY COLUMN role ENUM('ADMIN', 'MANAGER') NOT NULL;

-- Add mode column to pos_devices
ALTER TABLE pos_devices ADD COLUMN mode ENUM('CASHIER', 'KITCHEN', 'HYBRID') NOT NULL DEFAULT 'CASHIER' AFTER `type`;

-- Add indexes for performance
CREATE INDEX pos_devices_device_token_idx ON pos_devices(deviceToken);
CREATE INDEX pos_devices_mode_idx ON pos_devices(mode);
CREATE INDEX pos_devices_last_active_idx ON pos_devices(lastActive);
