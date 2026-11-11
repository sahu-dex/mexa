<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

$kind = isset($_GET['kind']) && in_array($_GET['kind'], ['video', 'image'], true) ? (string) $_GET['kind'] : null;
$category = isset($_GET['category']) ? trim((string) $_GET['category']) : null;
$section = isset($_GET['section']) && in_array($_GET['section'], ['recent', 'demo', 'short', 'preview'], true) ? (string) $_GET['section'] : null;

$bundle = get_work_bundle($kind, $category !== '' ? $category : null, $section);
json_response([
    'ok' => true,
    'count' => count($bundle['items']),
    'items' => $bundle['items'],
    'categories' => $bundle['categories'],
]);
