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
if ($id <= 0) {
    json_response(['ok' => false, 'error' => 'Invalid message ID.'], 422);
}

$pdo = db();

if ($action === 'delete') {
    $del = $pdo->prepare('DELETE FROM `messages` WHERE `id` = :id');
    $del->execute([':id' => $id]);
    json_response(['ok' => true]);
}

if ($action === 'status') {
    $status = trim((string) ($_POST['status'] ?? ''));
    if (!in_array($status, ['pending', 'approved', 'in_progress', 'completed', 'rejected'], true)) {
        json_response(['ok' => false, 'error' => 'Invalid status value.'], 422);
    }
    $upd = $pdo->prepare('UPDATE `messages` SET `status` = :s WHERE `id` = :id');
    $upd->execute([':s' => $status, ':id' => $id]);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Invalid action.'], 422);
