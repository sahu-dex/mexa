-- One-time migration for an existing installation created from the original schema.
-- Back up the database before running: package records and package-specific message
-- fields are permanently removed. Existing messages, services and reviews are retained.
-- MySQL/MariaDB DDL implicitly commits; do not rerun after a successful migration.
-- Original booking subjects were generated as 'service — package'; retain the service.
UPDATE `messages` SET `subject` = SUBSTRING_INDEX(`subject`, ' — ', 1)
WHERE `type` = 'booking' AND `subject` LIKE '% — %';
ALTER TABLE `messages` DROP FOREIGN KEY `fk_messages_package`;
ALTER TABLE `messages`
    DROP INDEX `idx_messages_package`,
    DROP COLUMN `package_id`,
    DROP COLUMN `package_quality`,
    DROP COLUMN `quoted_price`,
    DROP COLUMN `currency`,
    MODIFY `type` ENUM('booking', 'contact', 'newsletter') NOT NULL DEFAULT 'contact';
DROP TABLE `packages`;
DELETE FROM `settings` WHERE `setting_key` IN ('show_packages', 'book_lead', 'hero_btn_secondary_text');
UPDATE `settings` SET `setting_value` = 'Eight in-house services with one demo each. Watch the one you need and read what is included.'
WHERE `setting_key` IN ('services_intro', 'service_intro')
  AND `setting_value` = 'Eight in-house services with one demo each. Watch the one you need, read what is included, then choose a quality package at the end.';
UPDATE `settings` SET `setting_value` = 'Send me the details of your project and I will personally confirm the timeline before we start.'
WHERE `setting_key` = 'welcome_message'
  AND `setting_value` = 'Thanks for choosing a package. Send me the details of your project and I will personally confirm the timeline before we start.';
