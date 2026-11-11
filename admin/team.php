<?php
declare(strict_types=1);

$adminPage = 'team';
$adminTitle = 'Team Members';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$rows = db()->query('SELECT * FROM `team_members` ORDER BY `is_founder` DESC, `sort_order` ASC, `id` ASC')->fetchAll();
?>
<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Studio Team (<?= count($rows) ?>)</h2>
            <p>Manage the Founder card and specialist team members displayed on the Homepage, Team page, and Booking page.</p>
        </div>
        <button type="button" class="adm-btn adm-btn-primary" data-modal-open="team-modal" data-title="Add Team Member">
            <i class="fa-solid fa-plus"></i> Add Member
        </button>
    </div>

    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Photo</th>
                    <th>Name &amp; Role</th>
                    <th>Skills</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php foreach ($rows as $m):
    $skillsArr = [];
    if (!empty($m['skills'])) {
        $dec = json_decode((string) $m['skills'], true);
        if (is_array($dec)) {
            $skillsArr = $dec;
        }
    }
    $fp = (string) ($m['file_path'] ?? '');
    $imgSrc = $fp !== '' ? (str_starts_with($fp, 'http') ? $fp : '../' . $fp) : '';
    $rowData = $m;
    $rowData['skills'] = $skillsArr;
    $rowJson = htmlspecialchars(json_encode($rowData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8');
?>
                <tr>
                    <td>
<?php if ($imgSrc !== ''): ?>
                        <img class="adm-avatar" src="<?= e($imgSrc) ?>" alt="">
<?php else: ?>
                        <i class="fa-solid fa-user"></i>
<?php endif; ?>
                    </td>
                    <td>
                        <b><?= e((string) $m['name']) ?></b>
                        <div style="font-size:12px;color:<?= chr(35) ?>38bdf8"><?= e((string) $m['role']) ?></div>
                    </td>
                    <td><?= e(implode(', ', array_slice($skillsArr, 0, 5))) ?></td>
                    <td><?= (int) $m['is_founder'] === 1 ? '<span class="adm-badge adm-badge-approved">Founder</span>' : 'Specialist' ?></td>
                    <td>
                        <span class="adm-badge adm-badge-<?= (int) $m['is_active'] === 1 ? 'active' : 'inactive' ?>">
                            <?= (int) $m['is_active'] === 1 ? 'Active' : 'Hidden' ?>
                        </span>
                    </td>
                    <td class="adm-actions">
                        <button type="button" class="adm-btn adm-btn-sm" data-modal-open="team-modal" data-title="Edit Team Member" data-row="<?= $rowJson ?>">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/team.php" data-action="delete" data-id="<?= (int) $m['id'] ?>" data-confirm="Delete this team member?">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
<?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<div class="adm-modal" id="team-modal" hidden>
    <div class="adm-modal-box">
        <div class="adm-modal-head">
            <h3 data-modal-title>Add Team Member</h3>
            <button type="button" class="adm-btn adm-btn-sm" data-modal-close>&times; Close</button>
        </div>
        <form data-adm-api="../api/admin/team.php" enctype="multipart/form-data">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="id" value="0">
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Full Name *</label>
                    <input class="adm-input" type="text" name="name" required maxlength="120">
                </div>
                <div class="adm-field">
                    <label>Role / Title *</label>
                    <input class="adm-input" type="text" name="role" required maxlength="140">
                </div>
            </div>
            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Sort Order</label>
                    <input class="adm-input" type="number" name="sort_order" value="0">
                </div>
                <div class="adm-field">
                    <label>Visibility</label>
                    <select class="adm-select" name="is_active">
                        <option value="1">Active</option>
                        <option value="0">Hidden</option>
                    </select>
                </div>
                <div class="adm-field" style="justify-content:flex-end">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                        <input type="checkbox" name="is_founder" value="1"> Mark as Studio Founder
                    </label>
                </div>
            </div>
            <div class="adm-field">
                <label>Short Card Description</label>
                <textarea class="adm-textarea" name="description"></textarea>
            </div>
            <div class="adm-field">
                <label>Extended Biography (used for Founder spotlight)</label>
                <textarea class="adm-textarea" name="bio"></textarea>
            </div>
            <div class="adm-field">
                <label>Skills &amp; Keywords (comma or newline separated)</label>
                <textarea class="adm-textarea" name="skills" placeholder="Premiere Pro, After Effects, Color Grading"></textarea>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Photo `file_path`</label>
                    <input class="adm-input" type="text" name="file_path" placeholder="uploads/images/... or assets/images/team/...">
                </div>
                <div class="adm-field">
                    <label>Or Upload Portrait Photo</label>
                    <input class="adm-input" type="file" name="photo_file" accept="image/jpeg,image/png,image/webp">
                </div>
            </div>
            <div class="adm-actions" style="justify-content:flex-end">
                <button type="button" class="adm-btn" data-modal-close>Cancel</button>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Member</button>
            </div>
        </form>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
