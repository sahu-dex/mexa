<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

define('MEXA_ROOT', dirname(__DIR__));
define('MEXA_CONFIG_DIR', __DIR__);
define('MEXA_UPLOADS_DIR', MEXA_ROOT . '/uploads');
define('MEXA_STORAGE_DIR', MEXA_ROOT . '/storage');

function mexa_load_env(): array
{
    static $loaded = null;
    if ($loaded !== null) {
        return $loaded;
    }

    $loaded = [];
    $candidates = [
        dirname(MEXA_ROOT) . '/.env.mexa',
        MEXA_ROOT . '/.env',
        __DIR__ . '/.env',
    ];

    $envFile = null;
    foreach ($candidates as $candidate) {
        if (is_file($candidate) && is_readable($candidate)) {
            $envFile = $candidate;
            break;
        }
    }

    if ($envFile === null) {
        return $loaded;
    }

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return $loaded;
    }

    $commentChar = chr(35);

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, $commentChar)) {
            continue;
        }

        $eqPos = strpos($trimmed, '=');
        if ($eqPos === false) {
            continue;
        }

        $key = trim(substr($trimmed, 0, $eqPos));
        $val = trim(substr($trimmed, $eqPos + 1));

        if ($key === '') {
            continue;
        }

        if (
            (str_starts_with($val, '"') && str_ends_with($val, '"')) ||
            (str_starts_with($val, "'") && str_ends_with($val, "'"))
        ) {
            $val = substr($val, 1, -1);
        } else {
            $inlinePos = strpos($val, ' ' . $commentChar);
            if ($inlinePos !== false) {
                $val = rtrim(substr($val, 0, $inlinePos));
            }
        }

        $loaded[$key] = $val;
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $val;
        }
    }

    return $loaded;
}

mexa_load_env();

function env_val(string $key, mixed $default = null): mixed
{
    $env = mexa_load_env();
    if (array_key_exists($key, $env)) {
        return $env[$key];
    }
    if (array_key_exists($key, $_ENV)) {
        return $_ENV[$key];
    }
    $sys = getenv($key);
    if ($sys !== false) {
        return $sys;
    }
    return $default;
}

define('APP_ENV', strtolower((string) env_val('APP_ENV', 'production')));
define('APP_DEBUG', APP_ENV === 'development');
define('APP_NAME', (string) env_val('APP_NAME', 'Mexa Motion'));
define('APP_URL', rtrim((string) env_val('APP_URL', ''), '/'));
define('APP_TIMEZONE', (string) env_val('APP_TIMEZONE', 'Asia/Dhaka'));

define('MAIL_FROM', (string) env_val('MAIL_FROM', 'noreply@example.com'));
define('MAIL_FROM_NAME', (string) env_val('MAIL_FROM_NAME', 'Mexa Motion'));
define('MAIL_TO_DEFAULT', (string) env_val('MAIL_TO', 'admin@example.com'));
define('ADMIN_SETUP_KEY', (string) env_val('ADMIN_SETUP_KEY', ''));

define('MAX_IMAGE_BYTES', max(512000, (int) env_val('MAX_IMAGE_BYTES', 5 * 1024 * 1024)));
define('MAX_VIDEO_BYTES', max(1048576, (int) env_val('MAX_VIDEO_BYTES', 50 * 1024 * 1024)));

date_default_timezone_set(APP_TIMEZONE ?: 'UTC');
if (function_exists('mb_internal_encoding')) {
    mb_internal_encoding('UTF-8');
}

error_reporting(E_ALL);
if (APP_DEBUG) {
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
} else {
    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');
    ini_set('log_errors', '1');
    $logDir = MEXA_STORAGE_DIR . '/logs';
    if (is_dir($logDir) && is_writable($logDir)) {
        ini_set('error_log', $logDir . '/php-error.log');
    }
}
