<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_csrf(true);

if (honeypot_triggered()) {
    json_response(['ok' => true, 'status' => 'pending']);
}

if (!rate_limit_allow('review_submit', 4, 1800)) {
    json_response(['ok' => false, 'error' => 'Too many review submissions. Please try again later.'], 429);
}

$name = trim((string) ($_POST['name'] ?? ''));
$role = trim((string) ($_POST['role'] ?? ''));
$rating = isset($_POST['rating']) ? (int) $_POST['rating'] : 0;
$body = trim((string) ($_POST['body'] ?? ''));

if ($rating < 1 || $rating > 5) {
    json_response(['ok' => false, 'error' => 'Please select a star rating from 1 to 5.'], 422);
}
if ($name === '' || mb_strlen($name) > 60) {
    json_response(['ok' => false, 'error' => 'Please enter your name (up to 60 characters).'], 422);
}
if (mb_strlen($role) > 60) {
    json_response(['ok' => false, 'error' => 'Role/title must be 60 characters or fewer.'], 422);
}
if (mb_strlen($body) < 15 || mb_strlen($body) > 900) {
    json_response(['ok' => false, 'error' => 'Review text must be between 15 and 900 characters.'], 422);
}

$photoPath = '';
if (!empty($_FILES['photo']) && (int) ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $upload = upload_media($_FILES['photo'], 'image');
    if (!$upload['ok']) {
        json_response(['ok' => false, 'error' => $upload['error']], 422);
    }
    $photoPath = (string) $upload['file_path'];
}

$stmt = db()->prepare(
    'INSERT INTO `reviews` (`name`, `role`, `rating`, `body`, `file_path`, `is_featured`, `status`, `ip_hash`)
     VALUES (:name, :role, :rating, :body, :file_path, 0, :status, :ip_hash)'
);
$stmt->execute([
    ':name' => $name,
    ':role' => $role !== '' ? $role : null,
    ':rating' => $rating,
    ':body' => $body,
    ':file_path' => $photoPath !== '' ? $photoPath : null,
    ':status' => 'pending',
    ':ip_hash' => client_ip_hash(),
]);

send_admin_notification(
    "[Pending Review] {$name} ({$rating}/5)",
    "New client review awaiting approval:\n\nName: {$name}\nRole: {$role}\nRating: {$rating}/5\n\n{$body}\n"
);

json_response([
    'ok' => true,
    'status' => 'pending',
]);
