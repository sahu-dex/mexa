<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_admin(true);
require_csrf(true);

$action = trim((string) ($_POST['action'] ?? ''));
$pdo = db();

if ($action === 'delete') {
    $id = (int) ($_POST['id'] ?? 0);
    if ($id <= 0) {
        json_response(['ok' => false, 'error' => 'Invalid service ID.'], 422);
    }
    $sel = $pdo->prepare('SELECT `file_path`, `thumbnail_path` FROM `services` WHERE `id` = :id LIMIT 1');
    $sel->execute([':id' => $id]);
    $row = $sel->fetch();
    if ($row) {
        delete_uploaded_file((string) ($row['file_path'] ?? ''));
        delete_uploaded_file((string) ($row['thumbnail_path'] ?? ''));
    }
    $del = $pdo->prepare('DELETE FROM `services` WHERE `id` = :id');
    $del->execute([':id' => $id]);
    json_response(['ok' => true]);
}

if (!in_array($action, ['create', 'update'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid action.'], 422);
}

$id = (int) ($_POST['id'] ?? 0);
$name = trim((string) ($_POST['name'] ?? ''));
$category = trim((string) ($_POST['category'] ?? 'Editing'));
$description = trim((string) ($_POST['description'] ?? ''));
$longDescription = trim((string) ($_POST['long_description'] ?? ''));
$deliverables = trim((string) ($_POST['deliverables'] ?? ''));
$icon = trim((string) ($_POST['icon'] ?? 'fa-solid fa-video'));
$bulletsRaw = trim((string) ($_POST['bullet_points'] ?? ''));
$filePath = trim((string) ($_POST['file_path'] ?? ''));
$thumbPath = trim((string) ($_POST['thumbnail_path'] ?? ''));
$sortOrder = (int) ($_POST['sort_order'] ?? 0);
$isActive = isset($_POST['is_active']) && (string) $_POST['is_active'] === '0' ? 0 : 1;

if ($name === '' || $description === '') {
    json_response(['ok' => false, 'error' => 'Service name and short description are required.'], 422);
}

$bullets = implode("\n", split_lines($bulletsRaw));

$existing = null;
if ($action === 'update') {
    if ($id <= 0) {
        json_response(['ok' => false, 'error' => 'Invalid service ID.'], 422);
    }
    $sel = $pdo->prepare('SELECT * FROM `services` WHERE `id` = :id LIMIT 1');
    $sel->execute([':id' => $id]);
    $existing = $sel->fetch();
    if (!$existing) {
        json_response(['ok' => false, 'error' => 'Service not found.'], 404);
    }
    if ($filePath === '') {
        $filePath = (string) ($existing['file_path'] ?? '');
    }
    if ($thumbPath === '') {
        $thumbPath = (string) ($existing['thumbnail_path'] ?? '');
    }
}

if (!empty($_FILES['video_file']) && (int) ($_FILES['video_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $up = upload_media($_FILES['video_file'], 'video');
    if (!$up['ok']) {
        json_response(['ok' => false, 'error' => $up['error']], 422);
    }
    if ($existing && !empty($existing['file_path'])) {
        delete_uploaded_file((string) $existing['file_path']);
    }
    $filePath = (string) $up['file_path'];
}

if (!empty($_FILES['thumbnail_file']) && (int) ($_FILES['thumbnail_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $up = upload_media($_FILES['thumbnail_file'], 'image');
    if (!$up['ok']) {
        json_response(['ok' => false, 'error' => $up['error']], 422);
    }
    if ($existing && !empty($existing['thumbnail_path'])) {
        delete_uploaded_file((string) $existing['thumbnail_path']);
    }
    $thumbPath = (string) $up['file_path'];
}

$baseSlug = slugify($name);
$slug = $baseSlug;
$suffix = 2;
while (true) {
    $chk = $pdo->prepare('SELECT `id` FROM `services` WHERE `slug` = :s AND `id` <> :id LIMIT 1');
    $chk->execute([':s' => $slug, ':id' => $id]);
    if (!$chk->fetch()) {
        break;
    }
    $slug = $baseSlug . '-' . $suffix++;
}

if ($action === 'create') {
    $ins = $pdo->prepare(
        'INSERT INTO `services` (`name`, `slug`, `category`, `subtitle`, `description`, `long_description`, `deliverables`, `icon`, `bullet_points`, `file_path`, `thumbnail_path`, `sort_order`, `is_active`)
         VALUES (:name, :slug, :category, :subtitle, :description, :long_description, :deliverables, :icon, :bullet_points, :file_path, :thumbnail_path, :sort_order, :is_active)'
    );
    $ins->execute([
        ':name' => mb_substr($name, 0, 150),
        ':slug' => mb_substr($slug, 0, 160),
        ':category' => mb_substr($category, 0, 80),
        ':subtitle' => mb_substr($description, 0, 255),
        ':description' => $description,
        ':long_description' => $longDescription !== '' ? $longDescription : null,
        ':deliverables' => $deliverables !== '' ? $deliverables : null,
        ':icon' => mb_substr($icon, 0, 100),
        ':bullet_points' => $bullets,
        ':file_path' => $filePath !== '' ? $filePath : null,
        ':thumbnail_path' => $thumbPath !== '' ? $thumbPath : null,
        ':sort_order' => $sortOrder,
        ':is_active' => $isActive,
    ]);
    $newId = (int) $pdo->lastInsertId();

    json_response(['ok' => true, 'id' => $newId]);
}

$upd = $pdo->prepare(
    'UPDATE `services`
     SET `name` = :name, `slug` = :slug, `category` = :category, `subtitle` = :subtitle, `description` = :description,
         `long_description` = :long_description, `deliverables` = :deliverables, `icon` = :icon, `bullet_points` = :bullet_points,
         `file_path` = :file_path, `thumbnail_path` = :thumbnail_path, `sort_order` = :sort_order, `is_active` = :is_active
     WHERE `id` = :id'
);
$upd->execute([
    ':name' => mb_substr($name, 0, 150),
    ':slug' => mb_substr($slug, 0, 160),
    ':category' => mb_substr($category, 0, 80),
    ':subtitle' => mb_substr($description, 0, 255),
    ':description' => $description,
    ':long_description' => $longDescription !== '' ? $longDescription : null,
    ':deliverables' => $deliverables !== '' ? $deliverables : null,
    ':icon' => mb_substr($icon, 0, 100),
    ':bullet_points' => $bullets,
    ':file_path' => $filePath !== '' ? $filePath : null,
    ':thumbnail_path' => $thumbPath !== '' ? $thumbPath : null,
    ':sort_order' => $sortOrder,
    ':is_active' => $isActive,
    ':id' => $id,
]);

json_response(['ok' => true, 'id' => $id]);
