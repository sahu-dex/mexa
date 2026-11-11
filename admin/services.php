<?php
declare(strict_types=1);

$adminPage = 'services';
$adminTitle = 'Services Management';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$catalog = get_services_with_packages(false);
$services = $catalog['services'];
?>
<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>All Studio Services (<?= count($services) ?>)</h2>
            <p>Add, edit, reorder, or remove services shown on the Homepage, Service page, and Booking page. Creating a new service automatically creates its 3 default pricing tiers.</p>
        </div>
        <button type="button" class="adm-btn adm-btn-primary" data-modal-open="svc-modal" data-title="Add New Service">
            <i class="fa-solid fa-plus"></i> Add Service
        </button>
    </div>

    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Order</th>
                    <th>Preview</th>
                    <th>Service Name</th>
                    <th>Category</th>
                    <th>Packages</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php foreach ($services as $svc):
    $rowJson = htmlspecialchars(json_encode([
        'id' => $svc['id'],
        'name' => $svc['name'],
        'category' => $svc['category'],
        'icon' => $svc['icon'],
        'description' => $svc['description'],
        'long_description' => $svc['long_description'],
        'bullet_points' => $svc['bullet_points'],
        'file_path' => $svc['file_path'],
        'thumbnail_path' => $svc['thumbnail_path'],
        'sort_order' => $svc['sort_order'],
        'is_active' => $svc['is_active'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8');
?>
                <tr>
                    <td><?= (int) $svc['sort_order'] ?></td>
                    <td>
<?php if ($svc['thumbnail_path'] !== ''): ?>
                        <img class="adm-thumb" src="<?= e(str_starts_with($svc['thumbnail_path'], 'http') ? $svc['thumbnail_path'] : '../' . $svc['thumbnail_path']) ?>" alt="">
<?php else: ?>
                        <i class="<?= e($svc['icon']) ?>"></i>
<?php endif; ?>
                    </td>
                    <td>
                        <b><?= e($svc['name']) ?></b>
                        <div style="font-size:12px;color:<?= chr(35) ?>94a3b8;max-width:360px"><?= e(mb_strimwidth($svc['description'], 0, 95, '…')) ?></div>
                    </td>
                    <td><?= e($svc['category']) ?></td>
                    <td><a href="packages.php?service_id=<?= (int) $svc['id'] ?>"><?= count($svc['packages']) ?> tiers &rarr;</a></td>
                    <td>
                        <span class="adm-badge adm-badge-<?= $svc['is_active'] ? 'active' : 'inactive' ?>">
                            <?= $svc['is_active'] ? 'Active' : 'Hidden' ?>
                        </span>
                    </td>
                    <td class="adm-actions">
                        <button type="button" class="adm-btn adm-btn-sm" data-modal-open="svc-modal" data-title="Edit Service" data-row="<?= $rowJson ?>">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/services.php" data-action="delete" data-id="<?= (int) $svc['id'] ?>" data-confirm="Delete this service and all its packages?">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
<?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<div class="adm-modal" id="svc-modal" hidden>
    <div class="adm-modal-box">
        <div class="adm-modal-head">
            <h3 data-modal-title>Add Service</h3>
            <button type="button" class="adm-btn adm-btn-sm" data-modal-close>&times; Close</button>
        </div>
        <form data-adm-api="../api/admin/services.php" enctype="multipart/form-data">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="id" value="0">
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Service Name *</label>
                    <input class="adm-input" type="text" name="name" required maxlength="150">
                </div>
                <div class="adm-field">
                    <label>Category</label>
                    <input class="adm-input" type="text" name="category" value="Video Editing" maxlength="80">
                </div>
            </div>
            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Font Awesome Icon Class</label>
                    <input class="adm-input" type="text" name="icon" value="fa-solid fa-film" maxlength="80">
                </div>
                <div class="adm-field">
                    <label>Sort Order</label>
                    <input class="adm-input" type="number" name="sort_order" value="0">
                </div>
                <div class="adm-field">
                    <label>Visibility</label>
                    <select class="adm-select" name="is_active">
                        <option value="1">Active (Visible)</option>
                        <option value="0">Hidden</option>
                    </select>
                </div>
            </div>
            <div class="adm-field">
                <label>Short Description (Card Copy) *</label>
                <textarea class="adm-textarea" name="description" required></textarea>
            </div>
            <div class="adm-field">
                <label>Detailed Description (Service Page Overview)</label>
                <textarea class="adm-textarea" name="long_description"></textarea>
            </div>
            <div class="adm-field">
                <label>Highlight Bullet Points (one per line)</label>
                <textarea class="adm-textarea" name="bullet_points" placeholder="Fast pacing&#10;Clean sound design&#10;Color grading"></textarea>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Preview Video File Path or URL</label>
                    <input class="adm-input" type="text" name="file_path" placeholder="uploads/videos/... or https://...">
                </div>
                <div class="adm-field">
                    <label>Or Upload Preview Video (MP4/WebM)</label>
                    <input class="adm-input" type="file" name="video_file" accept="video/mp4,video/webm,video/quicktime">
                </div>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Thumbnail Image Path or URL</label>
                    <input class="adm-input" type="text" name="thumbnail_path" placeholder="uploads/images/... or https://...">
                </div>
                <div class="adm-field">
                    <label>Or Upload Thumbnail (JPG/PNG/WebP)</label>
                    <input class="adm-input" type="file" name="thumbnail_file" accept="image/jpeg,image/png,image/webp">
                </div>
            </div>
            <div class="adm-actions" style="justify-content:flex-end;margin-top:10px">
                <button type="button" class="adm-btn" data-modal-close>Cancel</button>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Service</button>
            </div>
        </form>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
