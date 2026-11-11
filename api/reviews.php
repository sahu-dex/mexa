<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

$bundle = get_reviews_bundle(false);
$offset = isset($_GET['offset']) ? max(0, (int) $_GET['offset']) : 0;
$limit = isset($_GET['limit']) ? max(1, min(100, (int) $_GET['limit'])) : count($bundle['items']);

$items = $limit > 0 ? array_slice($bundle['items'], $offset, $limit) : $bundle['items'];
json_response([
    'ok' => true,
    'stats' => $bundle['stats'],
    'offset' => $offset,
    'limit' => $limit,
    'items' => $items,
]);
