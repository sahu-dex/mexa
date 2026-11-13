<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';
send_security_headers();

if (current_admin() !== null) {
    header('Location: index.php');
    exit;
}

if (admins_count() === 0) {
    header('Location: setup.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf(false);

    if (honeypot_triggered()) {
        $error = 'Invalid credentials.';
    } elseif (!rate_limit_allow('admin_login', 5, 900)) {
        $error = 'Too many failed login attempts. Please wait 15 minutes and try again.';
    } else {
        $identity = trim((string) ($_POST['identity'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');

        $stmt = db()->prepare('SELECT * FROM `admins` WHERE `username` = :u OR `email` = :e LIMIT 1');
        $stmt->execute([':u' => $identity, ':e' => strtolower($identity)]);
        $admin = $stmt->fetch();

        if ($admin && password_verify($password, (string) $admin['password_hash'])) {
            if (password_needs_rehash((string) $admin['password_hash'], PASSWORD_DEFAULT)) {
                $reh = db()->prepare('UPDATE `admins` SET `password_hash` = :h WHERE `id` = :id');
                $reh->execute([':h' => password_hash($password, PASSWORD_DEFAULT), ':id' => (int) $admin['id']]);
            }
            $upd = db()->prepare('UPDATE `admins` SET `last_login_at` = NOW() WHERE `id` = :id');
            $upd->execute([':id' => (int) $admin['id']]);

            start_secure_session();
            session_regenerate_id(true);
            $_SESSION['admin_id'] = (int) $admin['id'];
            $_SESSION['admin_username'] = (string) $admin['username'];
            $_SESSION['admin_email'] = (string) $admin['email'];
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

            header('Location: index.php');
            exit;
        }
        $error = 'Invalid username/email or password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Admin Login — Mexa Motion</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap">
    <link rel="stylesheet" href="../assets/css/admin.css">
    <link rel="stylesheet" href="../assets/css/admin-theme.css?v=20261112">
</head>
<body>
<div class="adm-auth-wrap">
    <div class="adm-auth-card">
        <h1>Mexa Motion Admin</h1>
        <p>Sign in to manage services, portfolio work, team, reviews, and site settings.</p>
<?php if ($error !== ''): ?>
        <div class="adm-alert adm-alert-err"><?= e($error) ?></div>
<?php endif; ?>
        <form method="post" action="login.php" autocomplete="off">
            <?= csrf_field() ?>
            <?= honeypot_field() ?>
            <div class="adm-field">
                <label for="identity">Username or Email</label>
                <input class="adm-input" type="text" id="identity" name="identity" required autofocus>
            </div>
            <div class="adm-field">
                <label for="password">Password</label>
                <input class="adm-input" type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="adm-btn adm-btn-primary" style="width:100%;margin-top:6px">Sign In</button>
        </form>
        <p style="margin:16px 0 0;text-align:center;font-size:12px"><a href="../index.php">&larr; Back to public website</a></p>
    </div>
</div>
</body>
</html>
