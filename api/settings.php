<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

$all = settings();
unset($all['notification_email']);

json_response([
    'ok' => true,
    'settings' => $all,
]);
