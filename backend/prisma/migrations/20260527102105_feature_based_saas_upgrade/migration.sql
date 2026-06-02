-- CreateTable
CREATE TABLE `features` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `module` VARCHAR(191) NOT NULL,
    `isCore` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `features_code_key`(`code`),
    INDEX `features_module_idx`(`module`),
    INDEX `features_isCore_idx`(`isCore`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_dependencies` (
    `id` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `dependsOnId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `feature_dependencies_featureId_dependsOnId_key`(`featureId`, `dependsOnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branch_features` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `settings` JSON NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `branch_features_branchId_enabled_idx`(`branchId`, `enabled`),
    INDEX `branch_features_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `branch_features_branchId_featureId_key`(`branchId`, `featureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `feature_permissions_featureId_permissionId_key`(`featureId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `module` VARCHAR(191) NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    INDEX `permissions_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `grantedBy` VARCHAR(191) NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `account_permissions_accountId_idx`(`accountId`),
    INDEX `account_permissions_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `account_permissions_accountId_permissionId_key`(`accountId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `billingInterval` ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
    `trialDays` INTEGER NOT NULL DEFAULT 0,
    `maxBranches` INTEGER NOT NULL DEFAULT 1,
    `maxUsers` INTEGER NOT NULL DEFAULT 5,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `subscription_plans_code_key`(`code`),
    INDEX `subscription_plans_isActive_idx`(`isActive`),
    INDEX `subscription_plans_billingInterval_idx`(`billingInterval`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plan_features` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionPlanId` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `subscription_plan_features_subscriptionPlanId_featureId_key`(`subscriptionPlanId`, `featureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `status` ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED') NOT NULL DEFAULT 'TRIAL',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT true,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `subscriptions_branchId_status_idx`(`branchId`, `status`),
    INDEX `subscriptions_endDate_idx`(`endDate`),
    INDEX `subscriptions_trialEndsAt_idx`(`trialEndsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `paidAt` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `paidAmount` DECIMAL(12, 2) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `billing_invoices_subscriptionId_idx`(`subscriptionId`),
    INDEX `billing_invoices_status_idx`(`status`),
    INDEX `billing_invoices_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `taxCode` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `branches_active_idx`(`active`),
    INDEX `branches_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `pinCode` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'STAFF') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `accounts_email_key`(`email`),
    INDEX `accounts_branchId_role_idx`(`branchId`, `role`),
    INDEX `accounts_active_idx`(`active`),
    INDEX `accounts_email_idx`(`email`),
    UNIQUE INDEX `accounts_branchId_pinCode_key`(`branchId`, `pinCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_devices` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `deviceCode` VARCHAR(191) NOT NULL,
    `devicePin` VARCHAR(191) NULL,
    `deviceToken` VARCHAR(191) NULL,
    `type` ENUM('CASHIER', 'TABLET', 'KIOSK') NOT NULL,
    `mode` ENUM('CASHIER', 'KITCHEN', 'HYBRID') NOT NULL DEFAULT 'CASHIER',
    `status` ENUM('ONLINE', 'OFFLINE', 'MAINTENANCE') NOT NULL DEFAULT 'OFFLINE',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `lastActive` DATETIME(3) NULL,
    `currentVersion` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pos_devices_deviceCode_key`(`deviceCode`),
    UNIQUE INDEX `pos_devices_devicePin_key`(`devicePin`),
    UNIQUE INDEX `pos_devices_deviceToken_key`(`deviceToken`),
    INDEX `pos_devices_branchId_idx`(`branchId`),
    INDEX `pos_devices_deviceToken_idx`(`deviceToken`),
    INDEX `pos_devices_status_idx`(`status`),
    INDEX `pos_devices_mode_idx`(`mode`),
    INDEX `pos_devices_active_idx`(`active`),
    INDEX `pos_devices_lastActive_idx`(`lastActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `categories_branchId_idx`(`branchId`),
    INDEX `categories_active_idx`(`active`),
    UNIQUE INDEX `categories_branchId_slug_key`(`branchId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `cost` DECIMAL(10, 2) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `prepTime` INTEGER NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `available` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `menu_items_branchId_categoryId_idx`(`branchId`, `categoryId`),
    INDEX `menu_items_available_idx`(`available`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_item_modifiers` (
    `id` VARCHAR(191) NOT NULL,
    `menuItemId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'SELECT',
    `minSelect` INTEGER NOT NULL DEFAULT 0,
    `maxSelect` INTEGER NOT NULL DEFAULT 1,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `menu_item_modifiers_menuItemId_idx`(`menuItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_item_ingredients` (
    `id` VARCHAR(191) NOT NULL,
    `menuItemId` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,

    INDEX `menu_item_ingredients_menuItemId_idx`(`menuItemId`),
    INDEX `menu_item_ingredients_ingredientId_idx`(`ingredientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredients` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unit` ENUM('KG', 'G', 'LITER', 'ML', 'PIECE', 'UNIT') NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `minQuantity` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `maxQuantity` DECIMAL(10, 2) NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `supplier` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `barcode` VARCHAR(191) NULL,
    `available` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `lastUpdated` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ingredients_branchId_idx`(`branchId`),
    INDEX `ingredients_sku_idx`(`sku`),
    INDEX `ingredients_barcode_idx`(`barcode`),
    INDEX `ingredients_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_alerts` (
    `id` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `alertType` VARCHAR(191) NOT NULL DEFAULT 'LOW_STOCK',
    `threshold` DECIMAL(10, 2) NOT NULL,
    `message` TEXT NULL,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_alerts_ingredientId_isResolved_idx`(`ingredientId`, `isResolved`),
    INDEX `stock_alerts_branchId_alertType_idx`(`branchId`, `alertType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_audits` (
    `id` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `auditedBy` VARCHAR(191) NOT NULL,
    `expectedQuantity` DECIMAL(10, 2) NOT NULL,
    `actualQuantity` DECIMAL(10, 2) NOT NULL,
    `variance` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `auditDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_audits_ingredientId_idx`(`ingredientId`),
    INDEX `stock_audits_branchId_auditDate_idx`(`branchId`, `auditDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `type` ENUM('IMPORT', 'OUT', 'ADJUST', 'RETURN', 'WASTE', 'AUDIT') NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `beforeQuantity` DECIMAL(10, 2) NULL,
    `afterQuantity` DECIMAL(10, 2) NULL,
    `unitPrice` DECIMAL(10, 2) NULL,
    `totalCost` DECIMAL(12, 2) NULL,
    `note` TEXT NULL,
    `referenceId` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `inventory_transactions_branchId_ingredientId_idx`(`branchId`, `ingredientId`),
    INDEX `inventory_transactions_createdAt_idx`(`createdAt`),
    INDEX `inventory_transactions_referenceId_idx`(`referenceId`),
    INDEX `inventory_transactions_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shifts` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `posDeviceId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endTime` DATETIME(3) NULL,
    `lastActive` DATETIME(3) NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT true,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `openingBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `closingBalance` DECIMAL(12, 2) NULL,
    `actualBalance` DECIMAL(12, 2) NULL,
    `cashSales` DECIMAL(12, 2) NULL DEFAULT 0,
    `cardSales` DECIMAL(12, 2) NULL DEFAULT 0,
    `otherSales` DECIMAL(12, 2) NULL DEFAULT 0,
    `totalOrders` INTEGER NULL DEFAULT 0,
    `note` TEXT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `shifts_branchId_accountId_idx`(`branchId`, `accountId`),
    INDEX `shifts_status_isOnline_idx`(`status`, `isOnline`),
    INDEX `shifts_posDeviceId_status_idx`(`posDeviceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `posDeviceId` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL DEFAULT 'POS',
    `tableNumber` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REFUNDED') NOT NULL,
    `kitchenStatus` ENUM('PENDING', 'RECEIVED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` ENUM('CASH', 'CARD', 'BANKING', 'E_WALLET', 'OTHER') NULL,
    `paymentStatus` ENUM('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    `orderType` ENUM('DINE_IN', 'TAKE_AWAY', 'DELIVERY', 'PICKUP') NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NULL,
    `serviceCharge` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `rounding` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `profit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `guestCount` INTEGER NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `orders_orderNumber_key`(`orderNumber`),
    INDEX `orders_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `orders_shiftId_idx`(`shiftId`),
    INDEX `orders_branchId_status_idx`(`branchId`, `status`),
    INDEX `orders_branchId_paymentStatus_idx`(`branchId`, `paymentStatus`),
    INDEX `orders_branchId_kitchenStatus_idx`(`branchId`, `kitchenStatus`),
    INDEX `orders_orderNumber_idx`(`orderNumber`),
    INDEX `orders_tableNumber_idx`(`tableNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `menuItemId` VARCHAR(191) NULL,
    `kotId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `quantity` INTEGER NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `note` TEXT NULL,

    INDEX `order_items_orderId_idx`(`orderId`),
    INDEX `order_items_menuItemId_idx`(`menuItemId`),
    INDEX `order_items_kotId_idx`(`kotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_modifiers` (
    `id` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `modifierId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `order_item_modifiers_orderItemId_idx`(`orderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kots` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `kotNumber` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'RECEIVED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `preparedBy` VARCHAR(191) NULL,
    `preparedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kots_kotNumber_key`(`kotNumber`),
    INDEX `kots_orderId_idx`(`orderId`),
    INDEX `kots_branchId_status_idx`(`branchId`, `status`),
    INDEX `kots_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'BANKING', 'E_WALLET', 'OTHER') NOT NULL,
    `status` ENUM('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED') NOT NULL,
    `reference` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payments_orderId_idx`(`orderId`),
    INDEX `payments_createdAt_idx`(`createdAt`),
    INDEX `payments_transactionId_idx`(`transactionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `birthDate` DATETIME(3) NULL,
    `totalSpent` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `visitCount` INTEGER NOT NULL DEFAULT 0,
    `lastVisit` DATETIME(3) NULL,
    `tier` ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM') NOT NULL DEFAULT 'BRONZE',
    `points` INTEGER NOT NULL DEFAULT 0,
    `note` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customers_branchId_tier_idx`(`branchId`, `tier`),
    INDEX `customers_points_idx`(`points`),
    UNIQUE INDEX `customers_branchId_phone_key`(`branchId`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loyalty_points` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'EARN',
    `reference` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loyalty_points_customerId_idx`(`customerId`),
    INDEX `loyalty_points_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `loyalty_points_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vouchers` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_ITEM', 'BUY_X_GET_Y') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL,
    `maxDiscount` DECIMAL(12, 2) NULL,
    `minOrderValue` DECIMAL(12, 2) NULL,
    `usageLimit` INTEGER NULL DEFAULT 0,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `pointsCost` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `vouchers_code_key`(`code`),
    INDEX `vouchers_branchId_isActive_idx`(`branchId`, `isActive`),
    INDEX `vouchers_code_idx`(`code`),
    INDEX `vouchers_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redeemed_vouchers` (
    `id` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `discount` DECIMAL(12, 2) NOT NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `redeemed_vouchers_voucherId_idx`(`voucherId`),
    INDEX `redeemed_vouchers_customerId_idx`(`customerId`),
    INDEX `redeemed_vouchers_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revenue_reports` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `reportDate` DATE NOT NULL,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `profit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `cashTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `cardTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `otherTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `revenue_reports_branchId_reportDate_idx`(`branchId`, `reportDate`),
    UNIQUE INDEX `revenue_reports_branchId_reportDate_key`(`branchId`, `reportDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `posDeviceId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `details` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `activity_logs_accountId_createdAt_idx`(`accountId`, `createdAt`),
    INDEX `activity_logs_module_action_idx`(`module`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `feature_dependencies` ADD CONSTRAINT `feature_dependencies_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `features`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feature_dependencies` ADD CONSTRAINT `feature_dependencies_dependsOnId_fkey` FOREIGN KEY (`dependsOnId`) REFERENCES `features`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_features` ADD CONSTRAINT `branch_features_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branch_features` ADD CONSTRAINT `branch_features_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `features`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feature_permissions` ADD CONSTRAINT `feature_permissions_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `features`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feature_permissions` ADD CONSTRAINT `feature_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_permissions` ADD CONSTRAINT `account_permissions_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_permissions` ADD CONSTRAINT `account_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_plan_features` ADD CONSTRAINT `subscription_plan_features_subscriptionPlanId_fkey` FOREIGN KEY (`subscriptionPlanId`) REFERENCES `subscription_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_plan_features` ADD CONSTRAINT `subscription_plan_features_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `features`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_invoices` ADD CONSTRAINT `billing_invoices_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_devices` ADD CONSTRAINT `pos_devices_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_modifiers` ADD CONSTRAINT `menu_item_modifiers_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_alerts` ADD CONSTRAINT `stock_alerts_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_alerts` ADD CONSTRAINT `stock_alerts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_audits` ADD CONSTRAINT `stock_audits_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_audits` ADD CONSTRAINT `stock_audits_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_audits` ADD CONSTRAINT `stock_audits_auditedBy_fkey` FOREIGN KEY (`auditedBy`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_posDeviceId_fkey` FOREIGN KEY (`posDeviceId`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_posDeviceId_fkey` FOREIGN KEY (`posDeviceId`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menu_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_kotId_fkey` FOREIGN KEY (`kotId`) REFERENCES `kots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_modifiers` ADD CONSTRAINT `order_item_modifiers_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_modifiers` ADD CONSTRAINT `order_item_modifiers_modifierId_fkey` FOREIGN KEY (`modifierId`) REFERENCES `menu_item_modifiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kots` ADD CONSTRAINT `kots_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kots` ADD CONSTRAINT `kots_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_points` ADD CONSTRAINT `loyalty_points_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loyalty_points` ADD CONSTRAINT `loyalty_points_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeemed_vouchers` ADD CONSTRAINT `redeemed_vouchers_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeemed_vouchers` ADD CONSTRAINT `redeemed_vouchers_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redeemed_vouchers` ADD CONSTRAINT `redeemed_vouchers_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revenue_reports` ADD CONSTRAINT `revenue_reports_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
