<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'work';
$pageTitle = 'Work | ' . setting('site_name', 'Mexa Motion');
$pageDescription = 'Every video, short, design and tutorial we build — click any card to watch it right here.';
$pageScripts = ['assets/js/page-work.js?v=20261113-clean-player'];

$workBundle = get_work_bundle();
$recentSix = array_slice($workBundle['recent'], 0, 6);
$demos = $workBundle['demos'];
$shorts = $workBundle['shorts'];

include dirname(__DIR__) . '/includes/header.php';
?>
        <section class="wk-wrap">
            <h1 class="mh-line2">We've shipped</h1>
            <p class="mh-desc">Every video, short, design and tutorial we build — published on our YouTube channel and Facebook page. Click any card to watch it right here.</p>
        </section>

        <section class="wk-sec" id="wk-recent-sec">
            <h2 class="wk-h2">Recently Worked On</h2>
            <p class="wk-h2small">Six recent video previews. Select a card to play the video right here.</p>
            <div class="wk-recent" id="wk-recent-grid" aria-live="polite">
<?php foreach ($recentSix as $idx => $item):
    $thumb = $item['thumbnail_path'] !== '' ? $item['thumbnail_path'] : $item['file_path'];
?>
                <button type="button" class="wk-rc" data-section="recent" data-index="<?= $idx ?>" data-mm-video-url="<?= e($item['file_path']) ?>" data-mm-video-type="<?= e($item['embed_type']) ?>" data-mm-video-embed-url="<?= e($item['embed_url']) ?>" data-mm-video-provider="<?= e($item['embed_provider']) ?>" data-mm-video-poster="<?= e($thumb) ?>" data-mm-video-title="<?= e($item['title']) ?>" aria-label="Play <?= e($item['title']) ?>">
                    <span class="th">
                        <img src="<?= e($thumb) ?>" alt="<?= e($item['title']) ?> thumbnail" loading="lazy" decoding="async" width="640" height="360">
                        <span class="wk-rc-play"><i class="fa-solid fa-play"></i></span>
                    </span>
                </button>
<?php endforeach; ?>
            </div>
        </section>

        <section class="wk-sec" id="wk-demo-sec">
            <h2 class="wk-h2">Videos</h2>
            <p class="wk-h2small">Example video cards matching the Home Page Videos gallery.</p>
            <div class="wk-demo-grid" id="wk-demo-grid">
<?php foreach ($demos as $idx => $item):
    $thumb = $item['thumbnail_path'] !== '' ? $item['thumbnail_path'] : $item['file_path'];
?>
                <button type="button" class="wk-demo" data-section="demo" data-index="<?= $idx ?>" data-mm-video-url="<?= e($item['file_path']) ?>" data-mm-video-poster="<?= e($thumb) ?>" data-mm-video-title="<?= e($item['title']) ?>" aria-label="Play <?= e($item['title']) ?>">
                    <span class="shot"><img src="<?= e($thumb) ?>" alt="<?= e($item['title']) ?> thumbnail" loading="lazy" decoding="async" width="640" height="360"></span>
                    <span class="ply"><i class="fa-solid fa-play"></i></span>
                </button>
<?php endforeach; ?>
            </div>
        </section>

        <section class="wk-sec" id="wk-shorts-sec">
            <h2 class="wk-h2">Shorts</h2>
            <p class="wk-h2small">Example vertical cards matching the Home Page Shorts gallery.</p>
            <div class="wk-shorts" id="wk-shorts-grid">
<?php foreach ($shorts as $idx => $item):
    $thumb = $item['thumbnail_path'] !== '' ? $item['thumbnail_path'] : $item['file_path'];
?>
                <button type="button" class="wk-short" data-section="short" data-index="<?= $idx ?>" data-mm-video-url="<?= e($item['file_path']) ?>" data-mm-video-poster="<?= e($thumb) ?>" data-mm-video-title="<?= e($item['title']) ?>" aria-label="Play <?= e($item['title']) ?>">
                    <img src="<?= e($thumb) ?>" alt="<?= e($item['title']) ?> thumbnail" loading="lazy" decoding="async" width="405" height="720">
                    <i class="wk-short-play fa-solid fa-play" aria-hidden="true"></i>
                </button>
<?php endforeach; ?>
            </div>
        </section>

<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
