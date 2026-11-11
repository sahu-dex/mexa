<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_admin(true);
require_csrf(true);

$action = trim((string) ($_POST['action'] ?? ''));
$id = (int) ($_POST['id'] ?? 0);
$pdo = db();

if ($action === 'create') {
    $name = trim((string) ($_POST['name'] ?? ''));
    $role = trim((string) ($_POST['role'] ?? ''));
    $rating = max(1, min(5, (int) ($_POST['rating'] ?? 5)));
    $body = trim((string) ($_POST['body'] ?? ''));
    $isFeatured = !empty($_POST['is_featured']) ? 1 : 0;
    $status = in_array($_POST['status'] ?? '', ['pending', 'approved', 'rejected'], true) ? (string) $_POST['status'] : 'approved';
    $filePath = trim((string) ($_POST['file_path'] ?? ''));

    if ($name === '' || $body === '') {
        json_response(['ok' => false, 'error' => 'Name and review text are required.'], 422);
    }

    if (!empty($_FILES['photo_file']) && (int) ($_FILES['photo_file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $up = upload_media($_FILES['photo_file'], 'image');
        if (!$up['ok']) {
            json_response(['ok' => false, 'error' => $up['error']], 422);
        }
        $filePath = (string) $up['file_path'];
    }

    $ins = $pdo->prepare(
        'INSERT INTO `reviews` (`name`, `role`, `rating`, `body`, `file_path`, `is_featured`, `status`)
         VALUES (:name, :role, :rating, :body, :file_path, :is_featured, :status)'
    );
    $ins->execute([
        ':name' => mb_substr($name, 0, 80),
        ':role' => $role !== '' ? mb_substr($role, 0, 100) : null,
        ':rating' => $rating,
        ':body' => mb_substr($body, 0, 900),
        ':file_path' => $filePath !== '' ? $filePath : null,
        ':is_featured' => $isFeatured,
        ':status' => $status,
    ]);
    json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);
}

if ($id <= 0) {
    json_response(['ok' => false, 'error' => 'Invalid review ID.'], 422);
}

if ($action === 'delete') {
    $sel = $pdo->prepare('SELECT `file_path` FROM `reviews` WHERE `id` = :id LIMIT 1');
    $sel->execute([':id' => $id]);
    $row = $sel->fetch();
    if ($row && !empty($row['file_path'])) {
        delete_uploaded_media((string) $row['file_path']);
    }
    $del = $pdo->prepare('DELETE FROM `reviews` WHERE `id` = :id');
    $del->execute([':id' => $id]);
    json_response(['ok' => true]);
}

if (in_array($action, ['approve', 'reject', 'pending'], true)) {
    $statusMap = ['approve' => 'approved', 'reject' => 'rejected', 'pending' => 'pending'];
    $upd = $pdo->prepare('UPDATE `reviews` SET `status` = :s WHERE `id` = :id');
    $upd->execute([':s' => $statusMap[$action], ':id' => $id]);
    json_response(['ok' => true]);
}

if ($action === 'toggle_feature') {
    $upd = $pdo->prepare('UPDATE `reviews` SET `is_featured` = IF(`is_featured` = 1, 0, 1) WHERE `id` = :id');
    $upd->execute([':id' => $id]);
    json_response(['ok' => true]);
}

if ($action === 'update') {
    $name = trim((string) ($_POST['name'] ?? ''));
    $role = trim((string) ($_POST['role'] ?? ''));
    $rating = max(1, min(5, (int) ($_POST['rating'] ?? 5)));
    $body = trim((string) ($_POST['body'] ?? ''));
    $isFeatured = !empty($_POST['is_featured']) ? 1 : 0;
    $status = in_array($_POST['status'] ?? '', ['pending', 'approved', 'rejected'], true) ? (string) $_POST['status'] : 'approved';
    if ($name === '' || $body === '') {
        json_response(['ok' => false, 'error' => 'Name and review text are required.'], 422);
    }
    $upd = $pdo->prepare(
        'UPDATE `reviews` SET `name` = :name, `role` = :role, `rating` = :rating, `body` = :body, `is_featured` = :is_featured, `status` = :status WHERE `id` = :id'
    );
    $upd->execute([
        ':name' => mb_substr($name, 0, 80),
        ':role' => $role !== '' ? mb_substr($role, 0, 100) : null,
        ':rating' => $rating,
        ':body' => mb_substr($body, 0, 900),
        ':is_featured' => $isFeatured,
        ':status' => $status,
        ':id' => $id,
    ]);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Invalid action.'], 422);
