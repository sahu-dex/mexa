<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'home';
$pageTitle = setting('meta_title', 'Mexa Motion | Professional Video Editing Agency');
$pageDescription = setting('meta_description', 'Professional video editing services for YouTubers, Businesses, Agencies, and Content Creators. High-quality edits with fast turnaround.');
$pageScripts = ['assets/js/home-extra.js', 'assets/js/home-reference-hero.js?v=20261113', 'assets/js/home-work-preview.js?v=20261112-work-preview2'];

$servicesBundle = get_services_catalog(true);
$homeServices = $servicesBundle['services'];

$workBundle = get_work_bundle();
$homeDemoVideos = !empty($workBundle['demos']) ? $workBundle['demos'] : array_slice($workBundle['recent'], 0, 8);
$homeShorts = $workBundle['shorts'];

$featuredReviews = get_featured_reviews();
$teamBundle = get_team_bundle();
$allMembers = $teamBundle['members'];
$founder = null;
$gridMembers = [];
foreach ($allMembers as $m) {
    if ($founder === null && ((int) $m['is_founder'] === 1 || stripos($m['role'], 'founder') !== false)) {
        $founder = $m;
    } else {
        $gridMembers[] = $m;
    }
}
$gridMembers = array_slice($gridMembers, 0, 4);

$heroLine1Parts = split_lines(setting('hero_line_1', "WE CREATE\nVISUALS"));
$heroLine1Html = e(implode(' ', $heroLine1Parts));
$heroLine2 = setting('hero_line_2', 'THAT GROW YOUR BRAND');
$heroDesc = setting('hero_description', 'MEXA MOTION delivers professional, high-quality video editing services at budget-friendly prices. From YouTube videos, Shorts & Reels, and Motion Graphics to Thumbnail Design and Brand Videos, we bring your creative vision to life.');
$heroDescHtml = e($heroDesc);
if (str_starts_with($heroDesc, 'MEXA MOTION')) {
    $heroDescHtml = '<strong>' . e('MEXA MOTION') . '</strong>' . e(substr($heroDesc, strlen('MEXA MOTION')));
}
$heroImg = setting('hero_character_file_path', 'assets/images/hero-character.webp');

$contactEmail = setting_raw('contact_email', '');
$emailHref = ($contactEmail !== '' && !str_contains($contactEmail, '@your-domain.com') && !str_contains($contactEmail, '@example.com'))
    ? 'mailto:' . $contactEmail
    : '#contact';
$waDigits = preg_replace('/[^\d]/', '', setting_raw('whatsapp_number', ''));
$waHref = $waDigits !== '' ? 'https://wa.me/' . $waDigits : '#contact';
$tgRaw = setting_raw('telegram_url', '');
$tgHref = $tgRaw !== '' ? $tgRaw : '#contact';

include dirname(__DIR__) . '/includes/header.php';
?>
<?php if (setting_raw('home_section_hero', '1') !== '0'): ?>
        <section id="home" class="ref-hero" aria-label="Introduction">
            <div class="container mx-auto ref-hero-container">
                <div class="ref-hero-grid">
                    <div class="ref-hero-content" data-aos="fade-right" data-aos-duration="1000">
                        <div class="ref-hero-eyebrow"><span aria-hidden="true"></span>Video Editing Agency</div>
                        <h1 class="hero-title ref-hero-title"><?= $heroLine1Html ?></h1>
                        <div class="ref-hero-subtitle"><span id="ref-hero-typed" data-initial="<?= e($heroLine2) ?>"><?= e($heroLine2) ?></span></div>
                        <p class="ref-hero-description"><?= $heroDescHtml ?></p>
                        <div class="ref-hero-tools" aria-label="Creative tools">
