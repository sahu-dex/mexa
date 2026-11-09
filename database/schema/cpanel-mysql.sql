-- MEXA MOTION — cPanel / phpMyAdmin schema-only import for Laravel 12.
--
-- WARNING: import this ONLY into a NEW, EMPTY MySQL database.
-- It contains no DROP, DELETE, TRUNCATE, UPDATE or content rows.
-- CREATE TABLE IF NOT EXISTS / INSERT IGNORE are used so an accidental import
-- cannot delete existing content; still never import it into a populated DB.
-- Keep this file outside the public web root; root .htaccess denies *.sql.
-- For an existing populated database, just point .env at it and skip this import.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `email_verified_at` TIMESTAMP NULL DEFAULT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(24) NOT NULL DEFAULT 'moderator',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `remember_token` VARCHAR(100) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `site_data` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `section` VARCHAR(40) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `site_data_section_unique` (`section`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `media_assets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(2048) NOT NULL,
    `thumbnail_url` VARCHAR(2048) NULL DEFAULT NULL,
    `provider` VARCHAR(32) NOT NULL DEFAULT 'imgbb',
    `name` VARCHAR(255) NULL DEFAULT NULL,
    `mime_type` VARCHAR(120) NULL DEFAULT NULL,
    `size_bytes` BIGINT UNSIGNED NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `video_library` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `url_hash` CHAR(64) NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `description` TEXT NULL DEFAULT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `embed_type` VARCHAR(16) NOT NULL,
    `embed_url` TEXT NULL DEFAULT NULL,
    `thumbnail_url` VARCHAR(2048) NULL DEFAULT NULL,
    `category` VARCHAR(120) NULL DEFAULT NULL,
    `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
    `is_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `display_order` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `video_library_url_hash_unique` (`url_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `video_placements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `video_id` BIGINT UNSIGNED NOT NULL,
    `page` VARCHAR(24) NOT NULL,
    `section` VARCHAR(32) NOT NULL,
    `item_key` VARCHAR(60) NOT NULL DEFAULT '',
    `service_id` VARCHAR(40) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `video_placement_identity` (`video_id`, `page`, `section`, `item_key`),
    KEY `video_placement_lookup` (`page`, `section`, `service_id`),
    CONSTRAINT `video_placements_video_id_foreign`
        FOREIGN KEY (`video_id`) REFERENCES `video_library` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_profile_access` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` VARCHAR(100) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `team_profile_access_member_id_unique` (`member_id`),
    UNIQUE KEY `team_profile_access_token_hash_unique` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_profile_submissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `member_id` VARCHAR(100) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `reviewed_by` BIGINT UNSIGNED NULL DEFAULT NULL,
    `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `team_profile_submissions_member_id_index` (`member_id`),
    KEY `team_profile_submissions_status_index` (`status`),
    KEY `team_profile_submissions_reviewed_by_foreign` (`reviewed_by`),
    CONSTRAINT `team_profile_submissions_reviewed_by_foreign`
        FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `migrations` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `migration` VARCHAR(255) NOT NULL,
    `batch` INT NOT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mark the bundled migrations as already applied, so a later
-- `php artisan migrate --force` does not try to recreate these tables.
INSERT IGNORE INTO `migrations` (`migration`, `batch`) VALUES
    ('2026_11_02_000001_create_users_table', 1),
    ('2026_11_02_000002_create_site_data_table', 1),
    ('2026_11_02_000003_create_media_assets_table', 1),
    ('2026_11_02_000004_create_video_library_tables', 1),
    ('2026_11_02_000005_add_admin_roles_and_team_profile_approvals', 1);

-- No content rows are inserted. SiteData::defaults() reads the bundled
-- database/seeders/data/site-snapshot.json as starter/fallback content.
