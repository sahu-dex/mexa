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
        json_response(['ok' => false, 'error' => 'Invalid team member ID.'], 422);
    }
    $sel = $pdo->prepare('SELECT `file_path` FROM `team_members` WHERE `id` = :id LIMIT 1');
    $sel->execute([':id' => $id]);
    $row = $sel->fetch();
    if ($row && !empty($row['file_path'])) {
        delete_uploaded_file((string) $row['file_path']);
    }
    $del = $pdo->prepare('DELETE FROM `team_members` WHERE `id` = :id');
    $del->execute([':id' => $id]);
    json_response(['ok' => true]);
}

if (!in_array($action, ['create', 'update'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid action.'], 422);
}

$id = (int) ($_POST['id'] ?? 0);
$name = trim((string) ($_POST['name'] ?? ''));
$role = trim((string) ($_POST['role'] ?? ''));
$bio = str_replace(["\r\n", "\r"], "\n", (string) ($_POST['bio'] ?? ''));
$description = str_replace(["\r\n", "\r"], "\n", (string) ($_POST['description'] ?? ''));
if (!mb_check_encoding($bio, 'UTF-8') || !mb_check_encoding($description, 'UTF-8') ||
    mb_strlen($bio, 'UTF-8') > 300 || mb_strlen($description, 'UTF-8') > 300) {
    json_response(['ok' => false, 'error' => 'Biography and card description must each be valid UTF-8 and no more than 300 characters.'], 422);
}
$bio = trim($bio);
$description = trim($description);
$skillsRaw = trim((string) ($_POST['skills'] ?? ''));
$filePath = trim((string) ($_POST['file_path'] ?? ''));
$isFounder = !empty($_POST['is_founder']) ? 1 : 0;
$sortOrder = (int) ($_POST['sort_order'] ?? 0);
$isActive = isset($_POST['is_active']) && (string) $_POST['is_active'] === '0' ? 0 : 1;

if ($name === '' || $role === '') {
    json_response(['ok' => false, 'error' => 'Name and role are required.'], 422);
}

$skillsList = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n|,/', $skillsRaw) ?: [])));
$skills = implode("\n", $skillsList);

$existing = null;
if ($action === 'update') {
    $sel = $pdo->prepare('SELECT * FROM `team_members` WHERE `id` = :id LIMIT 1');
    $sel->execute([':id' => $id]);
    $existing = $sel->fetch();
    if (!$existing) {
        json_response(['ok' => false, 'error' => 'Team member not found.'], 404);
    }
    if ($filePath === '') {
        $filePath = (string) ($existing['file_path'] ?? '');
    }
}

if (!empty($_FILES['photo_file']) && (int) ($_FILES['photo_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $up = upload_media($_FILES['photo_file'], 'image');
    if (!$up['ok']) {
        json_response(['ok' => false, 'error' => $up['error']], 422);
    }
    if ($existing && !empty($existing['file_path'])) {
        delete_uploaded_file((string) $existing['file_path']);
    }
    $filePath = (string) $up['file_path'];
}

$baseSlug = slugify($name);
$slug = $baseSlug;
$suffix = 2;
while (true) {
    $chk = $pdo->prepare('SELECT `id` FROM `team_members` WHERE `slug` = :s AND `id` <> :id LIMIT 1');
    $chk->execute([':s' => $slug, ':id' => $id]);
    if (!$chk->fetch()) {
        break;
    }
    $slug = $baseSlug . '-' . $suffix++;
}

if ($action === 'create') {
    $ins = $pdo->prepare(
        'INSERT INTO `team_members` (`name`, `slug`, `role`, `bio`, `description`, `skills`, `file_path`, `is_founder`, `sort_order`, `is_active`)
         VALUES (:name, :slug, :role, :bio, :description, :skills, :file_path, :is_founder, :sort_order, :is_active)'
    );
    $ins->execute([
        ':name' => mb_substr($name, 0, 150),
        ':slug' => mb_substr($slug, 0, 160),
        ':role' => mb_substr($role, 0, 150),
        ':bio' => $bio !== '' ? $bio : null,
        ':description' => $description !== '' ? $description : null,
        ':skills' => $skills,
        ':file_path' => $filePath !== '' ? $filePath : null,
        ':is_founder' => $isFounder,
        ':sort_order' => $sortOrder,
        ':is_active' => $isActive,
    ]);
    json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
}

$upd = $pdo->prepare(
    'UPDATE `team_members`
     SET `name` = :name, `slug` = :slug, `role` = :role, `bio` = :bio, `description` = :description,
         `skills` = :skills, `file_path` = :file_path, `is_founder` = :is_founder,
         `sort_order` = :sort_order, `is_active` = :is_active
     WHERE `id` = :id'
);
$upd->execute([
    ':name' => mb_substr($name, 0, 150),
    ':slug' => mb_substr($slug, 0, 160),
    ':role' => mb_substr($role, 0, 150),
    ':bio' => $bio !== '' ? $bio : null,
    ':description' => $description !== '' ? $description : null,
    ':skills' => $skills,
    ':file_path' => $filePath !== '' ? $filePath : null,
    ':is_founder' => $isFounder,
    ':sort_order' => $sortOrder,
    ':is_active' => $isActive,
    ':id' => $id,
]);

json_response(['ok' => true, 'id' => $id]);
