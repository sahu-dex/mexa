<?php

declare(strict_types=1);

/**
 * Temporary cPanel compatibility check for MEXA MOTION (Laravel 12).
 *
 * 1. Replace the token below with a long random value BEFORE uploading.
 * 2. Open this file in the browser and submit the token (POST, not URL).
 * 3. Review the report, optionally generate a fresh APP_KEY once.
 * 4. Remove this file from the server immediately afterwards.
 *
 * It never prints existing .env values, absolute server paths, a full PHP
 * configuration dump, or database credentials. Keep it out of Git history after use.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

$token = 'REPLACE_WITH_A_LONG_RANDOM_TOKEN';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, private, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function yesNo(?bool $ok): string
{
    if ($ok === null) {
        return '<span class="info">CHECK MANUALLY</span>';
    }

    return $ok ? '<span class="ok">OK</span>' : '<span class="bad">ACTION NEEDED</span>';
}

function iniToBytes(string $value): int
{
    $value = trim($value);
    if ($value === '-1') {
        return PHP_INT_MAX;
    }
    if (!preg_match('/^(\d+)([KMG]?)$/i', $value, $matches)) {
        return 0;
    }

    $multiplier = match (strtoupper($matches[2])) {
        'G' => 1073741824,
        'M' => 1048576,
        'K' => 1024,
        default => 1,
    };

    return (int) $matches[1] * $multiplier;
}

function envMap(string $path): array
{
    if (!is_file($path) || !is_readable($path)) {
        return [];
    }

    $values = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $position = strpos($line, '=');
        if ($position === false) {
            continue;
        }
        $key = trim(substr($line, 0, $position));
        $value = trim(substr($line, $position + 1));
        if ($key === '') {
            continue;
        }
        if (strlen($value) >= 2 && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
            $value = substr($value, 1, -1);
        }
        $values[$key] = $value;
    }

    return $values;
}

function truthy(string $value): bool
{
    return in_array(strtolower(trim($value)), ['1', 'true', 'on', 'yes'], true);
}

function falsy(string $value): bool
{
    return in_array(strtolower(trim($value)), ['0', 'false', 'off', 'no'], true);
}

function hasRealValue(array $env, string $key): bool
{
    $value = strtolower(trim((string) ($env[$key] ?? '')));

    return $value !== '' && !str_contains($value, 'replace-with') && !str_contains($value, 'your-domain');
}

$provided = isset($_POST['token']) && is_string($_POST['token']) ? $_POST['token'] : '';
$tokenReady = $token !== '' && $token !== 'REPLACE_WITH_A_LONG_RANDOM_TOKEN';
$authorized = $tokenReady && hash_equals($token, $provided);

if (!$authorized) {
    http_response_code(403);
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>MEXA MOTION preflight</title>'
        .'<meta name="viewport" content="width=device-width,initial-scale=1">'
        .'<style>body{font:16px/1.5 system-ui,sans-serif;max-width:680px;margin:3rem auto;padding:0 1rem;color:#102a56}'
        .'code{background:#eef4ff;padding:.1rem .35rem;border-radius:.25rem}'
        .'input,button{font:inherit;padding:.55rem .75rem;margin-top:.5rem}'
        .'.warn{background:#fff4e5;border-left:4px solid #e58b00;padding:.75rem 1rem}</style></head><body>'
        .'<h1>MEXA MOTION cPanel preflight</h1>';
    if (!$tokenReady) {
        echo '<div class="warn">Set a long random <code>$token</code> inside this file before uploading it. '
            .'Then reload this page and submit that token. Remove this file after the check.</div>';
    } else {
        echo '<p>Enter the token you placed in this file. It is sent with POST and is not printed back.</p>'
            .'<form method="post" autocomplete="off"><label>Token<br>'
            .'<input type="password" name="token" required autofocus></label><br>'
            .'<button type="submit">Run compatibility check</button></form>';
    }
    echo '<p class="warn">Remove <code>public/cpanel-preflight.php</code> from the server as soon as you finish.</p>'
        .'</body></html>';
    exit;
}

$root = dirname(__DIR__);
$env = envMap($root.'/.env');
$generateKey = isset($_POST['generate_key']) && $_POST['generate_key'] === '1';
$generatedKey = null;
if ($generateKey) {
    try {
        $generatedKey = 'base64:'.base64_encode(random_bytes(32));
    } catch (Throwable) {
        $generatedKey = null;
    }
}

$requiredExtensions = [
    'ctype', 'curl', 'dom', 'fileinfo', 'filter', 'hash', 'iconv', 'json',
    'libxml', 'mbstring', 'openssl', 'pcre', 'pdo', 'pdo_mysql', 'session',
    'tokenizer', 'xml',
];
$optionalExtensions = ['bcmath', 'exif', 'gd', 'intl', 'zip'];

$rewriteKnown = function_exists('apache_get_modules');
$rewriteOk = $rewriteKnown ? in_array('mod_rewrite', (array) apache_get_modules(), true) : null;
$pdoMysqlOk = class_exists('PDO') && in_array('mysql', PDO::getAvailableDrivers(), true);
$https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
    || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);

$uploadBytes = iniToBytes((string) ini_get('upload_max_filesize'));
$postBytes = iniToBytes((string) ini_get('post_max_size'));
$memoryBytes = iniToBytes((string) ini_get('memory_limit'));
$uploadLimitOk = $uploadBytes >= 210 * 1048576;
$postLimitOk = $postBytes >= 215 * 1048576 && $postBytes > $uploadBytes;
$memoryLimitOk = $memoryBytes === PHP_INT_MAX || $memoryBytes >= 256 * 1048576;
$executionLimitOk = (int) ini_get('max_execution_time') === 0 || (int) ini_get('max_execution_time') >= 300;
$inputTimeOk = (int) ini_get('max_input_time') === -1 || (int) ini_get('max_input_time') >= 300;
$fileUploadsOk = truthy((string) ini_get('file_uploads'));

$appUrl = (string) ($env['APP_URL'] ?? '');
$appUrlOk = str_starts_with(strtolower($appUrl), 'https://')
    && !preg_match('/(localhost|127\.0\.0\.1|example\.invalid|your-domain)/i', $appUrl);
$appKeyOk = str_starts_with((string) ($env['APP_KEY'] ?? ''), 'base64:')
    && strlen((string) ($env['APP_KEY'] ?? '')) > 20;
$appDebugOk = array_key_exists('APP_DEBUG', $env) && falsy((string) $env['APP_DEBUG']);
$appEnvOk = strtolower((string) ($env['APP_ENV'] ?? '')) === 'production';
$secureCookieOk = array_key_exists('SESSION_SECURE_COOKIE', $env) && truthy((string) $env['SESSION_SECURE_COOKIE']);
$sessionEncryptOk = array_key_exists('SESSION_ENCRYPT', $env) && truthy((string) $env['SESSION_ENCRYPT']);
$sessionHttpOnlyOk = array_key_exists('SESSION_HTTP_ONLY', $env) && truthy((string) $env['SESSION_HTTP_ONLY']);
$dbOk = strtolower((string) ($env['DB_CONNECTION'] ?? '')) === 'mysql';
foreach (['DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'] as $key) {
    $dbOk = $dbOk && hasRealValue($env, $key);
}
$charsetOk = strtolower((string) ($env['DB_CHARSET'] ?? '')) === 'utf8mb4'
    && strtolower((string) ($env['DB_COLLATION'] ?? '')) === 'utf8mb4_unicode_ci';

$projectFiles = [
    '.env' => $root.'/.env',
    'vendor/autoload.php' => $root.'/vendor/autoload.php',
    'composer.lock' => $root.'/composer.lock',
    'root .htaccess' => $root.'/.htaccess',
    'public/.htaccess' => __DIR__.'/.htaccess',
    'database/schema/cpanel-mysql.sql' => $root.'/database/schema/cpanel-mysql.sql',
    'site-snapshot.json' => $root.'/database/seeders/data/site-snapshot.json',
];

$writableDirs = [
    'storage/' => $root.'/storage',
    'storage/app/public/media/' => $root.'/storage/app/public/media',
    'storage/app/private/' => $root.'/storage/app/private',
    'storage/framework/cache/data/' => $root.'/storage/framework/cache/data',
    'storage/framework/sessions/' => $root.'/storage/framework/sessions',
    'storage/framework/views/' => $root.'/storage/framework/views',
    'storage/logs/' => $root.'/storage/logs',
    'bootstrap/cache/' => $root.'/bootstrap/cache',
];

$symlinkPresent = is_link(__DIR__.'/storage') || is_dir(__DIR__.'/storage');

echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    .'<meta name="viewport" content="width=device-width,initial-scale=1">'
    .'<title>MEXA MOTION cPanel preflight</title>'
    .'<style>body{font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#102a56;background:#f7faff}'
    .'h1,h2{color:#0b3b8f}table{border-collapse:collapse;width:100%;background:#fff;margin:.5rem 0 1.5rem}'
    .'th,td{border:1px solid #d7e3f7;padding:.5rem .65rem;text-align:left;vertical-align:top}'
    .'th{background:#eef4ff}.ok{color:#087a3b;font-weight:700}.bad{color:#b3261e;font-weight:700}.info{color:#6c5600;font-weight:700}'
    .'.warn,.note{background:#fff4e5;border-left:4px solid #e58b00;padding:.75rem 1rem;margin:1rem 0}'
    .'.note{background:#eef4ff;border-left-color:#2f6fed}code{background:#eef4ff;padding:.1rem .35rem;border-radius:.25rem;word-break:break-all}'
    .'a{color:#175cd3}form{margin:.75rem 0}</style></head><body>'
    .'<h1>MEXA MOTION cPanel preflight</h1>'
    .'<div class="warn"><strong>Remove this file now after use:</strong> remove '
    .'<code>public/cpanel-preflight.php</code> from the server. It is a temporary diagnostic only.</div>';

if ($generatedKey !== null) {
    echo '<div class="note"><strong>Fresh APP_KEY (copy once into .env, never share):</strong><br>'
        .'<code>'.h($generatedKey).'</code><br>'
        .'This value was generated in memory only; it was not written to a file or logged.</div>';
} elseif ($generateKey) {
    echo '<div class="warn">APP_KEY could not be generated. Use <code>php artisan key:generate --show</code> '
        .'on a local PHP 8.2 machine instead.</div>';
}

echo '<h2>Runtime</h2><table><tr><th>Check</th><th>Result</th><th>What to do</th></tr>'
    .'<tr><td>PHP version (need 8.2+)</td><td>'.yesNo(version_compare(PHP_VERSION, '8.2.0', '>=')).'</td><td>'.h(PHP_VERSION).' — set PHP 8.2/8.3 in cPanel Select PHP Version.</td></tr>'
    .'<tr><td>Required PHP extensions</td><td>'.yesNo(count(array_filter($requiredExtensions, 'extension_loaded')) === count($requiredExtensions)).'</td><td>'
    .h(implode(', ', array_values(array_filter($requiredExtensions, static fn (string $ext): bool => !extension_loaded($ext)))) ?: 'all present')
    .' — enable missing ones in cPanel PHP Extensions.</td></tr>'
    .'<tr><td>PDO MySQL driver</td><td>'.yesNo($pdoMysqlOk).'</td><td>Enable pdo_mysql / PDO MySQL for the selected PHP version.</td></tr>'
    .'<tr><td>Optional extensions</td><td><span class="info">INFO</span></td><td>'
    .h(implode(', ', array_values(array_filter($optionalExtensions, static fn (string $ext): bool => !extension_loaded($ext)))) ?: 'all present')
    .' — zip/gd/intl help Composer/image work but are not required at runtime here.</td></tr>'
    .'<tr><td>mod_rewrite</td><td>'.yesNo($rewriteOk).'</td><td>'
    .($rewriteKnown ? 'Check the link below.' : 'Apache module list unavailable; test the rewrite link below.')
    .'</td></tr>'
    .'<tr><td>Rewrite / AllowOverride test</td><td><span class="info">CHECK MANUALLY</span></td>'
    .'<td>Open <a href="./service" target="_blank" rel="noopener">./service</a> (no <code>index.php</code>). '
    .'If the Service page loads, rewrite works; 403/404 means fix mod_rewrite/AllowOverride with the host.</td></tr>'
    .'<tr><td>HTTPS detected</td><td>'.yesNo($https).'</td><td>Use an SSL certificate and HTTPS APP_URL in production.</td></tr>'
    .'</table>';

echo '<h2>Upload limits (200 MB videos)</h2><table><tr><th>Check</th><th>Result</th><th>What to do</th></tr>'
    .'<tr><td>file_uploads</td><td>'.yesNo($fileUploadsOk).'</td><td>Enable file uploads in MultiPHP INI Editor.</td></tr>'
    .'<tr><td>upload_max_filesize &ge; 210M</td><td>'.yesNo($uploadLimitOk).'</td><td>Current: '.h((string) ini_get('upload_max_filesize')).'</td></tr>'
    .'<tr><td>post_max_size &ge; 215M and above upload limit</td><td>'.yesNo($postLimitOk).'</td><td>Current: '.h((string) ini_get('post_max_size')).'</td></tr>'
    .'<tr><td>memory_limit &ge; 256M or unlimited</td><td>'.yesNo($memoryLimitOk).'</td><td>Current: '.h((string) ini_get('memory_limit')).'</td></tr>'
    .'<tr><td>max_execution_time &ge; 300 or 0</td><td>'.yesNo($executionLimitOk).'</td><td>Current: '.h((string) ini_get('max_execution_time')).'</td></tr>'
    .'<tr><td>max_input_time &ge; 300 or -1</td><td>'.yesNo($inputTimeOk).'</td><td>Current: '.h((string) ini_get('max_input_time')).'</td></tr>'
    .'</table>';

echo '<h2>Project files (no values shown)</h2><table><tr><th>File</th><th>Result</th></tr>';
foreach ($projectFiles as $label => $path) {
    echo '<tr><td>'.h($label).'</td><td>'.yesNo(is_file($path)).'</td></tr>';
}
echo '</table>';

echo '<h2>Writable runtime directories</h2><table><tr><th>Relative path</th><th>Result</th></tr>';
foreach ($writableDirs as $label => $path) {
    echo '<tr><td>'.h($label).'</td><td>'.yesNo(is_dir($path) && is_writable($path)).'</td></tr>';
}
echo '</table>';

echo '<h2>.env configuration (values are not printed)</h2><table><tr><th>Check</th><th>Result</th></tr>'
    .'<tr><td>APP_ENV=production</td><td>'.yesNo($appEnvOk).'</td></tr>'
    .'<tr><td>APP_DEBUG=false</td><td>'.yesNo($appDebugOk).'</td></tr>'
    .'<tr><td>APP_URL is real HTTPS domain</td><td>'.yesNo($appUrlOk).'</td></tr>'
    .'<tr><td>APP_KEY looks set</td><td>'.yesNo($appKeyOk).'</td></tr>'
    .'<tr><td>MySQL settings filled from cPanel</td><td>'.yesNo($dbOk).'</td></tr>'
    .'<tr><td>utf8mb4 / utf8mb4_unicode_ci</td><td>'.yesNo($charsetOk).'</td></tr>'
    .'<tr><td>SESSION_SECURE_COOKIE=true</td><td>'.yesNo($secureCookieOk).'</td></tr>'
    .'<tr><td>SESSION_ENCRYPT=true</td><td>'.yesNo($sessionEncryptOk).'</td></tr>'
    .'<tr><td>SESSION_HTTP_ONLY=true</td><td>'.yesNo($sessionHttpOnlyOk).'</td></tr>'
    .'<tr><td>ImgBB key required?</td><td><span class="ok">NO</span></td></tr>'
    .'<tr><td>FILESYSTEM_DISK override required?</td><td><span class="ok">NO</span></td></tr>'
    .'<tr><td>public/storage symlink required?</td><td><span class="ok">NO</span></td></tr>'
    .'</table>';

echo '<div class="note">Custom <code>/storage/media/{file}</code> route serves registered uploads from '
    .'<code>storage/app/public/media/</code> through Laravel. A symlink is optional; if one exists '
    .'(currently '.($symlinkPresent ? 'yes' : 'no').'), <code>public/.htaccess</code> still forces media through Laravel '
    .'and blocks other direct storage paths.</div>';

echo '<h2>One-time APP_KEY helper (no Terminal)</h2>'
    .'<p>If you cannot run <code>php artisan key:generate --show</code> locally, submit this form once, '
    .'copy the generated value into <code>APP_KEY</code> in cPanel .env, then remove this file. '
    .'Re-enter the token; it is never printed back.</p>'
    .'<form method="post" autocomplete="off"><label>Token<br>'
    .'<input type="password" name="token" required></label><br>'
    .'<label><input type="checkbox" name="generate_key" value="1"> Generate a fresh APP_KEY</label><br>'
    .'<button type="submit">Generate once</button></form>';

echo '<p><strong>After the check:</strong> remove this file, keep <code>.env</code> outside the public web root, '
    .'and follow <code>docs/CPANEL_DEPLOYMENT.md</code> for database/import and permissions.</p>'
    .'</body></html>';
