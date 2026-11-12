<?php
declare(strict_types=1);

require_once __DIR__ . '/functions.php';
require_admin(false);
send_security_headers();

$adminPage = $adminPage ?? 'dashboard';
$adminTitle = $adminTitle ?? 'Dashboard';
$currentAdmin = current_admin();

$pdo = db();
$pendingReviewsCount = (int) $pdo->query("SELECT COUNT(*) FROM `reviews` WHERE `status` = 'pending'")->fetchColumn();
$pendingMessagesCount = (int) $pdo->query("SELECT COUNT(*) FROM `messages` WHERE `status` = 'pending'")->fetchColumn();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
    <title><?= e($adminTitle) ?> — <?= e(setting('site_name', 'Mexa Motion')) ?> Admin</title>
    <link rel="icon" type="image/png" href="../<?= e(setting('favicon_file_path', 'assets/images/favicon.png')) ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="../assets/css/admin.css">
    <link rel="stylesheet" href="../assets/css/admin-theme.css?v=20261112-skill-limit2">
</head>
<body>
<div class="adm-shell">
    <aside class="adm-side">
        <div class="adm-brand">
            <div class="adm-brand-badge">MM</div>
            <div class="adm-brand-txt">
                <b><?= e(setting('site_name', 'Mexa Motion')) ?></b>
                <small>Control Panel</small>
            </div>
        </div>

        <nav class="adm-nav" aria-label="Admin navigation">
            <div class="adm-nav-sec">Overview</div>
            <a class="adm-link<?= $adminPage === 'dashboard' ? ' is-active' : '' ?>" href="index.php">
                <i class="fa-solid fa-gauge-high"></i><span>Dashboard</span>
            </a>

            <div class="adm-nav-sec">Catalog &amp; Studio</div>
            <a class="adm-link<?= $adminPage === 'services' ? ' is-active' : '' ?>" href="services.php">
                <i class="fa-solid fa-layer-group"></i><span>Services</span>
            </a>
            <a class="adm-link<?= $adminPage === 'packages' ? ' is-active' : '' ?>" href="packages.php">
                <i class="fa-solid fa-tags"></i><span>Packages &amp; Pricing</span>
            </a>
            <a class="adm-link<?= $adminPage === 'work' ? ' is-active' : '' ?>" href="work.php">
                <i class="fa-solid fa-photo-film"></i><span>Work / Portfolio</span>
            </a>
            <a class="adm-link<?= $adminPage === 'team' ? ' is-active' : '' ?>" href="team.php">
                <i class="fa-solid fa-users"></i><span>Team Members</span>
            </a>

            <div class="adm-nav-sec">Client Activity</div>
            <a class="adm-link<?= $adminPage === 'reviews' ? ' is-active' : '' ?>" href="reviews.php">
                <i class="fa-solid fa-star"></i><span>Reviews</span>
<?php if ($pendingReviewsCount > 0): ?>
                <span class="adm-pill-cnt"><?= $pendingReviewsCount ?></span>
<?php endif; ?>
            </a>
            <a class="adm-link<?= $adminPage === 'messages' ? ' is-active' : '' ?>" href="messages.php">
                <i class="fa-solid fa-inbox"></i><span>Tickets &amp; Messages</span>
<?php if ($pendingMessagesCount > 0): ?>
                <span class="adm-pill-cnt"><?= $pendingMessagesCount ?></span>
<?php endif; ?>
            </a>

            <div class="adm-nav-sec">Configuration</div>
            <a class="adm-link<?= $adminPage === 'settings' ? ' is-active' : '' ?>" href="settings.php">
                <i class="fa-solid fa-sliders"></i><span>Site &amp; Page Settings</span>
            </a>
        </nav>

        <div class="adm-side-foot">
            <div class="adm-user">
                <i class="fa-solid fa-user-shield"></i>
                <div>
                    <b><?= e($currentAdmin['username'] ?? 'Admin') ?></b>
                    <span><?= e($currentAdmin['email'] ?? '') ?></span>
                </div>
            </div>
            <form method="post" action="logout.php" style="margin:0">
                <?= csrf_field() ?>
                <button type="submit" class="adm-btn adm-btn-danger" style="width:100%">
                    <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                </button>
            </form>
        </div>
    </aside>

    <div class="adm-main">
        <header class="adm-top">
            <h1><?= e($adminTitle) ?></h1>
            <div class="adm-top-actions">
                <a class="adm-btn" href="../index.php" target="_blank" rel="noopener">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> View Live Website
                </a>
            </div>
        </header>
        <main class="adm-content">
