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
        json_response(['ok' => false, 'error' => 'Invalid package ID.'], 422);
    }
    $del = $pdo->prepare('DELETE FROM `packages` WHERE `id` = :id');
    $del->execute([':id' => $id]);
    json_response(['ok' => true]);
}

if (!in_array($action, ['create', 'update'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid action.'], 422);
}

$id = (int) ($_POST['id'] ?? 0);
$serviceId = (int) ($_POST['service_id'] ?? 0);
$quality = strtolower(trim((string) ($_POST['quality'] ?? 'high')));
$name = trim((string) ($_POST['name'] ?? ''));
$price = (float) ($_POST['price'] ?? 0);
$currency = strtoupper(trim((string) ($_POST['currency'] ?? 'USD')));
$delivery = trim((string) ($_POST['delivery_time'] ?? ($_POST['delivery'] ?? '')));
$revisions = trim((string) ($_POST['revisions'] ?? ''));
$badge = trim((string) ($_POST['badge'] ?? ''));
$isHighlighted = (!empty($_POST['is_highlighted']) || !empty($_POST['highlight'])) ? 1 : 0;
$description = trim((string) ($_POST['description'] ?? ''));
$featuresRaw = trim((string) ($_POST['features'] ?? ''));
$sortOrder = (int) ($_POST['sort_order'] ?? 0);

if ($serviceId <= 0 || !in_array($quality, ['normal', 'high', 'premium'], true) || $name === '' || $price < 0) {
    json_response(['ok' => false, 'error' => 'Please provide valid package fields.'], 422);
}

$features = implode("\n", split_lines($featuresRaw));

if ($action === 'create') {
    $stmt = $pdo->prepare(
        'INSERT INTO `packages` (`service_id`, `quality`, `name`, `price`, `currency`, `delivery`, `revisions`, `badge`, `highlight`, `description`, `features`, `sort_order`)
         VALUES (:sid, :q, :n, :p, :c, :d, :r, :b, :h, :desc, :f, :so)
         ON DUPLICATE KEY UPDATE
            `name` = VALUES(`name`), `price` = VALUES(`price`), `currency` = VALUES(`currency`),
            `delivery` = VALUES(`delivery`), `revisions` = VALUES(`revisions`),
            `badge` = VALUES(`badge`), `highlight` = VALUES(`highlight`),
            `description` = VALUES(`description`), `features` = VALUES(`features`), `sort_order` = VALUES(`sort_order`)'
    );
    $stmt->execute([
        ':sid' => $serviceId,
        ':q' => $quality,
        ':n' => mb_substr($name, 0, 120),
        ':p' => $price,
        ':c' => mb_substr($currency ?: 'USD', 0, 10),
        ':d' => $delivery !== '' ? mb_substr($delivery, 0, 120) : null,
        ':r' => $revisions !== '' ? mb_substr($revisions, 0, 120) : null,
        ':b' => $badge !== '' ? mb_substr($badge, 0, 60) : null,
        ':h' => $isHighlighted,
        ':desc' => $description !== '' ? $description : null,
        ':f' => $features,
        ':so' => $sortOrder,
    ]);
    json_response(['ok' => true]);
}

$upd = $pdo->prepare(
    'UPDATE `packages`
     SET `service_id` = :sid, `quality` = :q, `name` = :n, `price` = :p, `currency` = :c,
         `delivery` = :d, `revisions` = :r, `badge` = :b, `highlight` = :h,
         `description` = :desc, `features` = :f, `sort_order` = :so
     WHERE `id` = :id'
);
$upd->execute([
    ':sid' => $serviceId,
    ':q' => $quality,
    ':n' => mb_substr($name, 0, 120),
    ':p' => $price,
    ':c' => mb_substr($currency ?: 'USD', 0, 10),
    ':d' => $delivery !== '' ? mb_substr($delivery, 0, 120) : null,
    ':r' => $revisions !== '' ? mb_substr($revisions, 0, 120) : null,
    ':b' => $badge !== '' ? mb_substr($badge, 0, 60) : null,
    ':h' => $isHighlighted,
    ':desc' => $description !== '' ? $description : null,
    ':f' => $features,
    ':so' => $sortOrder,
    ':id' => $id,
]);

json_response(['ok' => true]);
