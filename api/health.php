<?php
declare(strict_types=1);

// Health check - must NOT require DB for Railway healthcheck to pass
// Returns 200 even if DB is down, but reports db status in payload

// Avoid loading full functions.php which tries db() on settings()
// We only need config for env
require_once dirname(__DIR__) . '/config/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$checks = [
    'ok' => true,
    'service' => 'mexa',
    'timestamp' => gmdate('c'),
    'env' => APP_ENV,
    'php' => PHP_VERSION,
];

// Check writable dirs
$checks['storage_writable'] = is_writable(MEXA_STORAGE_DIR);
$checks['uploads_writable'] = is_writable(MEXA_UPLOADS_DIR);

// Try DB but don't fail whole request
$dbStatus = 'unknown';
$dbError = null;
try {
    // Use the resolver without throwing HTML exit - we need to catch
    // Temporarily set APP_DEBUG true behavior by directly trying PDO
    require_once dirname(__DIR__) . '/config/db.php';
    // db() will exit with HTML if missing - so we do manual check instead
    $cfg = mexa_resolve_db_env();
    if (($cfg['name'] ?? '') === '' || ($cfg['user'] ?? '') === '') {
        $dbStatus = 'not_configured';
        $dbError = 'DB_NAME or DB_USER empty. Set Railway Variables.';
        $checks['ok'] = false;
    } else {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $cfg['host'], $cfg['port'], $cfg['name'], $cfg['charset'] ?? 'utf8mb4');
        $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3,
        ]);
        $pdo->query('SELECT 1');
        $dbStatus = 'connected';
    }
} catch (Throwable $e) {
    $dbStatus = 'error';
    $dbError = $e->getMessage();
    // Don't mark overall as failed strictly - let Railway pass healthcheck
    // But include warning
}

$checks['db'] = $dbStatus;
if ($dbError !== null) {
    $checks['db_error'] = $dbError;
    // Provide hint for Railway
    $checks['hint'] = 'Railway → Variables: set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS or attach MySQL plugin (MYSQLHOST etc) or set DATABASE_URL.';
}

http_response_code(200);
echo json_encode($checks, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
