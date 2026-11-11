<?php
declare(strict_types=1);

$adminPage = 'dashboard';
$adminTitle = 'Dashboard Overview';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$pdo = db();
$totalServices = (int) $pdo->query('SELECT COUNT(*) FROM `services`')->fetchColumn();
$totalPackages = (int) $pdo->query('SELECT COUNT(*) FROM `packages`')->fetchColumn();
$totalWork = (int) $pdo->query('SELECT COUNT(*) FROM `work_items`')->fetchColumn();
$totalTeam = (int) $pdo->query('SELECT COUNT(*) FROM `team_members`')->fetchColumn();
$approvedReviews = (int) $pdo->query("SELECT COUNT(*) FROM `reviews` WHERE `status` = 'approved'")->fetchColumn();
$pendingReviews = (int) $pdo->query("SELECT COUNT(*) FROM `reviews` WHERE `status` = 'pending'")->fetchColumn();
$pendingBookings = (int) $pdo->query("SELECT COUNT(*) FROM `messages` WHERE `type` = 'booking' AND `status` = 'pending'")->fetchColumn();
$newsletterSubs = (int) $pdo->query("SELECT COUNT(*) FROM `messages` WHERE `type` = 'newsletter'")->fetchColumn();

$recentBookings = $pdo->query(
    "SELECT m.*, s.`name` AS `service_name`
     FROM `messages` m
     LEFT JOIN `services` s ON s.`id` = m.`service_id`
     WHERE m.`type` = 'booking'
     ORDER BY m.`created_at` DESC
     LIMIT 8"
)->fetchAll();

$recentReviews = $pdo->query(
    'SELECT * FROM `reviews` ORDER BY `created_at` DESC LIMIT 6'
)->fetchAll();
?>
<div class="adm-stats">
    <div class="adm-stat">
        <span>Active Services</span>
        <b><?= $totalServices ?></b>
        <small><?= $totalPackages ?> pricing packages</small>
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
        <span>Pending Tickets</span>
        <b><?= $pendingBookings ?></b>
        <small><?= $newsletterSubs ?> newsletter subscribers</small>
    </div>
</div>

<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Latest Booking Tickets</h2>
            <p>Submitted through the Book a Service flow.</p>
        </div>
        <a class="adm-btn" href="messages.php">Manage All Tickets</a>
    </div>
    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Ticket Ref</th>
                    <th>Service &amp; Quality</th>
                    <th>Price</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Submitted</th>
                </tr>
            </thead>
            <tbody>
<?php if (empty($recentBookings)): ?>
                <tr><td colspan="6" style="color:<?= chr(35) ?>94a3b8">No booking tickets submitted yet.</td></tr>
<?php else: foreach ($recentBookings as $b): ?>
                <tr>
                    <td><b><?= e((string) ($b['ticket_ref'] ?? '—')) ?></b></td>
                    <td><?= e((string) ($b['service_name'] ?? $b['subject'] ?? '—')) ?> <small style="color:<?= chr(35) ?>38bdf8">(<?= e((string) ($b['package_quality'] ?? '')) ?>)</small></td>
                    <td><?= $b['quoted_price'] !== null ? '$' . e(number_format((float) $b['quoted_price'], 2)) : '—' ?></td>
                    <td><?= e(mb_strimwidth((string) ($b['message'] ?? ''), 0, 90, '…')) ?></td>
                    <td><span class="adm-badge adm-badge-<?= e((string) $b['status']) ?>"><?= e((string) $b['status']) ?></span></td>
                    <td><?= e((string) $b['created_at']) ?></td>
                </tr>
<?php endforeach; endif; ?>
            </tbody>
        </table>
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
