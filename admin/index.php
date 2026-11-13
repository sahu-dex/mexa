<?php
declare(strict_types=1);

$adminPage = 'dashboard';
$adminTitle = 'Dashboard Overview';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$pdo = db();
$totalServices = (int) $pdo->query('SELECT COUNT(*) FROM `services`')->fetchColumn();
$totalWork = (int) $pdo->query('SELECT COUNT(*) FROM `work_items`')->fetchColumn();
$totalTeam = (int) $pdo->query('SELECT COUNT(*) FROM `team_members`')->fetchColumn();
$approvedReviews = (int) $pdo->query("SELECT COUNT(*) FROM `reviews` WHERE `status` = 'approved'")->fetchColumn();
$pendingReviews = (int) $pdo->query("SELECT COUNT(*) FROM `reviews` WHERE `status` = 'pending'")->fetchColumn();
$newsletterSubs = (int) $pdo->query("SELECT COUNT(*) FROM `messages` WHERE `type` = 'newsletter'")->fetchColumn();

$recentReviews = $pdo->query(
    'SELECT * FROM `reviews` ORDER BY `created_at` DESC LIMIT 6'
)->fetchAll();
?>
<div class="adm-stats">
    <div class="adm-stat">
        <span>Active Services</span>
        <b><?= $totalServices ?></b>
        <small>Studio services</small>
    </div>
    <div class="adm-stat">
        <span>Portfolio Work</span>
        <b><?= $totalWork ?></b>
        <small>Videos, reels &amp; graphics</small>
    </div>
    <div class="adm-stat">
        <span>Team Members</span>
        <b><?= $totalTeam ?></b>
        <small>Founder &amp; specialists</small>
    </div>
    <div class="adm-stat">
        <span>Client Reviews</span>
        <b><?= $approvedReviews ?></b>
        <small><?= $pendingReviews ?> awaiting approval</small>
    </div>
    <div class="adm-stat">
        <span>Newsletter Subscribers</span>
        <b><?= $newsletterSubs ?></b>
        <small>Subscribed readers</small>
    </div>
</div>

<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Recent Client Reviews</h2>
            <p>Approve or feature client testimonials before they appear publicly.</p>
        </div>
        <a class="adm-btn" href="reviews.php">Moderate Reviews</a>
    </div>
    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Client</th>
                    <th>Rating</th>
                    <th>Review</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php foreach ($recentReviews as $rv): ?>
                <tr>
                    <td><b><?= e((string) $rv['name']) ?></b><br><small style="color:<?= chr(35) ?>94a3b8"><?= e((string) ($rv['role'] ?? '')) ?></small></td>
                    <td><?= (int) $rv['rating'] ?> / 5</td>
                    <td><?= e(mb_strimwidth((string) $rv['body'], 0, 100, '…')) ?></td>
                    <td><span class="adm-badge adm-badge-<?= e((string) $rv['status']) ?>"><?= e((string) $rv['status']) ?></span></td>
                    <td class="adm-actions">
<?php if ($rv['status'] !== 'approved'): ?>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-success" data-quick-api="../api/admin/reviews.php" data-action="approve" data-id="<?= (int) $rv['id'] ?>">Approve</button>
<?php endif; ?>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/reviews.php" data-action="delete" data-id="<?= (int) $rv['id'] ?>" data-confirm="Delete this review permanently?">Delete</button>
                    </td>
                </tr>
<?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
