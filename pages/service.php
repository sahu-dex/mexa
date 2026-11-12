<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'service';
$pageTitle = 'Service | ' . setting('site_name', 'Mexa Motion');
$pageDescription = setting('services_intro', 'Professional video editing services and packages.');
$pageScripts = ['assets/js/store.js', 'assets/js/page-service.js'];

$catalog = get_services_with_packages(true);
$services = $catalog['services'];
$firstService = $services[0] ?? null;

$overviewVideo = setting_raw('overview_video_file_path', '');
$overviewPoster = setting_raw('overview_poster_file_path', '');
$showOverview = setting_raw('show_overview', '1') !== '0';
$showServices = setting_raw('show_services', '1') !== '0';
$showPackages = setting_raw('show_packages', '1') !== '0';

include dirname(__DIR__) . '/includes/header.php';
?>
<section class="sv2-hero">
    <div class="container mx-auto px-4 md:px-8">
        <div class="sv2-hero-in">
            <h1 class="mh-line2" id="sv2-tagline">Video editing that ships on time, every time</h1>
            <p class="mh-desc" id="sv2-hero-desc"><?= e(setting('services_intro', '')) ?></p>
<?php if ($showOverview && ($overviewVideo !== '' || $overviewPoster !== '')): ?>
            <div class="sv2-hero-video" id="sv2-hero-video" aria-label="Our services showreel">
<?php if ($overviewPoster !== ''): ?>
                <img src="<?= e($overviewPoster) ?>" alt="Our services showreel" loading="lazy" decoding="async">
<?php endif; ?>
<?php if ($overviewVideo !== ''): ?>
                <span class="sv2-veil"></span>
                <button type="button" class="sv2-video-btn" data-sv2-video="<?= e($overviewVideo) ?>" data-mm-video-url="<?= e($overviewVideo) ?>" data-mm-video-poster="<?= e($overviewPoster) ?>" aria-label="Play our services showreel">
                    <span class="sv2-play"><i class="fa-solid fa-play"></i></span>
                </button>
<?php endif; ?>
            </div>
<?php endif; ?>
            <div class="sv2-hero-sep" aria-hidden="true"></div>
        </div>
    </div>
</section>

<?php if ($showServices): ?>
<section class="sv2-sec" id="services">
    <div class="container mx-auto px-4 md:px-8">
        <div class="sv2-grid" id="sv2-services">
<?php foreach ($services as $svc): ?>
            <article class="sv2-card" id="svc-<?= (int) $svc['id'] ?>">
                <span class="sv2-label"><i class="fa-solid fa-layer-group"></i><?= e($svc['category']) ?></span>
                <h2 class="sv2-title"><?= e($svc['name']) ?></h2>
<?php if ($svc['subtitle'] !== ''): ?>
                <p class="sv2-sub"><?= e($svc['subtitle']) ?></p>
<?php endif; ?>
                <div class="sv2-media">
<?php if ($svc['file_path'] !== ''): ?>
                    <button type="button" data-sv2-video="<?= e($svc['file_path']) ?>" data-mm-video-url="<?= e($svc['file_path']) ?>" data-mm-video-poster="<?= e($svc['thumbnail_path']) ?>" data-mm-video-title="<?= e($svc['name']) ?> demo" aria-label="Play <?= e($svc['name']) ?> demo">
<?php if ($svc['thumbnail_path'] !== ''): ?>
                        <img src="<?= e($svc['thumbnail_path']) ?>" alt="<?= e($svc['name']) ?> demo thumbnail" loading="lazy" decoding="async">
<?php endif; ?>
                        <span class="sv2-veil"></span>
                        <span class="sv2-play"><i class="fa-solid fa-play"></i></span>
                    </button>
<?php elseif ($svc['thumbnail_path'] !== ''): ?>
                    <button type="button" data-sv2-image="<?= e($svc['thumbnail_path']) ?>" data-sv2-alt="<?= e($svc['name']) ?>">
                        <img src="<?= e($svc['thumbnail_path']) ?>" alt="<?= e($svc['name']) ?>" loading="lazy" decoding="async">
                        <span class="sv2-zoom"><i class="fa-solid fa-image"></i> View image</span>
                    </button>
<?php else: ?>
                    <div class="sv2-media-empty"><span><i class="fa-solid fa-clapperboard"></i>Media coming soon</span></div>
<?php endif; ?>
                </div>
                <div class="sv2-grow">
<?php $svcBody = $svc['long_description'] !== '' ? $svc['long_description'] : $svc['description']; ?>
<?php if ($svcBody !== ''): ?>
                    <p class="sv2-body"><?= nl2br(e($svcBody)) ?></p>
