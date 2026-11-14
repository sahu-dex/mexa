<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';
send_security_headers();
// Start the session before any HTML is sent. csrf_field() below is called in the
// middle of the page; on hosts where PHP output_buffering is off the session cookie
// could no longer be set by then, and every submit failed with "Invalid CSRF token."
start_secure_session();

if (admins_count() > 0) {
    header('Location: login');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf(false);
    if (honeypot_triggered()) {
        header('Location: login');
        exit;
    }

    $username = trim((string) ($_POST['username'] ?? ''));
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $password = (string) ($_POST['password'] ?? '');
    $confirm = (string) ($_POST['password_confirm'] ?? '');

    if ($username === '' || !preg_match('/^[a-zA-Z0-9_.-]{3,60}$/', $username)) {
        $error = 'Username must be 3–60 characters (letters, numbers, dots, underscores, hyphens).';
    } elseif ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Please enter a valid admin email address.';
    } elseif (strlen($password) < 10) {
        $error = 'Password must be at least 10 characters long.';
    } elseif (!hash_equals($password, $confirm)) {
        $error = 'Password confirmation does not match.';
    } else {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = db()->prepare(
            'INSERT INTO `admins` (`username`, `email`, `password_hash`, `last_login_at`) VALUES (:u, :e, :p, NOW())'
        );
        $stmt->execute([
            ':u' => $username,
            ':e' => $email,
            ':p' => $hash,
        ]);
        $adminId = (int) db()->lastInsertId();

        admin_login_user(['id' => $adminId, 'username' => $username, 'email' => $email]);

        header('Location: ./');
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Initial Admin Setup — Mexa Motion</title>
    <link rel="icon" type="image/png" href="../assets/images/favicon.png">
    <link rel="stylesheet" href="../assets/css/admin-login.css?v=20261114">
</head>
<body class="al-body">
<main class="al-wrap">
    <section class="al-card" aria-labelledby="al-title">
        <div class="al-brand">
            <span class="al-mark" aria-hidden="true"><svg viewBox="0 0 120 100"><path d="M 17 89 L 25 11 L 47 11 L 64 43 L 91 11 L 112 11 L 104 89 L 81 89 L 85 51 L 62 78 L 41 50 L 37 89 Z" fill="#fff"/><path d="M 2 31 H 18 M 0 47 H 16 M 3 63 H 18" fill="none" stroke="#9bd4ff" stroke-width="4" stroke-linecap="round"/></svg></span>
            <span class="al-brand-text"><b>Mexa Motion</b><small>Admin Panel</small></span>
        </div>
        <h1 id="al-title">Create first admin</h1>
        <p class="al-lead">No administrator account exists yet. Create the owner account below; this page locks itself once that is done.</p>
<?php if ($error !== ''): ?>
        <div class="al-alert al-alert-err" role="alert"><?= e($error) ?></div>
<?php endif; ?>
        <form method="post" action="setup" autocomplete="off" class="al-form">
            <?= csrf_field() ?>
            <?= honeypot_field() ?>
            <label class="al-label" for="username">Admin username</label>
            <div class="al-field"><input class="al-input al-input-plain" type="text" id="username" name="username" required maxlength="60" autocapitalize="none" value="<?= e((string) ($_POST['username'] ?? '')) ?>"></div>
            <label class="al-label" for="email">Admin email</label>
            <div class="al-field"><input class="al-input al-input-plain" type="email" id="email" name="email" required maxlength="190" value="<?= e((string) ($_POST['email'] ?? '')) ?>"></div>
            <label class="al-label" for="password">Password (minimum 10 characters)</label>
            <div class="al-field"><input class="al-input al-input-plain" type="password" id="password" name="password" required minlength="10" autocomplete="new-password"></div>
            <label class="al-label" for="password_confirm">Confirm password</label>
            <div class="al-field"><input class="al-input al-input-plain" type="password" id="password_confirm" name="password_confirm" required minlength="10" autocomplete="new-password"></div>
            <button type="submit" class="al-submit">Create Admin &amp; Enter Panel</button>
        </form>
    </section>
</main>
</body>
</html>
