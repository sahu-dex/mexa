<?php
declare(strict_types=1);

$adminPage = 'work';
$adminTitle = 'Videos & Shorts';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$rows = db()->query('SELECT * FROM `work_items` ORDER BY `section` ASC, `sort_order` ASC, `id` DESC')->fetchAll();

$videoCount = 0;
$shortCount = 0;
foreach ($rows as $w) {
    if (($w['section'] ?? '') === 'short') {
        $shortCount++;
    } else {
        $videoCount++;
    }
}

$sectionLabels = [
    'demo' => 'Videos tab',
    'short' => 'Shorts tab',
    'recent' => 'Recent Works',
    'preview' => 'Home preview pool',
];
$maxVideoMb = (int) round(MAX_VIDEO_BYTES / 1048576);
?>

<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Videos &amp; Shorts (<?= count($rows) ?>)</h2>
            <p>
                Upload a video or a thumbnail for each card. Items placed in the <b>Videos tab</b> appear under
                “Videos” on the homepage; items placed in the <b>Shorts tab</b> appear under “Shorts” and play in a
                9:16 vertical preview. Everything published here loads on the website automatically.
            </p>
        </div>
        <div class="adm-actions">
            <button type="button" class="adm-btn adm-btn-primary" data-modal-open="work-modal" data-title="Add Video" data-preset='{"section":"demo","kind":"video"}'>
                <i class="fa-solid fa-plus"></i> Add Video
            </button>
            <button type="button" class="adm-btn" data-modal-open="work-modal" data-title="Add Short" data-preset='{"section":"short","kind":"video"}'>
                <i class="fa-solid fa-clapperboard"></i> Add Short
            </button>
        </div>
    </div>

    <div class="adm-tabs" aria-label="Filter work items">
        <button type="button" class="adm-tab is-active" data-adm-filter="all" aria-pressed="true">
            All (<?= count($rows) ?>)
        </button>
        <button type="button" class="adm-tab" data-adm-filter="video" aria-pressed="false">
            Videos (<?= $videoCount ?>)
        </button>
        <button type="button" class="adm-tab" data-adm-filter="short" aria-pressed="false">
            Shorts (<?= $shortCount ?>)
        </button>
    </div>

    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Thumbnail</th>
                    <th>Title &amp; Media</th>
                    <th>Category</th>
                    <th>Appears In</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php foreach ($rows as $w):
    $wSection = (string) ($w['section'] ?? 'recent');
    $wType = $wSection === 'short' ? 'short' : 'video';
    $wDuration = trim((string) ($w['duration'] ?? ''));
    $thumb = work_item_thumbnail($w);
    $thumbSrc = '';
    if ($thumb !== '') {
        $thumbSrc = (str_starts_with($thumb, 'http') || str_starts_with($thumb, '//') || str_starts_with($thumb, '/'))
            ? $thumb
            : '../' . $thumb;
    }
    $rowJson = htmlspecialchars(json_encode($w, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8');
    $mediaUrl = trim((string) ($w['file_path'] ?? ''));
    if ($mediaUrl === '') {
        $mediaUrl = trim((string) ($w['embed_url'] ?? ''));
    }
    $previewHref = $mediaUrl;
    if ($previewHref !== '' && !preg_match('~^(https?:|/|data:)~i', $previewHref)) {
        $previewHref = '../' . $previewHref;
    }
?>
                <tr data-work-type="<?= e($wType) ?>">
                    <td>
<?php if ($thumbSrc !== ''): ?>
                        <img class="adm-thumb" src="<?= e($thumbSrc) ?>" alt="">
<?php else: ?>
                        <span class="adm-thumb adm-thumb-empty" aria-hidden="true"><i class="fa-solid <?= $wType === 'short' ? 'fa-clapperboard' : 'fa-video' ?>"></i></span>
<?php endif; ?>
                    </td>
                    <td>
                        <b><?= e((string) $w['title']) ?></b>
                        <div class="adm-muted-line"><?= e((string) $w['file_path']) ?></div>
                    </td>
                    <td><?= e((string) ($w['category'] ?: '—')) ?></td>
                    <td>
                        <span class="adm-badge adm-badge-active"><?= $wType === 'short' ? 'Shorts' : 'Videos' ?></span>
                        <div class="adm-muted-line"><?= e($sectionLabels[$wSection] ?? $wSection) ?> · <?= e((string) $w['kind']) ?></div>
                    </td>
                    <td><?= e($wDuration !== '' ? $wDuration : '—') ?></td>
                    <td>
                        <span class="adm-badge adm-badge-<?= ($w['status'] ?? 'published') === 'published' ? 'active' : 'inactive' ?>">
                            <?= ($w['status'] ?? 'published') === 'published' ? 'Published' : 'Draft' ?>
                        </span>
                    </td>
                    <td class="adm-actions">
                        <?php if ($previewHref !== ''): ?>
                        <a class="adm-btn adm-btn-sm" href="<?= e($previewHref) ?>" target="_blank" rel="noopener" title="Open the media in a new tab">
                            <i class="fa-solid fa-play"></i>
                        </a>
                        <?php endif; ?>
                        <button type="button" class="adm-btn adm-btn-sm" data-modal-open="work-modal" data-title="Edit <?= $wType === 'short' ? 'Short' : 'Video' ?>" data-row="<?= $rowJson ?>">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/work.php" data-action="delete" data-id="<?= (int) $w['id'] ?>" data-confirm="Delete this item? The uploaded video and thumbnail will also be removed.">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
<?php endforeach; ?>
                <tr id="work-empty-row" hidden>
                    <td colspan="7" class="adm-empty-cell">No items in this category yet. Use “Add Video” or “Add Short” to publish one.</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<div class="adm-modal" id="work-modal" hidden>
    <div class="adm-modal-box">
        <div class="adm-modal-head">
            <h3 data-modal-title>Add Video</h3>
            <button type="button" class="adm-btn adm-btn-sm" data-modal-close>&times; Close</button>
        </div>
        <form data-adm-api="../api/admin/work.php" enctype="multipart/form-data">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="id" value="0">

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Title *</label>
                    <input class="adm-input" type="text" name="title" required maxlength="180" placeholder="e.g. Brand launch film">
                </div>
                <div class="adm-field">
                    <label>Category</label>
                    <input class="adm-input" type="text" name="category" value="Video Editing" maxlength="80">
                </div>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Appears In *</label>
                    <select class="adm-select" name="section">
                        <option value="demo">Videos tab (homepage + Work page)</option>
                        <option value="short">Shorts tab (9:16 vertical)</option>
                        <option value="recent">Recent Works (Work page)</option>
                        <option value="preview">Home preview pool</option>
                    </select>
                    <small class="adm-hint">Choose “Shorts tab” for vertical 9:16 reels.</small>
                </div>
                <div class="adm-field">
                    <label>Media Kind *</label>
                    <select class="adm-select" name="kind">
                        <option value="video">Video (plays in the preview player)</option>
                        <option value="image">Image only</option>
                    </select>
                </div>
            </div>

            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Duration (optional)</label>
                    <input class="adm-input" type="text" name="duration" placeholder="01:45" maxlength="20">
                </div>
                <div class="adm-field">
                    <label>Sort Order</label>
                    <input class="adm-input" type="number" name="sort_order" value="0">
                </div>
                <div class="adm-field">
                    <label>Status</label>
                    <select class="adm-select" name="status">
                        <option value="published">Published</option>
                        <option value="draft">Draft (hidden)</option>
                    </select>
                </div>
            </div>

            <div class="adm-field">
                <label>Description (optional)</label>
                <textarea class="adm-textarea" name="description"></textarea>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Video link — YouTube, Facebook, Vimeo or any embed URL</label>
                    <input class="adm-input" type="text" name="file_path" placeholder="https://www.youtube.com/watch?v=… or https://fb.watch/…">
                    <small class="adm-hint">The platform is detected automatically (YouTube and other links play in the clean player). Leave empty when you upload a file.</small>
                </div>
                <div class="adm-field">
                    <label>… or upload a video file (MP4, WebM, MOV · max <?= $maxVideoMb ?> MB)</label>
                    <input class="adm-input" type="file" name="media_file" accept="video/mp4,video/webm,video/quicktime">
                    <small class="adm-hint">Stored in uploads/videos and served from your own site. An upload wins over a link; uploading replaces the current file.</small>
                </div>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Thumbnail link or existing path</label>
                    <input class="adm-input" type="text" name="thumbnail_path" placeholder="uploads/images/… or https://…">
                    <small class="adm-hint">16:9 for Videos, 9:16 for Shorts.</small>
                </div>
                <div class="adm-field">
                    <label>Upload thumbnail (JPG, PNG, WebP)</label>
                    <input class="adm-input" type="file" name="thumbnail_file" accept="image/jpeg,image/png,image/webp">
                    <small class="adm-hint">The thumbnail is the card image with the play button.</small>
                </div>
            </div>

            <div class="adm-field" style="justify-content:flex-end">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" name="is_featured" value="1"> Featured on homepage
                </label>
            </div>

            <div class="adm-actions" style="justify-content:flex-end">
                <button type="button" class="adm-btn" data-modal-close>Cancel</button>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save</button>
            </div>
        </form>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