<?php endif; ?>
<?php if (!empty($svc['features'])): ?>
                    <ul class="sv2-feats">
<?php foreach ($svc['features'] as $feat): ?>
                        <li><i class="fa-solid fa-check"></i><span><?= e($feat) ?></span></li>
<?php endforeach; ?>
                    </ul>
<?php endif; ?>
<?php if ($svc['deliverables'] !== ''): ?>
                    <p class="sv2-deliv"><b>Deliverables</b><?= e(str_replace(["\r\n", "\n"], ' · ', $svc['deliverables'])) ?></p>
<?php endif; ?>
                </div>
            </article>
<?php endforeach; ?>
        </div>
    </div>
</section>
<?php endif; ?>

<?php if ($showPackages): ?>
<section class="sp-sec sp-packages-final" id="packages">
    <div class="container mx-auto px-4 md:px-8">
        <div class="sp-packages-head">
            <h2 class="sp-packages-title">Packages</h2>
            <p>three quality levels · pick your service, then choose a package</p>
        </div>
        <label class="sp-pick" for="sv-svc-pick"><span>Service</span>
            <select id="sv-svc-pick">
<?php foreach ($services as $svc): ?>
                <option value="<?= (int) $svc['id'] ?>"><?= e($svc['name']) ?></option>
<?php endforeach; ?>
            </select>
        </label>
        <div class="sp-pkgs" id="sv-pkg-cards">
<?php if ($firstService !== null): ?>
<?php foreach ($firstService['packages'] as $pkg): ?>
            <article class="sp-pkg sv-pkg<?= $pkg['highlight'] ? ' is-hi' : '' ?>" data-quality="<?= e($pkg['quality']) ?>">
<?php
            // The legacy "Best Value" badge was retired from the package cards.
            $pkgBadge = trim((string) $pkg['badge']);
            if (strtolower($pkgBadge) === 'best value') {
                $pkgBadge = '';
            }
?>
<?php if ($pkgBadge !== ''): ?>
                <span class="sv-pkg-badge"><?= e($pkgBadge) ?></span>
<?php endif; ?>
                <h3><?= e($pkg['name']) ?></h3>
<?php if ($pkg['description'] !== ''): ?>
                <p class="sp-pkg-desc"><?= e($pkg['description']) ?></p>
<?php endif; ?>
                <div class="sv-pkg-price"><b>$<?= e(rtrim(rtrim(number_format((float) $pkg['price'], 2, '.', ''), '0'), '.')) ?></b><span>/ project</span></div>
                <div class="sv-pkg-meta">
<?php if ($pkg['delivery'] !== ''): ?>
                    <span><i class="fa-regular fa-clock"></i><?= e($pkg['delivery']) ?></span>
<?php endif; ?>
<?php if ($pkg['revisions'] !== ''): ?>
                    <span><i class="fa-solid fa-rotate"></i><?= e($pkg['revisions']) ?></span>
<?php endif; ?>
                </div>
                <ul class="sv-feats">
<?php foreach ($pkg['features'] as $pf): ?>
                    <li><i class="fa-solid fa-check"></i><span><?= e($pf) ?></span></li>
<?php endforeach; ?>
                </ul>
                <button type="button" class="sv-btn sv-btn-primary sp-buy" data-buy-service="<?= (int) $pkg['service_id'] ?>" data-buy-quality="<?= e($pkg['quality']) ?>" aria-label="Buy <?= e($firstService['name'] . ' — ' . $pkg['name']) ?>">
                    Buy This Package <i class="fa-solid fa-arrow-right text-xs"></i>
                </button>
            </article>
<?php endforeach; ?>
<?php endif; ?>
        </div>
    </div>
</section>
<?php endif; ?>

<div id="sv2-video" class="sv2-modal" hidden>
    <div class="sv2-modal-box" role="dialog" aria-modal="true" aria-label="Service video">
        <button type="button" class="sv2-modal-x" data-sv2-close aria-label="Close video"><i class="fa-solid fa-xmark"></i></button>
        <div class="sv2-stage" id="sv2-video-stage"></div>
    </div>
</div>

<div id="sv2-image" class="sv2-modal" hidden>
    <div class="sv2-modal-box is-image" role="dialog" aria-modal="true" aria-label="Service image preview">
        <button type="button" class="sv2-modal-x" data-sv2-close aria-label="Close image"><i class="fa-solid fa-xmark"></i></button>
        <img id="sv2-image-img" alt="Service image preview" decoding="async" loading="lazy">
    </div>
</div>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