<?php foreach ([
    ['Premiere Pro', 'Pr', 'https://upload.wikimedia.org/wikipedia/commons/4/40/Adobe_Premiere_Pro_CC_icon.svg'],
    ['After Effects', 'Ae', 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Adobe_After_Effects_CC_icon.svg'],
    ['Adobe Photoshop', 'Ps', 'https://upload.wikimedia.org/wikipedia/commons/a/af/Adobe_Photoshop_CC_icon.svg'],
    ['Adobe Illustrator', 'Ai', 'https://upload.wikimedia.org/wikipedia/commons/f/fb/Adobe_Illustrator_CC_icon.svg'],
] as [$toolName, $toolInitials, $toolImage]): ?>
                            <div class="ref-hero-tool" title="<?= e($toolName) ?>"><span aria-hidden="true"><?= e($toolInitials) ?></span><img src="<?= e($toolImage) ?>" alt="<?= e($toolName) ?>" loading="lazy"></div>
<?php endforeach; ?>
                        </div>
                        <div class="ref-hero-actions">
                            <a href="service.php" class="ref-hero-primary"><?= e(setting('hero_btn_primary_text', 'Our Services')) ?> <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
                            <a href="#portfolio" class="ref-hero-secondary"><i class="fa-solid fa-play" aria-hidden="true"></i> View Portfolio</a>
                        </div>
                    </div>
                    <div class="ref-hero-visual" data-aos="fade-left" data-aos-duration="1000" data-aos-delay="200">
                        <div class="ref-hero-glow" aria-hidden="true"></div>
                        <div class="ref-hero-banner">
                            <div class="ref-hero-image"><img src="https://i.ibb.co/0j8vTv1r/We-Poster-2.jpg" data-fallback="<?= e($heroImg) ?>" alt="Mexa Motion banner" width="800" height="450" fetchpriority="high" decoding="async"></div>
                        </div>
                        <div class="ref-hero-rating"><i class="fa-solid fa-star" aria-hidden="true"></i><div><b>4.9/5</b><span>Client Rating</span></div></div>
                    </div>
                </div>
            </div>
        </section>

        <div id="showreel-modal" class="showreel-modal" aria-hidden="true">
            <div class="showreel-backdrop" onclick="closeShowreel()"></div>
            <div class="showreel-box" role="dialog" aria-modal="true" aria-label="Showreel video">
                <button type="button" class="showreel-close" onclick="closeShowreel()" aria-label="Close video">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="showreel-frame" id="showreel-frame"></div>
            </div>
        </div>
<?php endif; ?>

<?php if (setting_raw('home_section_stats', '1') !== '0'): ?>
        <section class="pb-16 pt-8 bg-transparent relative z-10">
            <div class="container mx-auto px-4 md:px-8">
                <div id="stats-container" data-aos="fade-up" data-aos-duration="1000">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 apple-glass-card rounded-3xl p-8">
<?php for ($si = 1; $si <= 4; $si++): ?>
                        <div class="text-center group">
                            <h3 class="text-4xl font-bold text-white mb-2 flex justify-center items-center">
                                <span class="counter" data-target="<?= e(setting("stat_{$si}_number", '0')) ?>">0</span><span class="text-white">+</span>
                            </h3>
                            <p class="text-white font-medium text-sm tracking-wide"><?= e(setting("stat_{$si}_label", '')) ?></p>
                        </div>
<?php endfor; ?>
                    </div>
                </div>
            </div>
        </section>
<?php endif; ?>

<?php if (setting_raw('home_section_services', '1') !== '0'): ?>
        <section id="services" class="py-20 md:py-24 relative bg-transparent">
            <div class="container mx-auto px-4 md:px-8 relative z-10">
                <div class="text-center max-w-2xl mx-auto mb-10 md:mb-14" data-aos="fade-up">
                    <h2 class="svc-title font-extrabold">
                        <span class="hidden md:block text-secondary"><?= e(setting('home_services_title_1', 'Premium Video Editing')) ?></span>
                        <span class="hidden md:block svc-title-blue"><?= e(setting('home_services_title_2', 'Solutions')) ?></span>
                        <span class="md:hidden block text-secondary">Premium Video</span>
                        <span class="md:hidden block"><span class="text-secondary">Editing </span><span class="svc-title-blue"><?= e(setting('home_services_title_2', 'Solutions')) ?></span></span>
                    </h2>
                    <p class="svc-sub text-slate-500 mt-5 md:mt-6 mx-auto">
                        <?= e(setting('home_services_subtitle', '')) ?>
                    </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 lg:gap-7 max-w-[1030px] mx-auto">
<?php foreach ($homeServices as $idx => $svc): ?>
                    <div class="svc-card" data-aos="fade-up" data-aos-delay="<?= 100 + ($idx * 80) ?>">
                        <div class="svc-icon"><i class="<?= e($svc['icon']) ?>"></i></div>
                        <div class="min-w-0">
                            <h3 class="svc-card-title"><?= e($svc['name']) ?></h3>
                            <p class="svc-card-text"><?= e($svc['description']) ?></p>
                        </div>
                    </div>
<?php endforeach; ?>
                </div>
            </div>
        </section>
<?php endif; ?>

<?php if (setting_raw('home_section_work', '1') !== '0'): ?>
        <section id="portfolio" class="py-20 md:py-24 bg-transparent relative">
            <div class="container mx-auto px-4 md:px-8">
                <div class="text-center max-w-4xl mx-auto" data-aos="fade-up">
                    <h2 class="pf-title font-extrabold">
                        <span class="text-secondary"><?= e(setting('home_portfolio_title_1', 'Explore Our Recent ')) ?></span><span class="pf-title-blue"><?= e(setting('home_portfolio_title_2', 'Work & Video Demos')) ?></span>
                    </h2>
                    <p class="pf-sub text-slate-500 mt-4 md:mt-5 mx-auto">
                        <?= e(setting('home_portfolio_subtitle', '')) ?>
                    </p>
                </div>

                <div class="pf-tabs mt-7 md:mt-8 mb-8 md:mb-10" data-aos="fade-up" data-aos-delay="80" role="tablist" aria-label="Work categories">
                    <button type="button" id="tab-videos" class="pf-tab is-active" role="tab" aria-selected="true" aria-controls="grid-videos" tabindex="0">
                        <span class="pf-tab-ic" aria-hidden="true"><i class="fa-solid fa-play"></i></span> Videos
                    </button>
                    <button type="button" id="tab-shorts" class="pf-tab" role="tab" aria-selected="false" aria-controls="grid-shorts" tabindex="-1">
                        <span class="pf-tab-ic" aria-hidden="true"><i class="fa-solid fa-clapperboard"></i></span> Shorts
                    </button>
                </div>

                <div id="grid-videos" class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 transition-opacity duration-500" role="tabpanel" aria-labelledby="tab-videos">
<?php foreach ($homeDemoVideos as $vi => $vItem):
    $vThumb = work_item_thumbnail($vItem);
    $vKind = ($vItem['kind'] ?? 'video') === 'image' ? 'image' : 'video';
    $vSrc = trim((string) ($vItem['file_path'] ?? ''));
    $vEmbed = trim((string) ($vItem['embed_url'] ?? ''));
    $vType = trim((string) ($vItem['embed_type'] ?? ''));
    $vPreview = work_item_previewable($vItem);
    $vHref = $vPreview && $vSrc !== '' ? $vSrc : 'work.php';
?><a href="<?= e($vHref) ?>"<?= $vPreview ? ' data-mm-media="1"' : '' ?> data-mm-kind="<?= e($vKind) ?>" data-mm-src="<?= e($vSrc) ?>" data-mm-embed="<?= e($vEmbed) ?>" data-mm-type="<?= e($vType) ?>" data-mm-poster="<?= e($vThumb) ?>" data-mm-title="<?= e($vItem['title']) ?>" class="pf-card pf-card-video" data-aos="fade-up" data-aos-delay="<?= 100 + ($vi * 50) ?>" aria-label="<?= e(($vPreview ? 'Play ' : 'View ') . $vItem['title']) ?>">
<?php if ($vThumb !== ''): ?>
                        <img src="<?= e($vThumb) ?>" alt="<?= e($vItem['title']) ?> thumbnail" class="pf-thumb" loading="lazy" decoding="async" width="600" height="340">
<?php else: ?>
                        <span class="pf-thumb-fallback" aria-hidden="true"><i class="fa-solid fa-film"></i></span>
<?php endif; ?>
                        <span class="pf-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l11-6.5z" fill="<?= chr(35) ?>1051DF"></path></svg></span>
                    </a>
<?php endforeach; ?>
<?php if (empty($homeDemoVideos)): ?>
                    <p class="pf-empty">Videos will appear here as soon as they are published from the Admin Panel.</p>
<?php endif; ?>
                </div>

                <div id="grid-shorts" class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 transition-opacity duration-500 hidden" role="tabpanel" aria-labelledby="tab-shorts" hidden>
<?php foreach ($homeShorts as $sItem):
    $sThumb = work_item_thumbnail($sItem);
    $sKind = ($sItem['kind'] ?? 'video') === 'image' ? 'image' : 'video';
    $sSrc = trim((string) ($sItem['file_path'] ?? ''));
    $sEmbed = trim((string) ($sItem['embed_url'] ?? ''));
    $sType = trim((string) ($sItem['embed_type'] ?? ''));
    $sPreview = work_item_previewable($sItem);
    $sHref = $sPreview && $sSrc !== '' ? $sSrc : 'work.php';
?><a href="<?= e($sHref) ?>"<?= $sPreview ? ' data-mm-media="1"' : '' ?> data-mm-kind="<?= e($sKind) ?>" data-mm-src="<?= e($sSrc) ?>" data-mm-embed="<?= e($sEmbed) ?>" data-mm-type="<?= e($sType) ?>" data-mm-poster="<?= e($sThumb) ?>" data-mm-title="<?= e($sItem['title']) ?>" data-mm-vertical="1" class="pf-card pf-card-short" aria-label="<?= e(($sPreview ? 'Play ' : 'View ') . $sItem['title']) ?>">
<?php if ($sThumb !== ''): ?>
                        <img src="<?= e($sThumb) ?>" alt="<?= e($sItem['title']) ?> thumbnail" class="pf-thumb" loading="lazy" decoding="async" width="400" height="711">
<?php else: ?>
                        <span class="pf-thumb-fallback" aria-hidden="true"><i class="fa-solid fa-clapperboard"></i></span>
<?php endif; ?>
                        <span class="pf-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l11-6.5z" fill="<?= chr(35) ?>1051DF"></path></svg></span>
                    </a>
<?php endforeach; ?>
<?php if (empty($homeShorts)): ?>
                    <p class="pf-empty">Shorts will appear here as soon as they are published from the Admin Panel.</p>
<?php endif; ?>
                </div>
            </div>
        </section>

        <div id="mm-work-modal" class="mmvp" hidden aria-hidden="true">
            <div class="mmvp-dialog" role="dialog" aria-modal="true" aria-labelledby="mm-work-modal-title">
                <div class="mmvp-stage">
                    <button type="button" class="mmvp-close" data-mm-close aria-label="Close video preview">&times;</button>
                    <div class="mmvp-player" data-mm-player></div>
                    <div class="mmvp-loading" data-mm-loading>
                        <span class="mmvp-spinner" aria-hidden="true"></span>
                        <span>Loading video&hellip;</span>
                    </div>
                    <div class="mmvp-error" data-mm-error hidden>
                        <p data-mm-error-text>This video could not be played right now.</p>
                        <span class="mmvp-error-actions">
                            <a class="mmvp-external" data-mm-external href="#" target="_blank" rel="noopener noreferrer">Open in a new tab</a>
                            <button type="button" class="mmvp-retry" data-mm-retry>Try again</button>
                        </span>
                    </div>
                </div>
                <div class="mmvp-meta">
                    <h3 class="mmvp-title" id="mm-work-modal-title"></h3>
                    <p class="mmvp-hint">Press Esc or click outside the player to close.</p>
                </div>
                <p class="mmvp-status" role="status" data-mm-status></p>
            </div>
        </div>
<?php endif; ?>

<?php if (setting_raw('home_section_process', '1') !== '0'): ?>
        <section id="process" class="py-20 md:py-24 relative bg-transparent">
            <div class="container mx-auto px-4 md:px-8">
                <div class="text-center rv-head" data-aos="fade-up">
                    <span class="rv-kicker"><?= e(setting('process_kicker', 'How It Works')) ?></span>
                    <h2 class="rv-title font-extrabold mt-4"><?= e(setting('process_title', 'Simple & Transparent Process')) ?></h2>
                    <p class="rv-sub text-slate-500"><?= e(setting('process_subtitle', 'Four simple steps from raw footage to a publish-ready video.')) ?></p>
                </div>

                <div class="pr-grid">
<?php for ($pi = 1; $pi <= 4; $pi++): ?>
                    <div class="pr-card" data-aos="fade-up" data-aos-delay="<?= 100 + (($pi - 1) * 80) ?>">
                        <div class="pr-top"></div>
                        <div class="pr-body">
                            <span class="pr-step">Step 0<?= $pi ?></span>
                            <h3 class="pr-title"><?= e(setting("process_{$pi}_title", '')) ?></h3>
                            <p class="pr-text"><?= e(setting("process_{$pi}_text", '')) ?></p>
                        </div>
                    </div>
<?php endfor; ?>
                </div>
            </div>
        </section>
<?php endif; ?>

<?php if (setting_raw('home_section_reviews', '1') !== '0'): ?>
        <section id="reviews" class="py-20 md:py-24 relative overflow-hidden bg-transparent">
            <div class="container mx-auto px-4 md:px-8 relative z-10">
                <div class="rv-head text-center" data-aos="fade-up">
                    <h2 class="rv-title font-extrabold mt-4"><?= e(setting('home_reviews_title', 'What Our Clients Say')) ?></h2>
                    <p class="rv-sub text-slate-500"><?= e(setting('home_reviews_subtitle', '')) ?></p>
                </div>

                <div class="rs-wrap" data-aos="fade-up" data-aos-delay="120">
                    <div class="reviews-container">
<?php foreach ($featuredReviews as $rv):
    $rvRating = max(1, min(5, (int) $rv['rating']));
    $rvPhoto = (string) ($rv['file_path'] ?? '');
?>
                        <article class="review-card flex-none w-[300px] md:w-[400px] apple-glass-card p-8 rounded-[2rem] hover:shadow-[0_15px_40px_rgba(16,81,223,0.1)] transition-shadow">
                            <div class="rv-card-top">
                                <span class="rv-story"><i class="fa-solid fa-quote-left"></i>Customer Story</span>
                                <span class="rv-stars text-yellow-400"><?php for ($st = 1; $st <= $rvRating; $st++): ?><i class="fa-solid fa-star"></i><?php endfor; ?></span>
                            </div>
                            <p class="rv-quote text-slate-600 text-sm leading-relaxed italic">"<?= e($rv['body']) ?>"</p>
                            <div class="rv-person">
<?php if ($rvPhoto !== ''): ?>
                                <img src="<?= e($rvPhoto) ?>" alt="<?= e($rv['name']) ?>" class="rv-avatar w-12 h-12 rounded-full object-cover" loading="lazy" decoding="async">
<?php else: ?>
                                <div class="rv-avatar w-12 h-12 rounded-full bg-blue-100 text-primary font-bold flex items-center justify-center text-sm"><?= e(mb_strtoupper(mb_substr($rv['name'], 0, 1))) ?></div>
<?php endif; ?>
                                <div class="min-w-0">
                                    <h5 class="font-bold text-secondary text-sm"><?= e($rv['name']) ?></h5>
                                    <p class="text-primary text-xs"><?= e($rv['role'] ?? '') ?></p>
                                </div>
                            </div>
                        </article>
<?php endforeach; ?>
                    </div>

                    <div class="rs-foot">
                        <a href="review.php" class="seen-more-link">Seen More <i class="fa-solid fa-arrow-right"></i></a>
                    </div>
<?php $rvNote = setting_raw('home_reviews_note', 'Sample testimonials shown for layout preview — replace with verified client feedback before launch.'); if ($rvNote !== ''): ?>
                    <p class="rv-note"><?= e($rvNote) ?></p>
<?php endif; ?>
                </div>
            </div>
        </section>
<?php endif; ?>

<?php if (setting_raw('home_section_team', '1') !== '0'): ?>
        <section id="team" class="py-20 md:py-24 bg-transparent overflow-hidden relative">
            <div class="container mx-auto px-4 md:px-8">
                <div class="text-center max-w-2xl mx-auto mb-9 md:mb-12" data-aos="fade-up">
                    <h2 class="tm-title font-extrabold">
                        <span class="text-secondary">Our </span><span class="tm-title-blue">Team</span>
                    </h2>
                    <p class="tm-sub text-slate-500 mt-3 md:mt-4"><?= e(setting('home_team_subtitle', 'A passionate team working together to provide the best service for you.')) ?></p>
                </div>

<?php if ($founder !== null): ?>
                <div class="mx-founder-card mx-profile-card" data-aos="fade-up">
                    <div class="tm-founder-photo">
                        <img src="<?= e($founder['file_path']) ?>" alt="<?= e($founder['name']) ?>" loading="lazy" decoding="async">
                    </div>

                    <div class="mx-profile-body">
                        <h3 class="tm-founder-name"><?= e($founder['name']) ?></h3>
                        <p class="tm-founder-role"><?= e($founder['role']) ?></p>
                        <p class="tm-founder-bio"><?= e($founder['bio'] !== '' ? $founder['bio'] : $founder['description']) ?></p>

                        <div class="mx-profile-perks">
                            <div class="tm-perk">
                                <span class="tm-perk-ic"><svg class="tm-perk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.6V12l3.1 1.9"/></svg></span>
                                <div>
                                    <p class="tm-perk-title"><?= e(setting('founder_perk_1_title', '6+ Years Exp.')) ?></p>
                                    <p class="tm-perk-text"><?= e(setting('founder_perk_1_text', 'Industry Veteran')) ?></p>
                                </div>
                            </div>
                            <div class="tm-perk">
                                <span class="tm-perk-ic"><svg class="tm-perk-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="9" r="5.6"/><path d="M8.7 13.7 7 21l5-2.6L17 21l-1.7-7.3"/><path d="m10.2 8.9 1.3 1.3 2.4-2.4"/></svg></span>
                                <div>
                                    <p class="tm-perk-title"><?= e(setting('founder_perk_2_title', 'Certified Pro')) ?></p>
                                    <p class="tm-perk-text"><?= e(setting('founder_perk_2_text', 'Adobe Workflow Expert')) ?></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
<?php endif; ?>

<?php if (!empty($gridMembers)): ?>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-5 max-w-6xl mx-auto mt-6 md:mt-8">
<?php foreach ($gridMembers as $mi => $mem): ?>
                    <div class="tm-card" data-aos="fade-up" data-aos-delay="<?= 100 + ($mi * 80) ?>">
                        <div class="tm-photo">
                            <img src="<?= e($mem['file_path']) ?>" alt="<?= e($mem['name']) ?>" loading="lazy" decoding="async">
                        </div>
                        <div class="tm-body">
                            <h4 class="tm-name"><?= e($mem['name']) ?></h4>
                            <p class="tm-role"><?= e($mem['role']) ?></p>
                        </div>
                    </div>
<?php endforeach; ?>
                </div>
<?php endif; ?>
            </div>
        </section>
<?php endif; ?>

<?php if (setting_raw('home_section_about', '1') !== '0'): ?>
        <section id="about" class="py-20 md:py-24 bg-transparent relative">
            <div class="container mx-auto px-4 md:px-8">
                <h2 class="abt-title" data-aos="fade-up"><span class="abt-title-dark"><?= e(setting('about_title_1', 'About')) ?></span> <span class="abt-title-blue"><?= e(setting('about_title_2', 'Mexa Motion')) ?></span></h2>

                <div class="abt-grid">
                    <div class="abt-collage" data-aos="fade-right">
                        <img class="abt-photo abt-a" src="<?= e(setting('about_image_1_file_path', 'assets/about/editing-suite.jpg')) ?>" alt="Video editing suite" width="1280" height="720" loading="lazy" decoding="async" draggable="false">
                        <img class="abt-photo abt-b" src="<?= e(setting('about_image_2_file_path', 'assets/about/motion-graphics.jpg')) ?>" alt="Motion graphics design" width="1280" height="720" loading="lazy" decoding="async" draggable="false">
                        <div class="abt-c-wrap">
                            <img class="abt-photo abt-c" src="<?= e(setting('about_image_3_file_path', 'assets/about/color-grading.jpg')) ?>" alt="Color grading studio" width="1280" height="720" loading="lazy" decoding="async" draggable="false">
                            <div class="abt-float" aria-label="<?= e(setting('about_rating_badge', '4.9/5 Client Rating')) ?>">
                                <span class="abt-float-ic"><i class="fa-solid fa-star" aria-hidden="true"></i></span>
                                <?= e(setting('about_rating_badge', '4.9/5 Client Rating')) ?>
                            </div>
                        </div>
                    </div>

                    <div class="abt-body" data-aos="fade-left">
                        <h3 class="abt-heading"><?= e(setting('about_heading', 'Real people, real timelines, real results')) ?></h3>
                        <p class="abt-text"><?= e(setting('about_paragraph_1', '')) ?></p>
                        <p class="abt-text"><?= e(setting('about_paragraph_2', '')) ?></p>
                    </div>
                </div>
            </div>
        </section>

        <div class="abt-services-cta">
            <a href="service.php" class="hero-btn glass-btn-primary abt-services-btn" aria-label="Go to Our Services">
                Our Services <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </a>
        </div>
<?php endif; ?>

<?php if (setting_raw('home_section_contact', '1') !== '0'): ?>
        <section id="contact" class="py-20 md:py-24 bg-transparent relative">
            <div class="container mx-auto px-4 md:px-8">
                <div class="text-center max-w-2xl mx-auto mb-10 md:mb-12" data-aos="fade-up">
                    <h2 class="ct-title font-extrabold mt-3"><?= e(setting('home_contact_title', 'Let’s Work Together')) ?></h2>
                    <p class="ct-sub text-slate-500 mt-4 mx-auto"><?= e(setting('home_contact_subtitle', 'Have a project in mind? Send us a message and let’s create something amazing.')) ?></p>
                </div>

                <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                    <a href="<?= e($emailHref) ?>" class="ct-card" data-aos="fade-up" data-aos-delay="100">
                        <span class="ct-icon"><i class="fa-solid fa-envelope"></i></span>
                        <h3 class="ct-card-title">Email</h3>
                        <p class="ct-card-text">Email us about your project</p>
                    </a>

                    <a href="<?= e($waHref) ?>"<?= str_starts_with($waHref, 'http') ? ' target="_blank" rel="noopener"' : '' ?> class="ct-card" data-aos="fade-up" data-aos-delay="180">
                        <span class="ct-icon"><i class="fa-brands fa-whatsapp"></i></span>
                        <h3 class="ct-card-title">WhatsApp</h3>
                        <p class="ct-card-text">Chat with us about your next video</p>
                    </a>

                    <a href="<?= e($tgHref) ?>"<?= str_starts_with($tgHref, 'http') ? ' target="_blank" rel="noopener"' : '' ?> class="ct-card" data-aos="fade-up" data-aos-delay="260">
                        <span class="ct-icon"><i class="fa-brands fa-telegram"></i></span>
                        <h3 class="ct-card-title">Telegram</h3>
                        <p class="ct-card-text">Share your ideas with our team</p>
                    </a>
                </div>
            </div>
        </section>
<?php endif; ?>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
