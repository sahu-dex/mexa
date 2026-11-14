<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'service';
$pageTitle = 'Service | ' . setting('site_name', 'Mexa Motion');
$pageDescription = services_intro_text() ?: 'Professional video editing services.';
$pageScripts = ['assets/js/store.js', 'assets/js/page-service.js?v=20261114-no-deliverables', 'assets/js/service-ticket.js?v=20261114'];

$catalog = get_services_catalog(true);
$services = $catalog['services'];

$overviewVideo = setting_raw('overview_video_file_path', '');
$overviewPoster = setting_raw('overview_poster_file_path', '');
$showOverview = setting_raw('show_overview', '1') !== '0';
$showServices = setting_raw('show_services', '1') !== '0';

// Same contact settings the home page uses (Admin → Settings → Contact).
$waDigits = preg_replace('/[^\d]/', '', setting_raw('whatsapp_number', '')) ?? '';
$waHref = $waDigits !== '' ? 'https://wa.me/' . $waDigits : '';
$tgHref = trim(setting_raw('telegram_url', ''));
if ($tgHref !== '' && !preg_match('#^https?://#i', $tgHref)) {
    $tgHref = 'https://t.me/' . ltrim($tgHref, '@/');
}
$contactImg = setting('hero_image_file_path', 'assets/images/hero-character.webp');

include dirname(__DIR__) . '/includes/header.php';
?>
<section class="sv2-hero">
    <div class="container mx-auto px-4 md:px-8">
        <div class="sv2-hero-in">
            <h1 class="mh-line2" id="sv2-tagline">Video editing that ships <span class="mh-accent">on time, every time</span></h1>
            <p class="mh-desc" id="sv2-hero-desc"><?= e(services_intro_text()) ?></p>
<?php if ($showOverview && ($overviewVideo !== '' || $overviewPoster !== '')): ?>
            <div class="sv2-hero-video" id="sv2-hero-video" aria-label="Our services showreel">
<?php if ($overviewPoster !== ''): ?>
                <img src="<?= e($overviewPoster) ?>" alt="Our services showreel" loading="lazy" decoding="async" width="640" height="360">
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
                        <img src="<?= e($svc['thumbnail_path']) ?>" alt="<?= e($svc['name']) ?> demo thumbnail" loading="lazy" decoding="async" width="640" height="360">
<?php endif; ?>
                        <span class="sv2-veil"></span>
                        <span class="sv2-play"><i class="fa-solid fa-play"></i></span>
                    </button>
<?php elseif ($svc['thumbnail_path'] !== ''): ?>
                    <button type="button" data-sv2-image="<?= e($svc['thumbnail_path']) ?>" data-sv2-alt="<?= e($svc['name']) ?>">
                        <img src="<?= e($svc['thumbnail_path']) ?>" alt="<?= e($svc['name']) ?>" loading="lazy" decoding="async" width="640" height="360">
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
                </div>
            </article>
<?php endforeach; ?>
        </div>
    </div>
</section>
<?php endif; ?>

<section class="svc-contact" id="contact" aria-labelledby="svc-contact-title">
    <div class="container mx-auto px-4 md:px-8">
        <div class="svc-panel">
            <div class="svc-panel-head">
                <div class="svc-contact-photo">
                    <img src="<?= e($contactImg) ?>" alt="<?= e(setting('site_name', 'Mexa Motion')) ?> support" width="72" height="72" loading="lazy" decoding="async" draggable="false">
                    <span class="svc-contact-online" aria-hidden="true"></span>
                </div>
                <div class="svc-head-copy">
                    <span class="svc-contact-kicker">Contact</span>
                    <h2 class="svc-contact-title" id="svc-contact-title">Talk to us directly</h2>
                    <p class="svc-contact-text">Have a project or a question about a service? Message us and we will reply as soon as we can.</p>
                </div>
                <div class="svc-contact-actions">
                    <a class="svc-contact-btn is-wa" href="<?= e($waHref !== '' ? $waHref : '#ticket-form') ?>"<?= $waHref !== '' ? ' target="_blank" rel="noopener"' : '' ?>>
                        <i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>WP Message Me</span>
                    </a>
                    <a class="svc-contact-btn is-tg" href="<?= e($tgHref !== '' ? $tgHref : '#ticket-form') ?>"<?= $tgHref !== '' ? ' target="_blank" rel="noopener"' : '' ?>>
                        <i class="fa-brands fa-telegram" aria-hidden="true"></i><span>TG Message Me</span>
                    </a>
                </div>
            </div>

            <form class="svc-ticket" id="ticket-form" method="post" action="api/submit-ticket.php" novalidate>
                <?= csrf_field() ?>
                <?= honeypot_field() ?>
                <div class="svc-ticket-top">
                    <h3 class="svc-ticket-title">Submit a ticket</h3>
                    <p class="svc-ticket-text">Tell us what you need. We will get back to you on WhatsApp.</p>
                </div>

                <div class="svc-row">
                    <div class="svc-field">
                        <label for="tk-name">Name</label>
                        <input class="svc-input" type="text" id="tk-name" name="name" maxlength="120" autocomplete="name" placeholder="Your name" required>
                    </div>
                    <div class="svc-field">
                        <label for="tk-whatsapp">WhatsApp Number</label>
                        <input class="svc-input" type="tel" id="tk-whatsapp" name="whatsapp" maxlength="24" inputmode="tel" autocomplete="tel" placeholder="+8801XXXXXXXXX" required>
                    </div>
                </div>
                <div class="svc-field">
                    <label for="tk-message">Message / Details</label>
                    <textarea class="svc-input svc-textarea" id="tk-message" name="message" maxlength="2000" rows="4" placeholder="Describe your project or problem in detail" required></textarea>
                </div>

                <p class="svc-ticket-msg" id="tk-msg" role="status" aria-live="polite" hidden></p>
                <div class="svc-ticket-foot">
                    <span class="svc-ticket-note"><i class="fa-solid fa-lock" aria-hidden="true"></i>Your number is only used to reply to this ticket.</span>
                    <button type="submit" class="svc-ticket-submit" id="tk-submit"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span>Submit Ticket</span></button>
                </div>
            </form>
        </div>
    </div>
</section>

<div id="sv2-image" class="sv2-modal" hidden>
    <div class="sv2-modal-box is-image" role="dialog" aria-modal="true" aria-label="Service image preview">
        <button type="button" class="sv2-modal-x" data-sv2-close aria-label="Close image"><i class="fa-solid fa-xmark"></i></button>
        <img id="sv2-image-img" alt="Service image preview" decoding="async" loading="lazy">
    </div>
</div>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
