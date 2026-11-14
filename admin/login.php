<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';
send_security_headers();
admin_no_cache_headers();

if (current_admin() !== null) {
    header('Location: ./');
    exit;
}

if (admins_count() === 0) {
    header('Location: setup');
    exit;
}

$error = '';
$notice = '';
if (!empty($_SESSION['admin_expired'])) {
    unset($_SESSION['admin_expired']);
    $notice = 'Your session expired. Please sign in again.';
} elseif (isset($_GET['out'])) {
    $notice = 'You have been signed out.';
}
$identity = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf(false);

    if (honeypot_triggered()) {
        $error = 'Invalid credentials.';
    } elseif (!rate_limit_allow('admin_login', 5, 900)) {
        $error = 'Too many failed login attempts. Please wait 15 minutes and try again.';
    } else {
        $identity = trim((string) ($_POST['identity'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        if ($identity === '' || $password === '') {
            $error = 'Enter your username or email and your password.';
        } else {

        $stmt = db()->prepare('SELECT * FROM `admins` WHERE `username` = :u OR `email` = :e LIMIT 1');
        $stmt->execute([':u' => $identity, ':e' => strtolower($identity)]);
        $admin = $stmt->fetch();

        if ($admin && password_verify($password, (string) $admin['password_hash'])) {
            if (password_needs_rehash((string) $admin['password_hash'], PASSWORD_DEFAULT)) {
                $reh = db()->prepare('UPDATE `admins` SET `password_hash` = :h WHERE `id` = :id');
                $reh->execute([':h' => password_hash($password, PASSWORD_DEFAULT), ':id' => (int) $admin['id']]);
            }
            admin_login_user($admin);

            header('Location: ./');
            exit;
        }
        }
        // One message for both cases, so the form does not reveal which
        // usernames exist.
        if ($error === '') {
            $error = 'Incorrect username/email or password.';
        }
    }
}
$siteName = setting('site_name', 'Mexa Motion');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Admin Login — <?= e($siteName) ?></title>
    <link rel="icon" type="image/png" href="../<?= e(setting('favicon_file_path', 'assets/images/favicon.png')) ?>">
    <link rel="stylesheet" href="../assets/css/admin-login.css?v=20261114">
</head>
<body class="al-body">
<main class="al-wrap">
    <section class="al-card" aria-labelledby="al-title">
        <div class="al-brand">
            <span class="al-mark" aria-hidden="true"><svg viewBox="0 0 120 100"><path d="M 17 89 L 25 11 L 47 11 L 64 43 L 91 11 L 112 11 L 104 89 L 81 89 L 85 51 L 62 78 L 41 50 L 37 89 Z" fill="#fff"/><path d="M 2 31 H 18 M 0 47 H 16 M 3 63 H 18" fill="none" stroke="#9bd4ff" stroke-width="4" stroke-linecap="round"/></svg></span>
            <span class="al-brand-text"><b><?= e($siteName) ?></b><small>Admin Panel</small></span>
        </div>
        <h1 id="al-title">Sign in</h1>
        <p class="al-lead">Use your administrator account to manage the website.</p>
<?php if ($error !== ''): ?>
        <div class="al-alert al-alert-err" role="alert"><?= e($error) ?></div>
<?php elseif ($notice !== ''): ?>
        <div class="al-alert al-alert-info" role="status"><?= e($notice) ?></div>
<?php endif; ?>
        <form method="post" action="login" novalidate class="al-form">
            <?= csrf_field() ?>
            <?= honeypot_field() ?>
            <label class="al-label" for="identity">Username or email</label>
            <div class="al-field">
                <svg class="al-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/></svg>
                <input class="al-input" type="text" id="identity" name="identity" value="<?= e($identity) ?>" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="190" required<?= $identity === '' ? ' autofocus' : '' ?>>
            </div>
            <label class="al-label" for="password">Password</label>
            <div class="al-field">
                <svg class="al-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                <input class="al-input al-input-pw" type="password" id="password" name="password" autocomplete="current-password" required<?= $identity !== '' ? ' autofocus' : '' ?>>
                <button type="button" class="al-toggle" id="al-toggle" aria-label="Show password" aria-pressed="false">Show</button>
            </div>
            <button type="submit" class="al-submit">Sign In</button>
        </form>
        <a class="al-back" href="../">&larr; Back to website</a>
    </section>
    <p class="al-foot">Protected area. Repeated failed sign-ins are temporarily blocked.</p>
</main>
<script>
(function () {
    var b = document.getElementById('al-toggle'), i = document.getElementById('password');
    if (!b || !i) return;
    b.addEventListener('click', function () {
        var show = i.type === 'password';
        i.type = show ? 'text' : 'password';
        b.textContent = show ? 'Hide' : 'Show';
        b.setAttribute('aria-pressed', show ? 'true' : 'false');
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        i.focus();
    });
})();
</script>
</body>
</html>
