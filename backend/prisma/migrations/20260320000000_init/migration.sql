-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_name_key`(`name`),
    UNIQUE INDEX `categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `cost` DECIMAL(12, 2) NOT NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(500) NULL,
    `available` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `menu_items_category_id_idx`(`category_id`),
    INDEX `menu_items_available_idx`(`available`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_item_ingredients` (
    `id` VARCHAR(191) NOT NULL,
    `menu_item_id` VARCHAR(191) NOT NULL,
    `ingredient_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 3) NOT NULL,

    UNIQUE INDEX `menu_item_ingredients_menu_item_id_ingredient_id_key`(`menu_item_id`, `ingredient_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredients` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `min_quantity` DECIMAL(12, 3) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `supplier` VARCHAR(191) NOT NULL,
    `last_updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ingredients_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `ingredient_id` VARCHAR(191) NOT NULL,
    `type` ENUM('IN', 'OUT') NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `note` TEXT NULL,
    `user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_transactions_ingredient_id_idx`(`ingredient_id`),
    INDEX `inventory_transactions_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `order_number` VARCHAR(191) NOT NULL,
    `table_number` INTEGER NULL,
    `status` ENUM('PENDING', 'PREPARING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `payment_method` ENUM('CASH', 'CARD', 'QR') NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `profit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `orders_order_number_key`(`order_number`),
    INDEX `orders_table_number_idx`(`table_number`),
    INDEX `orders_status_idx`(`status`),
    INDEX `orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `menu_item_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `quantity` INTEGER NOT NULL,

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_menu_item_id_idx`(`menu_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revenue_reports` (
    `id` VARCHAR(191) NOT NULL,
    `report_date` DATE NOT NULL,
    `order_count` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `profit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `revenue_reports_report_date_key`(`report_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_menu_item_id_fkey` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item_ingredients` ADD CONSTRAINT `menu_item_ingredients_ingredient_id_fkey` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_ingredient_id_fkey` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_menu_item_id_fkey` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
