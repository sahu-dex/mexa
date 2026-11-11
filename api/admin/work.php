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
        json_response(['ok' => false, 'error' => 'Invalid work item ID.'], 422);
    }
    $sel = $pdo->prepare('SELECT `file_path`, `thumbnail_path` FROM `work_items` WHERE `id` = :id LIMIT 1');
    $sel->execute([':id' => $id]);
    $row = $sel->fetch();
    if ($row) {
        delete_uploaded_file((string) ($row['file_path'] ?? ''));
        delete_uploaded_file((string) ($row['thumbnail_path'] ?? ''));
    }
    $del = $pdo->prepare('DELETE FROM `work_items` WHERE `id` = :id');
    $del->execute([':id' => $id]);
    json_response(['ok' => true]);
}

if (!in_array($action, ['create', 'update'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid action.'], 422);
}

$id = (int) ($_POST['id'] ?? 0);
$title = trim((string) ($_POST['title'] ?? ''));
$category = trim((string) ($_POST['category'] ?? 'General'));
$kind = in_array($_POST['kind'] ?? '', ['video', 'image'], true) ? (string) $_POST['kind'] : 'video';
$section = in_array($_POST['section'] ?? '', ['recent', 'demo', 'short', 'preview'], true) ? (string) $_POST['section'] : 'recent';
$platform = trim((string) ($_POST['platform'] ?? 'youtube'));
$duration = trim((string) ($_POST['duration'] ?? ''));
$serviceName = trim((string) ($_POST['service_name'] ?? ''));
$description = trim((string) ($_POST['description'] ?? ''));
$filePath = trim((string) ($_POST['file_path'] ?? ''));
$thumbPath = trim((string) ($_POST['thumbnail_path'] ?? ''));
$isFeatured = !empty($_POST['is_featured']) ? 1 : 0;
$sortOrder = (int) ($_POST['sort_order'] ?? 0);
$status = (isset($_POST['status']) && $_POST['status'] === 'draft') || (isset($_POST['is_active']) && (string) $_POST['is_active'] === '0') ? 'draft' : 'published';

if ($title === '') {
    json_response(['ok' => false, 'error' => 'Title is required.'], 422);
}

$existing = null;
if ($action === 'update') {
    $sel = $pdo->prepare('SELECT * FROM `work_items` WHERE `id` = :id LIMIT 1');
    $sel->execute([':id' => $id]);
    $existing = $sel->fetch();
    if (!$existing) {
        json_response(['ok' => false, 'error' => 'Work item not found.'], 404);
    }
    if ($filePath === '') {
        $filePath = (string) ($existing['file_path'] ?? '');
    }
    if ($thumbPath === '') {
        $thumbPath = (string) ($existing['thumbnail_path'] ?? '');
    }
}

if (!empty($_FILES['media_file']) && (int) ($_FILES['media_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $up = upload_media($_FILES['media_file'], $kind === 'image' ? 'image' : 'video');
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

if ($filePath === '') {
    json_response(['ok' => false, 'error' => 'Please upload a media file or enter a file path / URL.'], 422);
}

if ($action === 'create') {
    $ins = $pdo->prepare(
        'INSERT INTO `work_items` (`title`, `category`, `kind`, `platform`, `section`, `duration`, `service_name`, `description`, `file_path`, `thumbnail_path`, `is_featured`, `sort_order`, `status`)
         VALUES (:title, :category, :kind, :platform, :section, :duration, :service_name, :description, :file_path, :thumbnail_path, :is_featured, :sort_order, :status)'
    );
    $ins->execute([
        ':title' => mb_substr($title, 0, 200),
        ':category' => mb_substr($category, 0, 80),
        ':kind' => $kind,
        ':platform' => mb_substr($platform ?: 'youtube', 0, 40),
        ':section' => $section,
        ':duration' => $duration !== '' ? mb_substr($duration, 0, 20) : null,
        ':service_name' => $serviceName !== '' ? mb_substr($serviceName, 0, 150) : null,
        ':description' => $description !== '' ? $description : null,
        ':file_path' => $filePath,
        ':thumbnail_path' => $thumbPath !== '' ? $thumbPath : null,
        ':is_featured' => $isFeatured,
        ':sort_order' => $sortOrder,
        ':status' => $status,
    ]);
    json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
}

$upd = $pdo->prepare(
    'UPDATE `work_items`
     SET `title` = :title, `category` = :category, `kind` = :kind, `platform` = :platform, `section` = :section,
         `duration` = :duration, `service_name` = :service_name, `description` = :description,
         `file_path` = :file_path, `thumbnail_path` = :thumbnail_path, `is_featured` = :is_featured,
         `sort_order` = :sort_order, `status` = :status
     WHERE `id` = :id'
);
$upd->execute([
    ':title' => mb_substr($title, 0, 200),
    ':category' => mb_substr($category, 0, 80),
    ':kind' => $kind,
    ':platform' => mb_substr($platform ?: 'youtube', 0, 40),
    ':section' => $section,
    ':duration' => $duration !== '' ? mb_substr($duration, 0, 20) : null,
    ':service_name' => $serviceName !== '' ? mb_substr($serviceName, 0, 150) : null,
    ':description' => $description !== '' ? $description : null,
    ':file_path' => $filePath,
    ':thumbnail_path' => $thumbPath !== '' ? $thumbPath : null,
    ':is_featured' => $isFeatured,
    ':sort_order' => $sortOrder,
    ':status' => $status,
    ':id' => $id,
]);

json_response(['ok' => true, 'id' => $id]);
