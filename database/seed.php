<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/config/db.php';

$args = $argv ?? [];
$runSchema = in_array('--schema', $args, true);
$fresh = in_array('--fresh', $args, true);

if ($fresh && !APP_DEBUG) {
    fwrite(STDERR, "Error: --fresh requires APP_ENV=development.\n");
    exit(1);
}

$pdo = db();

if ($runSchema) {
    $schemaPath = __DIR__ . '/schema.sql';
    if (!is_file($schemaPath)) {
        fwrite(STDERR, "Error: schema.sql not found.\n");
        exit(1);
    }
    $pdo->exec((string) file_get_contents($schemaPath));
    echo "[OK] Schema applied\n";
}

$dataPath = __DIR__ . '/seed-data.json';
if (!is_file($dataPath)) {
    fwrite(STDERR, "Error: seed-data.json not found.\n");
    exit(1);
}

$bundle = json_decode((string) file_get_contents($dataPath), true, 512, JSON_THROW_ON_ERROR);

$pdo->beginTransaction();

try {
    if ($fresh) {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach (['packages', 'services', 'work_items', 'team_members', 'reviews', 'settings'] as $tbl) {
            $pdo->exec("DELETE FROM `{$tbl}`");
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    $stmtSetting = $pdo->prepare(
        'INSERT INTO `settings` (`setting_key`, `setting_value`, `setting_group`)
         VALUES (:key, :value, :group)
         ON DUPLICATE KEY UPDATE
            `setting_group` = VALUES(`setting_group`),
            `setting_value` = IF(`setting_value` IS NULL OR `setting_value` = "", VALUES(`setting_value`), `setting_value`)'
    );
    foreach ($bundle['settings'] ?? [] as $row) {
        $stmtSetting->execute([
            ':key' => (string) $row['key'],
            ':value' => (string) ($row['value'] ?? ''),
            ':group' => (string) ($row['group'] ?? 'general'),
        ]);
    }

    $stmtService = $pdo->prepare(
        'INSERT INTO `services` (
            `id`, `name`, `slug`, `category`, `icon`, `price_from`, `subtitle`, `description`,
            `long_description`, `deliverables`, `bullet_points`, `file_path`, `thumbnail_path`,
            `embed_type`, `embed_provider`, `demo_videos_json`, `is_active`, `sort_order`
        ) VALUES (
            :id, :name, :slug, :category, :icon, :price_from, :subtitle, :description,
            :long_description, :deliverables, :bullet_points, :file_path, :thumbnail_path,
            :embed_type, :embed_provider, :demo_videos_json, :is_active, :sort_order
        ) ON DUPLICATE KEY UPDATE
            `name` = VALUES(`name`),
            `category` = VALUES(`category`),
            `icon` = VALUES(`icon`),
            `price_from` = VALUES(`price_from`),
            `subtitle` = VALUES(`subtitle`),
            `description` = VALUES(`description`),
            `long_description` = VALUES(`long_description`),
            `deliverables` = VALUES(`deliverables`),
            `bullet_points` = VALUES(`bullet_points`),
            `file_path` = VALUES(`file_path`),
            `thumbnail_path` = VALUES(`thumbnail_path`),
            `embed_type` = VALUES(`embed_type`),
            `embed_provider` = VALUES(`embed_provider`),
            `demo_videos_json` = VALUES(`demo_videos_json`),
            `sort_order` = VALUES(`sort_order`)'
    );
    foreach ($bundle['services'] ?? [] as $s) {
        $stmtService->execute([
            ':id' => (int) $s['id'],
            ':name' => (string) $s['name'],
            ':slug' => (string) $s['slug'],
            ':category' => (string) $s['category'],
            ':icon' => (string) $s['icon'],
            ':price_from' => (float) $s['price_from'],
            ':subtitle' => (string) $s['subtitle'],
            ':description' => (string) $s['description'],
            ':long_description' => (string) $s['long_description'],
            ':deliverables' => (string) $s['deliverables'],
            ':bullet_points' => (string) $s['bullet_points'],
            ':file_path' => (string) $s['file_path'],
            ':thumbnail_path' => (string) $s['thumbnail_path'],
            ':embed_type' => (string) $s['embed_type'],
            ':embed_provider' => (string) $s['embed_provider'],
            ':demo_videos_json' => (string) $s['demo_videos_json'],
            ':is_active' => (int) $s['is_active'],
            ':sort_order' => (int) $s['sort_order'],
        ]);
    }

    $stmtPkg = $pdo->prepare(
        'INSERT INTO `packages` (
            `service_id`, `quality`, `name`, `price`, `currency`, `description`,
            `features`, `delivery`, `revisions`, `badge`, `highlight`, `sort_order`
        ) VALUES (
            :service_id, :quality, :name, :price, :currency, :description,
            :features, :delivery, :revisions, :badge, :highlight, :sort_order
        ) ON DUPLICATE KEY UPDATE
            `name` = VALUES(`name`),
            `price` = VALUES(`price`),
            `currency` = VALUES(`currency`),
            `description` = VALUES(`description`),
            `features` = VALUES(`features`),
            `delivery` = VALUES(`delivery`),
            `revisions` = VALUES(`revisions`),
            `badge` = VALUES(`badge`),
            `highlight` = VALUES(`highlight`),
            `sort_order` = VALUES(`sort_order`)'
    );
    foreach ($bundle['packages'] ?? [] as $p) {
        $stmtPkg->execute([
            ':service_id' => (int) $p['service_id'],
            ':quality' => (string) $p['quality'],
            ':name' => (string) $p['name'],
            ':price' => (float) $p['price'],
            ':currency' => (string) $p['currency'],
            ':description' => (string) $p['description'],
            ':features' => (string) $p['features'],
            ':delivery' => (string) $p['delivery'],
            ':revisions' => (string) $p['revisions'],
            ':badge' => (string) $p['badge'],
            ':highlight' => (int) $p['highlight'],
            ':sort_order' => (int) $p['sort_order'],
        ]);
    }

    $stmtTeam = $pdo->prepare(
        'INSERT INTO `team_members` (
            `id`, `name`, `slug`, `role`, `bio`, `description`, `skills`, `responsibilities`,
            `file_path`, `whatsapp`, `telegram`, `phone`, `email`, `is_founder`, `is_active`, `sort_order`
        ) VALUES (
            :id, :name, :slug, :role, :bio, :description, :skills, :responsibilities,
            :file_path, :whatsapp, :telegram, :phone, :email, :is_founder, :is_active, :sort_order
        ) ON DUPLICATE KEY UPDATE
            `name` = VALUES(`name`),
            `role` = VALUES(`role`),
            `bio` = VALUES(`bio`),
            `description` = VALUES(`description`),
            `skills` = VALUES(`skills`),
            `responsibilities` = VALUES(`responsibilities`),
            `file_path` = VALUES(`file_path`),
            `is_founder` = VALUES(`is_founder`),
            `sort_order` = VALUES(`sort_order`)'
    );
    foreach ($bundle['team_members'] ?? [] as $m) {
        $stmtTeam->execute([
            ':id' => (int) $m['id'],
            ':name' => (string) $m['name'],
            ':slug' => (string) $m['slug'],
            ':role' => (string) $m['role'],
            ':bio' => (string) $m['bio'],
            ':description' => (string) $m['description'],
            ':skills' => (string) $m['skills'],
            ':responsibilities' => (string) $m['responsibilities'],
            ':file_path' => (string) $m['file_path'],
            ':whatsapp' => (string) $m['whatsapp'],
            ':telegram' => (string) $m['telegram'],
            ':phone' => (string) $m['phone'],
            ':email' => (string) $m['email'],
            ':is_founder' => (int) $m['is_founder'],
            ':is_active' => (int) $m['is_active'],
            ':sort_order' => (int) $m['sort_order'],
        ]);
    }

    $workCount = (int) $pdo->query('SELECT COUNT(*) FROM `work_items`')->fetchColumn();
    if ($workCount === 0) {
        $stmtWork = $pdo->prepare(
            'INSERT INTO `work_items` (
                `title`, `description`, `kind`, `platform`, `category`, `section`,
                `file_path`, `thumbnail_path`, `embed_type`, `embed_provider`, `embed_url`,
                `duration`, `service_name`, `is_featured`, `sort_order`, `status`
            ) VALUES (
                :title, :description, :kind, :platform, :category, :section,
                :file_path, :thumbnail_path, :embed_type, :embed_provider, :embed_url,
                :duration, :service_name, :is_featured, :sort_order, :status
            )'
        );
        foreach ($bundle['work_items'] ?? [] as $w) {
            $stmtWork->execute([
                ':title' => (string) $w['title'],
                ':description' => (string) $w['description'],
                ':kind' => (string) $w['kind'],
                ':platform' => (string) $w['platform'],
                ':category' => (string) $w['category'],
                ':section' => (string) $w['section'],
                ':file_path' => (string) $w['file_path'],
                ':thumbnail_path' => (string) $w['thumbnail_path'],
                ':embed_type' => (string) $w['embed_type'],
                ':embed_provider' => (string) $w['embed_provider'],
                ':embed_url' => (string) $w['embed_url'],
                ':duration' => (string) $w['duration'],
                ':service_name' => (string) $w['service_name'],
                ':is_featured' => (int) $w['is_featured'],
                ':sort_order' => (int) $w['sort_order'],
                ':status' => (string) $w['status'],
            ]);
        }
    }

    $reviewCount = (int) $pdo->query('SELECT COUNT(*) FROM `reviews`')->fetchColumn();
    if ($reviewCount === 0) {
        $stmtRev = $pdo->prepare(
            'INSERT INTO `reviews` (
                `name`, `role`, `rating`, `body`, `file_path`, `is_featured`, `status`, `created_at`
            ) VALUES (
                :name, :role, :rating, :body, :file_path, :is_featured, :status, :created_at
            )'
        );
        foreach ($bundle['reviews'] ?? [] as $r) {
            $stmtRev->execute([
                ':name' => (string) $r['name'],
                ':role' => (string) $r['role'],
                ':rating' => (int) $r['rating'],
                ':body' => (string) $r['body'],
                ':file_path' => (string) $r['file_path'],
                ':is_featured' => (int) $r['is_featured'],
                ':status' => (string) $r['status'],
                ':created_at' => (string) $r['created_at'],
            ]);
        }
    }

    $pdo->commit();
    echo "[OK] Database seeded.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'Seed failed: ' . $e->getMessage() . "\n");
    exit(1);
}
