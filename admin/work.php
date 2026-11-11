<?php
declare(strict_types=1);

$adminPage = 'work';
$adminTitle = 'Work & Portfolio';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$rows = db()->query('SELECT * FROM `work_items` ORDER BY `section` ASC, `sort_order` ASC, `id` DESC')->fetchAll();
?>
<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Portfolio &amp; Demo Items (<?= count($rows) ?>)</h2>
            <p>Manage Recent Works (`recent`), Long-form Demo Videos (`demo`), Vertical Shorts/Reels (`short`), and Homepage Previews (`preview`). Media paths are stored in `file_path`.</p>
        </div>
        <button type="button" class="adm-btn adm-btn-primary" data-modal-open="work-modal" data-title="Add Portfolio Item">
            <i class="fa-solid fa-plus"></i> Add Work Item
        </button>
    </div>

    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Thumb</th>
                    <th>Title</th>
                    <th>Section / Kind</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php foreach ($rows as $w):
    $thumb = (string) ($w['thumbnail_path'] ?: ($w['kind'] === 'image' ? $w['file_path'] : ''));
    $thumbSrc = $thumb !== '' ? (str_starts_with($thumb, 'http') ? $thumb : '../' . $thumb) : '';
    $rowJson = htmlspecialchars(json_encode($w, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8');
?>
                <tr>
                    <td>
<?php if ($thumbSrc !== ''): ?>
                        <img class="adm-thumb" src="<?= e($thumbSrc) ?>" alt="">
<?php else: ?>
                        <i class="fa-solid fa-video"></i>
<?php endif; ?>
                    </td>
                    <td>
                        <b><?= e((string) $w['title']) ?></b>
                        <div style="font-size:11.5px;color:<?= chr(35) ?>94a3b8;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><?= e((string) $w['file_path']) ?></div>
                    </td>
                    <td><span class="adm-badge adm-badge-active"><?= e((string) $w['section']) ?></span> · <?= e((string) $w['kind']) ?></td>
                    <td><?= e((string) $w['category']) ?></td>
                    <td><?= e((string) ($w['duration'] ?? '—')) ?></td>
                    <td>
                        <span class="adm-badge adm-badge-<?= ($w['status'] ?? 'published') === 'published' ? 'active' : 'inactive' ?>">
                            <?= ($w['status'] ?? 'published') === 'published' ? 'Published' : 'Draft' ?>
                        </span>
                    </td>
                    <td class="adm-actions">
                        <button type="button" class="adm-btn adm-btn-sm" data-modal-open="work-modal" data-title="Edit Portfolio Item" data-row="<?= $rowJson ?>">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/work.php" data-action="delete" data-id="<?= (int) $w['id'] ?>" data-confirm="Delete this portfolio item?">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
<?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<div class="adm-modal" id="work-modal" hidden>
    <div class="adm-modal-box">
        <div class="adm-modal-head">
            <h3 data-modal-title>Add Portfolio Item</h3>
            <button type="button" class="adm-btn adm-btn-sm" data-modal-close>&times; Close</button>
        </div>
        <form data-adm-api="../api/admin/work.php" enctype="multipart/form-data">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="id" value="0">
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Title *</label>
                    <input class="adm-input" type="text" name="title" required maxlength="180">
                </div>
                <div class="adm-field">
                    <label>Category</label>
                    <input class="adm-input" type="text" name="category" value="Video Editing" maxlength="80">
                </div>
            </div>
            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Section *</label>
                    <select class="adm-select" name="section">
                        <option value="recent">recent (Recent Works)</option>
                        <option value="demo">demo (Long-form Demo)</option>
                        <option value="short">short (9:16 Reels/Shorts)</option>
                        <option value="preview">preview (Home Preview)</option>
                    </select>
                </div>
                <div class="adm-field">
                    <label>Media Kind *</label>
                    <select class="adm-select" name="kind">
                        <option value="video">video</option>
                        <option value="image">image</option>
                    </select>
                </div>
                <div class="adm-field">
                    <label>Aspect Ratio</label>
                    <select class="adm-select" name="aspect">
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="4:5">4:5</option>
                    </select>
                </div>
            </div>
            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Duration (optional)</label>
                    <input class="adm-input" type="text" name="duration" placeholder="01:45" maxlength="20">
                </div>
                <div class="adm-field">
                    <label>Client Name (optional)</label>
                    <input class="adm-input" type="text" name="client_name" maxlength="120">
                </div>
                <div class="adm-field">
                    <label>Sort Order</label>
                    <input class="adm-input" type="number" name="sort_order" value="0">
                </div>
            </div>
            <div class="adm-field">
                <label>Description</label>
                <textarea class="adm-textarea" name="description"></textarea>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Media `file_path` or External URL</label>
                    <input class="adm-input" type="text" name="file_path" placeholder="uploads/videos/... or https://...">
                </div>
                <div class="adm-field">
                    <label>Or Upload Media File (goes to `uploads/images/` or `uploads/videos/`)</label>
                    <input class="adm-input" type="file" name="media_file" accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp">
                </div>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Thumbnail Path or URL</label>
                    <input class="adm-input" type="text" name="thumbnail_path" placeholder="uploads/images/... or https://...">
                </div>
                <div class="adm-field">
                    <label>Or Upload Thumbnail Image</label>
                    <input class="adm-input" type="file" name="thumbnail_file" accept="image/jpeg,image/png,image/webp">
                </div>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Visibility</label>
                    <select class="adm-select" name="is_active">
                        <option value="1">Active</option>
                        <option value="0">Hidden</option>
                    </select>
                </div>
                <div class="adm-field" style="justify-content:flex-end">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                        <input type="checkbox" name="is_featured" value="1"> Featured on Homepage
                    </label>
                </div>
            </div>
            <div class="adm-actions" style="justify-content:flex-end">
                <button type="button" class="adm-btn" data-modal-close>Cancel</button>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Work Item</button>
            </div>
        </form>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
