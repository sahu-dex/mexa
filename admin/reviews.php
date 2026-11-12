<?php
declare(strict_types=1);

$adminPage = 'reviews';
$adminTitle = 'Client Reviews Moderation';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$statusFilter = isset($_GET['status']) && in_array($_GET['status'], ['pending', 'approved', 'rejected'], true)
    ? (string) $_GET['status']
    : '';

$pdo = db();
if ($statusFilter !== '') {
    $stmt = $pdo->prepare('SELECT * FROM `reviews` WHERE `status` = :s ORDER BY `created_at` DESC, `id` DESC');
    $stmt->execute([':s' => $statusFilter]);
    $rows = $stmt->fetchAll();
} else {
    $rows = $pdo->query("SELECT * FROM `reviews` ORDER BY FIELD(`status`, 'pending', 'approved', 'rejected'), `id` DESC")->fetchAll();
}
?>
<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Client Reviews (<?= count($rows) ?>)</h2>
            <p>Public review submissions arrive as <b>pending</b>. Approve, feature on the homepage marquee, edit, or delete reviews.</p>
        </div>
        <div class="adm-actions">
            <a class="adm-btn<?= $statusFilter === '' ? ' adm-btn-primary' : '' ?>" href="reviews.php">All</a>
            <a class="adm-btn<?= $statusFilter === 'pending' ? ' adm-btn-primary' : '' ?>" href="reviews.php?status=pending">Pending</a>
            <a class="adm-btn<?= $statusFilter === 'approved' ? ' adm-btn-primary' : '' ?>" href="reviews.php?status=approved">Approved</a>
            <a class="adm-btn<?= $statusFilter === 'rejected' ? ' adm-btn-primary' : '' ?>" href="reviews.php?status=rejected">Rejected</a>
            <button type="button" class="adm-btn adm-btn-primary" data-modal-open="rev-modal" data-title="Add Review">
                <i class="fa-solid fa-plus"></i> Add Review
            </button>
        </div>
    </div>

    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Review ID</th>
                    <th>Client</th>
                    <th>Photo</th>
                    <th>Rating</th>
                    <th>Review Text</th>
                    <th>Home Marquee</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php foreach ($rows as $r):
    $rowJson = htmlspecialchars(json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8');
    $photoPath = (string) ($r['file_path'] ?? '');
    $photoSrc = '';
    if (preg_match('~^(?:uploads/images|assets/images)/[a-zA-Z0-9_./-]+$~D', $photoPath) && !str_contains($photoPath, '..')) {
        $photoSrc = '../' . $photoPath;
    } elseif (preg_match('~^https?://~i', $photoPath) && filter_var($photoPath, FILTER_VALIDATE_URL)) {
        $photoSrc = $photoPath;
    }
?>
                <tr>
                    <td>
<?php if ($r['status'] === 'approved'): ?>
                        <a href="../review.php#review-<?= (int) $r['id'] ?>">#<?= (int) $r['id'] ?></a>
<?php else: ?>
                        #<?= (int) $r['id'] ?>
<?php endif; ?>
                    </td>
                    <td>
                        <b><?= e((string) $r['name']) ?></b>
                        <div style="font-size:12px;color:<?= chr(35) ?>94a3b8"><?= e((string) ($r['role'] ?? '')) ?></div>
                    </td>
                    <td>
<?php if ($photoSrc !== ''): ?>
                        <a href="<?= e($photoSrc) ?>" target="_blank" rel="noopener noreferrer" aria-label="View photo for review <?= (int) $r['id'] ?>"><img class="adm-avatar" src="<?= e($photoSrc) ?>" alt="<?= e((string) $r['name']) ?>'s review photo" loading="lazy"></a>
<?php else: ?>
                        <span>No photo</span>
<?php endif; ?>
                    </td>
                    <td><b><?= (int) $r['rating'] ?></b> / 5</td>
                    <td style="max-width:440px"><?= e((string) $r['body']) ?></td>
                    <td>
                        <button type="button" class="adm-btn adm-btn-sm<?= (int) $r['is_featured'] === 1 ? ' adm-btn-success' : '' ?>" data-quick-api="../api/admin/reviews.php" data-action="toggle_feature" data-id="<?= (int) $r['id'] ?>">
                            <?= (int) $r['is_featured'] === 1 ? '★ Featured' : '☆ Feature' ?>
                        </button>
                    </td>
                    <td><span class="adm-badge adm-badge-<?= e((string) $r['status']) ?>"><?= e((string) $r['status']) ?></span></td>
                    <td class="adm-actions">
<?php if ($r['status'] !== 'approved'): ?>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-success" data-quick-api="../api/admin/reviews.php" data-action="approve" data-id="<?= (int) $r['id'] ?>">Approve</button>
<?php endif; ?>
<?php if ($r['status'] !== 'rejected'): ?>
                        <button type="button" class="adm-btn adm-btn-sm" data-quick-api="../api/admin/reviews.php" data-action="reject" data-id="<?= (int) $r['id'] ?>">Reject</button>
<?php endif; ?>
                        <button type="button" class="adm-btn adm-btn-sm" data-modal-open="rev-modal" data-title="Edit Review" data-row="<?= $rowJson ?>">Edit</button>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/reviews.php" data-action="delete" data-id="<?= (int) $r['id'] ?>" data-confirm="Delete this review permanently?"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
<?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<div class="adm-modal" id="rev-modal" hidden>
    <div class="adm-modal-box">
        <div class="adm-modal-head">
            <h3 data-modal-title>Add / Edit Review</h3>
            <button type="button" class="adm-btn adm-btn-sm" data-modal-close>&times; Close</button>
        </div>
        <form data-adm-api="../api/admin/reviews.php" enctype="multipart/form-data">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="id" value="0">
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Client Name *</label>
                    <input class="adm-input" type="text" name="name" required maxlength="80">
                </div>
                <div class="adm-field">
                    <label>Client Role / Brand</label>
                    <input class="adm-input" type="text" name="role" maxlength="100">
                </div>
            </div>
            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Star Rating</label>
                    <select class="adm-select" name="rating">
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="3">3 Stars</option>
                        <option value="2">2 Stars</option>
                        <option value="1">1 Star</option>
                    </select>
                </div>
                <div class="adm-field">
                    <label>Status</label>
                    <select class="adm-select" name="status">
                        <option value="approved">approved</option>
                        <option value="pending">pending</option>
                        <option value="rejected">rejected</option>
                    </select>
                </div>
                <div class="adm-field" style="justify-content:flex-end">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                        <input type="checkbox" name="is_featured" value="1"> Show in Homepage Marquee
                    </label>
                </div>
            </div>
            <div class="adm-field">
                <label>Review Text *</label>
                <textarea class="adm-textarea" name="body" required maxlength="900"></textarea>
            </div>
            <div class="adm-field">
                <label>Optional Avatar Photo</label>
                <input class="adm-input" type="file" name="photo_file" accept="image/jpeg,image/png,image/webp">
            </div>
            <div class="adm-actions" style="justify-content:flex-end">
                <button type="button" class="adm-btn" data-modal-close>Cancel</button>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Review</button>
            </div>
        </form>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
