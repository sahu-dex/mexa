SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `settings` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` MEDIUMTEXT NULL,
    `setting_group` VARCHAR(50) NOT NULL DEFAULT 'general',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_settings_key` (`setting_key`),
    KEY `idx_settings_group` (`setting_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `services` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `category` VARCHAR(80) NOT NULL DEFAULT 'Editing',
    `icon` VARCHAR(100) NOT NULL DEFAULT 'fa-solid fa-video',
    `price_from` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `subtitle` VARCHAR(255) NULL,
    `description` TEXT NOT NULL,
    `long_description` TEXT NULL,
    `deliverables` TEXT NULL,
    `bullet_points` TEXT NULL,
    `file_path` VARCHAR(500) NULL,
    `thumbnail_path` VARCHAR(500) NULL,
    `embed_type` VARCHAR(30) NOT NULL DEFAULT 'video',
    `embed_provider` VARCHAR(60) NULL,
    `demo_videos_json` LONGTEXT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_services_slug` (`slug`),
    KEY `idx_services_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `work_items` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `kind` ENUM('video', 'image') NOT NULL DEFAULT 'video',
    `platform` VARCHAR(40) NOT NULL DEFAULT 'youtube',
    `category` VARCHAR(80) NOT NULL DEFAULT 'General',
    `section` ENUM('recent', 'demo', 'short', 'preview') NOT NULL DEFAULT 'recent',
    `file_path` VARCHAR(500) NOT NULL,
    `thumbnail_path` VARCHAR(500) NULL,
    `embed_type` VARCHAR(30) NULL,
    `embed_provider` VARCHAR(50) NULL,
    `embed_url` VARCHAR(500) NULL,
    `duration` VARCHAR(20) NULL,
    `service_name` VARCHAR(150) NULL,
    `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order` INT NOT NULL DEFAULT 0,
    `status` ENUM('published', 'draft') NOT NULL DEFAULT 'published',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_work_filter` (`status`, `section`, `kind`, `category`),
    KEY `idx_work_featured_sort` (`is_featured`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_members` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `role` VARCHAR(150) NOT NULL,
    `bio` TEXT NULL,
    `description` TEXT NULL,
    `skills` TEXT NULL,
    `responsibilities` TEXT NULL,
    `file_path` VARCHAR(500) NULL,
    `whatsapp` VARCHAR(60) NULL,
    `telegram` VARCHAR(255) NULL,
    `phone` VARCHAR(60) NULL,
    `email` VARCHAR(190) NULL,
    `is_founder` TINYINT(1) NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_team_slug` (`slug`),
    KEY `idx_team_active_sort` (`is_active`, `is_founder`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reviews` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `role` VARCHAR(120) NULL,
    `rating` TINYINT UNSIGNED NOT NULL DEFAULT 5,
    `body` TEXT NOT NULL,
    `file_path` VARCHAR(500) NULL,
    `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `ip_hash` VARCHAR(64) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_reviews_status_featured` (`status`, `is_featured`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` ENUM('booking', 'contact', 'newsletter') NOT NULL DEFAULT 'contact',
    `ticket_ref` VARCHAR(40) NULL,
    `name` VARCHAR(120) NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(60) NULL,
    `subject` VARCHAR(200) NULL,
    `message` TEXT NULL,
    `service_id` INT UNSIGNED NULL,
    `status` ENUM('pending', 'approved', 'in_progress', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
    `admin_notes` TEXT NULL,
    `ip_hash` VARCHAR(64) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_messages_ticket_ref` (`ticket_ref`),
    KEY `idx_messages_type_status` (`type`, `status`, `created_at`),
    KEY `idx_messages_service` (`service_id`),
    CONSTRAINT `fk_messages_service`
        FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(80) NOT NULL,
    `email` VARCHAR(190) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `last_login_at` DATETIME NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_admins_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
