<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';
send_security_headers();

if (admins_count() > 0) {
    header('Location: login.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf(false);
    if (honeypot_triggered()) {
        header('Location: login.php');
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

        start_secure_session();
        session_regenerate_id(true);
        $_SESSION['admin_id'] = $adminId;
        $_SESSION['admin_username'] = $username;
        $_SESSION['admin_email'] = $email;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

        header('Location: index.php');
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
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap">
    <link rel="stylesheet" href="../assets/css/admin.css">
</head>
<body>
<div class="adm-auth-wrap">
    <div class="adm-auth-card">
        <h1>Create First Admin</h1>
        <p>No administrator account exists yet. Create your owner credentials below; this setup page locks automatically once completed.</p>
<?php if ($error !== ''): ?>
        <div class="adm-alert adm-alert-err"><?= e($error) ?></div>
<?php endif; ?>
        <form method="post" action="setup.php" autocomplete="off">
            <?= csrf_field() ?>
            <?= honeypot_field() ?>
            <div class="adm-field">
                <label for="username">Admin Username</label>
                <input class="adm-input" type="text" id="username" name="username" required maxlength="60" value="<?= e((string) ($_POST['username'] ?? '')) ?>">
            </div>
            <div class="adm-field">
                <label for="email">Admin Email</label>
                <input class="adm-input" type="email" id="email" name="email" required maxlength="190" value="<?= e((string) ($_POST['email'] ?? '')) ?>">
            </div>
            <div class="adm-field">
                <label for="password">Password (minimum 10 characters)</label>
                <input class="adm-input" type="password" id="password" name="password" required minlength="10">
            </div>
            <div class="adm-field">
                <label for="password_confirm">Confirm Password</label>
                <input class="adm-input" type="password" id="password_confirm" name="password_confirm" required minlength="10">
            </div>
            <button type="submit" class="adm-btn adm-btn-primary" style="width:100%;margin-top:6px">Create Admin &amp; Enter Panel</button>
        </form>
    </div>
</div>
</body>
</html>
