<?php
declare(strict_types=1);

$adminPage = 'messages';
$adminTitle = 'Booking Tickets, Contact & Newsletter';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$typeFilter = isset($_GET['type']) && in_array($_GET['type'], ['booking', 'contact', 'newsletter'], true)
    ? (string) $_GET['type']
    : '';

$pdo = db();
$sql = 'SELECT m.*, s.`name` AS `service_name`
        FROM `messages` m
        LEFT JOIN `services` s ON s.`id` = m.`service_id`';
$params = [];
if ($typeFilter !== '') {
    $sql .= ' WHERE m.`type` = :t';
    $params[':t'] = $typeFilter;
}
$sql .= ' ORDER BY m.`created_at` DESC, m.`id` DESC';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();
?>
<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Inbox &amp; Booking Tickets (<?= count($rows) ?>)</h2>
            <p>All booking orders, contact inquiries, and newsletter signups stored in the database.</p>
        </div>
        <div class="adm-actions">
            <a class="adm-btn<?= $typeFilter === '' ? ' adm-btn-primary' : '' ?>" href="messages.php">All</a>
            <a class="adm-btn<?= $typeFilter === 'booking' ? ' adm-btn-primary' : '' ?>" href="messages.php?type=booking">Bookings</a>
            <a class="adm-btn<?= $typeFilter === 'contact' ? ' adm-btn-primary' : '' ?>" href="messages.php?type=contact">Contact</a>
            <a class="adm-btn<?= $typeFilter === 'newsletter' ? ' adm-btn-primary' : '' ?>" href="messages.php?type=newsletter">Newsletter</a>
        </div>
    </div>

    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Type / Ref</th>
                    <th>Sender / Package</th>
                    <th>Message / Details</th>
                    <th>Status</th>
                    <th>Received</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php if (empty($rows)): ?>
                <tr><td colspan="6" style="color:<?= chr(35) ?>94a3b8">No submissions recorded yet.</td></tr>
<?php else: foreach ($rows as $m): ?>
                <tr>
                    <td>
                        <span class="adm-badge adm-badge-active"><?= e((string) $m['type']) ?></span>
<?php if (!empty($m['ticket_ref'])): ?>
                        <div style="margin-top:4px;font-weight:700"><?= e((string) $m['ticket_ref']) ?></div>
<?php endif; ?>
                    </td>
                    <td>
<?php if (!empty($m['subject'])): ?>
                        <b><?= e((string) $m['subject']) ?></b><br>
<?php endif; ?>
<?php if ($m['quoted_price'] !== null): ?>
                        <span style="color:<?= chr(35) ?>38bdf8;font-weight:700">$<?= e(number_format((float) $m['quoted_price'], 2)) ?></span><br>
<?php endif; ?>
                        <small style="color:<?= chr(35) ?>94a3b8">
                            <?= e(trim(($m['name'] ?? '') . ' ' . ($m['email'] ?? '') . ' ' . ($m['phone'] ?? ''))) ?>
                        </small>
                    </td>
                    <td style="max-width:440px;white-space:pre-wrap"><?= e((string) ($m['message'] ?? '—')) ?></td>
                    <td><span class="adm-badge adm-badge-<?= e((string) $m['status']) ?>"><?= e((string) $m['status']) ?></span></td>
                    <td><?= e((string) $m['created_at']) ?></td>
                    <td class="adm-actions">
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-success" data-quick-api="../api/admin/messages.php" data-action="status" data-status="approved" data-id="<?= (int) $m['id'] ?>">Approve</button>
                        <button type="button" class="adm-btn adm-btn-sm" data-quick-api="../api/admin/messages.php" data-action="status" data-status="completed" data-id="<?= (int) $m['id'] ?>">Complete</button>
                        <button type="button" class="adm-btn adm-btn-sm" data-quick-api="../api/admin/messages.php" data-action="status" data-status="rejected" data-id="<?= (int) $m['id'] ?>">Reject</button>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/messages.php" data-action="delete" data-id="<?= (int) $m['id'] ?>" data-confirm="Delete this entry?"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
<?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
