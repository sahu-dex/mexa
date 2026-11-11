<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = (string) env_val('DB_HOST', '127.0.0.1');
    $port = (int) env_val('DB_PORT', 3306);
    $dbname = (string) env_val('DB_NAME', '');
    $user = (string) env_val('DB_USER', '');
    $pass = (string) env_val('DB_PASS', '');
    $charset = (string) env_val('DB_CHARSET', 'utf8mb4');

    if ($dbname === '' || $user === '') {
        $msg = 'Database configuration missing.';
        error_log('[Mexa Motion DB] ' . $msg);
        if (APP_DEBUG || PHP_SAPI === 'cli') {
            throw new RuntimeException($msg);
        }
        http_response_code(500);
        exit('Service temporarily unavailable.');
    }

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $dbname, $charset);

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        error_log('[Mexa Motion DB Error] ' . $e->getMessage());
        if (APP_DEBUG || PHP_SAPI === 'cli') {
            throw new RuntimeException('Database connection failed: ' . $e->getMessage());
        }
        http_response_code(500);
        exit('Database connection failed.');
    }

    return $pdo;
}
