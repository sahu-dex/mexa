<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once __DIR__ . '/config.php';

/**
 * Resolve Railway / MySQL env fallbacks.
 * Railway MySQL plugin exposes: MYSQLHOST, MYSQLPORT, MYSQLDATABASE, MYSQLUSER, MYSQLPASSWORD
 * Also supports: DATABASE_URL (mysql://user:pass@host:port/dbname)
 */
function mexa_resolve_db_env(): array
{
    // 1) Try DATABASE_URL style envs first (Railway private/public URLs)
    $urlKeys = ['DATABASE_URL', 'MYSQL_URL', 'MYSQL_PUBLIC_URL', 'MYSQL_PRIVATE_URL', 'JAWSDB_URL', 'CLEARDB_DATABASE_URL'];
    foreach ($urlKeys as $urlKey) {
        $url = env_val($urlKey, '');
        if (is_string($url) && $url !== '' && str_contains($url, '://')) {
            $parsed = parse_url($url);
            if (is_array($parsed) && isset($parsed['host'])) {
                $db = [];
                $db['host'] = $parsed['host'] ?? '';
                $db['port'] = isset($parsed['port']) ? (int) $parsed['port'] : 3306;
                $db['user'] = isset($parsed['user']) ? urldecode((string) $parsed['user']) : '';
                $db['pass'] = isset($parsed['pass']) ? urldecode((string) $parsed['pass']) : '';
                $db['name'] = isset($parsed['path']) ? ltrim((string) $parsed['path'], '/') : '';
                // query string may contain charset etc - ignore
                // Strip query from dbname if present
                if (str_contains($db['name'], '?')) {
                    $db['name'] = explode('?', $db['name'], 2)[0];
                }
                if ($db['host'] !== '' && $db['name'] !== '' && $db['user'] !== '') {
                    return $db;
                }
            }
        }
    }

    // 2) Try direct env with Railway fallbacks
    $host = (string) env_val('DB_HOST', '');
    if ($host === '') {
        $host = (string) env_val('MYSQLHOST', '');
    }
    if ($host === '') {
        $host = (string) env_val('MYSQL_HOST', '');
    }
    if ($host === '') {
        $host = (string) env_val('DB_MYSQL_HOST', '');
    }
    if ($host === '') {
        $host = (string) env_val('DATABASE_HOST', '');
    }
    if ($host === '') {
        $host = '127.0.0.1';
    }

    $portRaw = env_val('DB_PORT', '');
    if ($portRaw === '' || $portRaw === null) {
        $portRaw = env_val('MYSQLPORT', '');
    }
    if ($portRaw === '' || $portRaw === null) {
        $portRaw = env_val('MYSQL_PORT', '');
    }
    if ($portRaw === '' || $portRaw === null) {
        $portRaw = env_val('DB_MYSQL_PORT', '');
    }
    $port = (int) ($portRaw !== '' ? $portRaw : 3306);
    if ($port <= 0) {
        $port = 3306;
    }

    $dbname = (string) env_val('DB_NAME', '');
    if ($dbname === '') {
        $dbname = (string) env_val('MYSQLDATABASE', '');
    }
    if ($dbname === '') {
        $dbname = (string) env_val('MYSQL_DATABASE', '');
    }
    if ($dbname === '') {
        $dbname = (string) env_val('DATABASE_NAME', '');
    }

    $user = (string) env_val('DB_USER', '');
    if ($user === '') {
        $user = (string) env_val('MYSQLUSER', '');
    }
    if ($user === '') {
        $user = (string) env_val('MYSQL_USER', '');
    }
    if ($user === '') {
        $user = (string) env_val('DATABASE_USER', '');
    }

    $pass = (string) env_val('DB_PASS', '');
    if ($pass === '') {
        // Railway uses MYSQLPASSWORD (and sometimes MYSQL_ROOT_PASSWORD)
        $pass = (string) env_val('MYSQLPASSWORD', '');
    }
    if ($pass === '') {
        $pass = (string) env_val('MYSQL_PASSWORD', '');
    }
    if ($pass === '') {
        $pass = (string) env_val('DATABASE_PASSWORD', '');
    }
    // DB_PASS may be empty for some setups (allowed), but we still return what we have
    $charset = (string) env_val('DB_CHARSET', 'utf8mb4');

    return [
        'host' => $host,
        'port' => $port,
        'name' => $dbname,
        'user' => $user,
        'pass' => $pass,
        'charset' => $charset,
    ];
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = mexa_resolve_db_env();
    $host = $cfg['host'];
    $port = $cfg['port'];
    $dbname = $cfg['name'];
    $user = $cfg['user'];
    $pass = $cfg['pass'];
    $charset = $cfg['charset'] ?? 'utf8mb4';

    if ($dbname === '' || $user === '') {
        $msg = 'Database configuration missing. Set DB_HOST/DB_NAME/DB_USER or Railway MYSQLHOST/MYSQLDATABASE/MYSQLUSER in Variables.';
        error_log('[Mexa Motion DB] ' . $msg . ' host=' . $host . ' db=' . $dbname . ' user=' . $user);
        if (APP_DEBUG || PHP_SAPI === 'cli') {
            throw new RuntimeException($msg);
        }
        // For API requests, return JSON; for pages, return HTML with help
        $isApi = str_contains((string) ($_SERVER['REQUEST_URI'] ?? ''), '/api/');
        $acceptsJson = str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
        if ($isApi || $acceptsJson) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'ok' => false,
                'error' => 'Service temporarily unavailable — database not configured.',
                'hint' => 'Set DB_HOST, DB_NAME, DB_USER, DB_PASS in Railway → Variables, or attach a MySQL plugin.',
            ], JSON_UNESCAPED_SLASHES);
            exit;
        }
        http_response_code(500);
        // Friendly HTML instead of blank text
        $helpUrl = 'https://github.com/sahu-dex/mexa#railway-deploy';
        echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Service temporarily unavailable — Mexa Motion</title>'
            . '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;background:#f8fbff;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}'
            . '.card{max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.08)}'
            . 'h1{font-size:20px;margin:0 0 8px} p{line-height:1.6;color:#334155} code{background:#f1f5f9;padding:2px 6px;border-radius:6px;font-size:13px}'
            . 'a{color:#1E5FEA;text-decoration:none} a:hover{text-decoration:underline} .badge{display:inline-block;background:#fee2e2;color:#991b1b;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;margin-bottom:12px}</style>'
            . '</head><body><div class="card"><div class="badge">503 — Service temporarily unavailable</div>'
            . '<h1>Database not configured</h1>'
            . '<p>App ta Railway-te deploy hoyeche kintu <code>DB_HOST / DB_NAME / DB_USER / DB_PASS</code> environment variables set kora nei. '
            . 'Railway Dashboard → <b>Variables</b> e giye MySQL credentials add korun, athoba Railway MySQL plugin attach korun.</p>'
            . '<p><b>Railway MySQL plugin use korle:</b> <code>MYSQLHOST</code>, <code>MYSQLDATABASE</code>, <code>MYSQLUSER</code>, <code>MYSQLPASSWORD</code>, <code>MYSQLPORT</code> auto set hoy — ei code seigulo support kore.</p>'
            . '<p style="font-size:13px;color:#64748b">Logs: Railway → Deployments → View Logs e <code>[Mexa Motion DB]</code> check korun.<br>Docs: <a href="' . htmlspecialchars($helpUrl, ENT_QUOTES) . '">' . htmlspecialchars($helpUrl, ENT_QUOTES) . '</a></p>'
            . '</div></body></html>';
        exit;
    }

    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $dbname, $charset);

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        error_log('[Mexa Motion DB Error] host=' . $host . ' db=' . $dbname . ' user=' . $user . ' err=' . $e->getMessage());
        if (APP_DEBUG || PHP_SAPI === 'cli') {
            throw new RuntimeException('Database connection failed: ' . $e->getMessage());
        }
        $isApi = str_contains((string) ($_SERVER['REQUEST_URI'] ?? ''), '/api/');
        $acceptsJson = str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');
        if ($isApi || $acceptsJson) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'ok' => false,
                'error' => 'Database connection failed.',
                'hint' => 'Check Railway Variables / MySQL service status. See logs for details.',
            ], JSON_UNESCAPED_SLASHES);
            exit;
        }
        http_response_code(500);
        echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Database connection failed — Mexa Motion</title>'
            . '<style>body{font-family:system-ui,sans-serif;background:#f8fbff;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}'
            . '.card{max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.08)}'
            . 'h1{font-size:20px;margin:0 0 8px} p{line-height:1.6;color:#334155} code{background:#f1f5f9;padding:2px 6px;border-radius:6px;font-size:13px}</style>'
            . '</head><body><div class="card"><h1>Database connection failed</h1>'
            . '<p>Railway MySQL-e connect kora jacche na. Railway Dashboard → <b>MySQL service</b> running ache kina ebong <b>Variables</b> thik ache kina check korun.</p>'
            . '<p style="font-size:13px;color:#64748b">Error logged to Railway logs. APP_ENV=development dile details dekhabe.</p>'
            . '</div></body></html>';
        exit;
    }

    return $pdo;
}
