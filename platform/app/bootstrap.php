<?php
declare(strict_types=1);

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) { http_response_code(503); exit('Application is not configured.'); }
$config = require $configPath;
ini_set('display_errors', '0');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly' => true, 'secure' => str_starts_with($config['base_url'], 'https://'), 'samesite' => 'Lax', 'path' => '/']);
session_start();
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
try {
    $db = new PDO('mysql:host='.$config['db_host'].';dbname='.$config['db_name'].';charset=utf8mb4', $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
} catch (Throwable $e) { error_log($e->getMessage()); http_response_code(503); exit('Service temporarily unavailable.'); }
function e(?string $s): string { return htmlspecialchars($s ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function redirect(string $path): never { header('Location: '.$path, true, 303); exit; }
function csrf(): string { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32)); return $_SESSION['csrf']; }
function csrf_field(): string { return '<input type="hidden" name="csrf" value="'.e(csrf()).'">'; }
function verify_csrf(): void { if (!isset($_POST['csrf']) || !hash_equals(csrf(), (string)$_POST['csrf'])) { http_response_code(419); exit('Session expired. Please refresh and try again.'); } }
function user(PDO $db): ?array {
    if (empty($_SESSION['uid'])) return null;
    $q=$db->prepare('SELECT id, name, email, role FROM users WHERE id=? AND active=1'); $q->execute([$_SESSION['uid']]); return $q->fetch(PDO::FETCH_ASSOC) ?: null;
}
function flash(string $message): void { $_SESSION['flash']=$message; }
function take_flash(): string { $v=$_SESSION['flash'] ?? ''; unset($_SESSION['flash']); return $v; }
function require_user(?array $user): void { if (!$user) redirect('/login'); }
function require_admin(?array $user): void { if (!$user) redirect('/login'); if ($user['role'] !== 'admin') { http_response_code(403); exit('Forbidden'); } }
