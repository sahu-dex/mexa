<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once __DIR__ . '/functions.php';
mexa_start_session();

$pageKey = $pageKey ?? 'home';
$siteName = setting('site_name', 'Mexa Motion');
$brandTagline = setting('brand_tagline', 'Video Editing Agency');
$metaTitle = $pageTitle ?? setting('meta_title', $siteName . ' | Professional Video Editing Agency');
$metaDesc = $pageDescription ?? setting('meta_description', 'Professional video editing services for YouTubers, Businesses, Agencies, and Content Creators.');
$faviconPath = setting('favicon_file_path', 'assets/images/favicon.png');
$stylesheets = page_stylesheets($pageKey);

$brandWords = preg_split('/\s+/', strtoupper(trim($siteName)), 2) ?: ['MEXA', 'MOTION'];
$brandPartA = $brandWords[0] ?? 'MEXA';
$brandPartB = $brandWords[1] ?? '';

$navItems = [
    ['key' => 'home', 'href' => 'index.php', 'i18n' => 'nav.home', 'label' => 'Home'],
    ['key' => 'service', 'href' => 'service.php', 'i18n' => 'nav.service', 'label' => 'Service'],
    ['key' => 'work', 'href' => 'work.php', 'i18n' => 'nav.work', 'label' => 'Work'],
    ['key' => 'review', 'href' => 'review.php', 'i18n' => 'nav.review', 'label' => 'Review'],
    ['key' => 'team', 'href' => 'team.php', 'i18n' => 'nav.headerTeam', 'label' => 'Team'],
];
?>
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
    <link rel="icon" type="image/png" href="<?= e($faviconPath) ?>">
    <title><?= e($metaTitle) ?></title>
    <meta name="description" content="<?= e($metaDesc) ?>">
    <?php // Warm the two third-party hosts the galleries use before the first
          // thumbnail is requested: without this every YouTube poster pays a DNS +
          // TLS handshake on top of its download, which is what made the work
          // grids appear to load slowly. video-player.js still primes from JS on
          // the first hover, but that only helps for the second video; declaring
          // the hint in the head means the connection is already opening while
          // the gallery markup is still being parsed. ?>
    <?php // No `crossorigin`: thumbnails are plain <img> requests and the player
          // is an iframe, neither of which is a CORS fetch. A crossorigin
          // preconnect opens a different connection pool and would not be reused. ?>
    <link rel="preconnect" href="https://i.ytimg.com">
    <link rel="dns-prefetch" href="https://i.ytimg.com">
    <link rel="preconnect" href="https://www.youtube-nocookie.com">
    <link rel="dns-prefetch" href="https://www.youtube-nocookie.com">
<?php foreach ($stylesheets as $cssHref): ?>
    <link rel="stylesheet" href="<?= e($cssHref) ?>">
<?php endforeach; ?>
</head>
<body class="font-sans text-slate-700 bg-white antialiased overflow-x-hidden relative">
    <div class="cursor-dot"></div>
    <div class="cursor-glow"></div>

    <div class="w-full max-w-full overflow-x-hidden relative flex flex-col min-h-screen z-10">
        <header id="header" class="hdr-bar-wrap flex items-center bg-white">
            <div class="container mx-auto px-4 md:px-8 flex justify-between items-center w-full h-full gap-4">
                <a href="index.php" aria-label="<?= e($siteName . ' — ' . $brandTagline) ?>" class="mm-brand-link flex items-center gap-2 group flex-shrink-0">
                    <span class="brand-logo-badge">
                        <svg class="brand-logo-mark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" role="img" aria-labelledby="title042 desc042">
                            <title id="title042">Mexa Motion M Mark 042</title>
                            <desc id="desc042">Forward Cut logo concept with motion-inspired detail.</desc>
                            <defs>
                                <linearGradient id="g042" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="<?= chr(35) ?>08264F"/><stop offset="1" stop-color="<?= chr(35) ?>1E5FEA"/></linearGradient>
                                <linearGradient id="ag042" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="<?= chr(35) ?>49B8FF"/><stop offset="1" stop-color="<?= chr(35) ?>1E5FEA"/></linearGradient>
                            </defs>
                            <g>
                                <path d="M 17 89 L 25 11 L 47 11 L 64 43 L 91 11 L 112 11 L 104 89 L 81 89 L 85 51 L 62 78 L 41 50 L 37 89 Z" fill="url(<?= chr(35) ?>g042)"/>
                                <path d="M 2 31 H 18 M 0 47 H 16 M 3 63 H 18" fill="none" stroke="<?= chr(35) ?>49B8FF" stroke-width="4" stroke-linecap="round"/>
                            </g>
                        </svg>
                    </span>
                    <span class="brand-copy"><span class="brand-word text-[19px] lg:text-[20px] xl:text-[21px] font-extrabold whitespace-nowrap"><span class="brand-a"><?= e($brandPartA) ?></span><?php if ($brandPartB !== ''): ?> <span class="brand-b"><?= e($brandPartB) ?></span><?php endif; ?></span><span class="brand-tagline" data-i18n="brand.tagline"><?= e($brandTagline) ?></span></span>
                </a>

                <nav class="nav-desk hidden lg:flex items-center gap-6 xl:gap-8 mx-auto">
<?php $activeNavKey = $pageKey; ?>
<?php foreach ($navItems as $item): $active = ($activeNavKey === $item['key']); ?>
                    <a href="<?= e($item['href']) ?>" data-nav="<?= e($item['key']) ?>"<?= $active ? ' aria-current="page"' : '' ?> class="nav-link nav-underline<?= $active ? ' is-active' : '' ?> text-[13.5px] xl:text-[14px] font-medium tracking-normal"><span data-i18n="<?= e($item['i18n']) ?>"><?= e($item['label']) ?></span></a>
<?php endforeach; ?>
                </nav>

                <a class="header-service-button" href="service.php" aria-label="Our Services"><span class="header-service-button-full" data-i18n="header.ourServices">Our Services</span><span class="header-service-button-short" data-i18n="nav.service">Service</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>

                <button type="button" id="header-menu-toggle" onclick="toggleMobileMenu()" aria-controls="mobile-menu-drawer" aria-expanded="false" aria-label="Open menu" class="hdr-burger lg:hidden flex flex-col items-end justify-center gap-[6px] flex-shrink-0">
                    <span class="hdr-bar"></span>
                    <span class="hdr-bar"></span>
                    <span class="hdr-bar"></span>
                </button>
            </div>
        </header>
        <div class="header-spacer lg:hidden"></div>
        <div class="header-spacer hidden lg:block"></div>

        <div id="mobile-menu" class="fixed inset-0 z-[9999] lg:hidden pointer-events-none mm-root" style="top: 0; height: 100dvh;">
            <div id="mobile-menu-backdrop" class="mm-backdrop absolute inset-0 opacity-0 transition-opacity duration-300"></div>
            <div id="mobile-menu-drawer" class="mm-drawer absolute top-0 left-0 right-0 bg-white flex flex-col transform -translate-y-full transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)] overscroll-contain">
                <div class="mm-heading">
                    <a href="index.php" class="mm-heading-brand" aria-label="<?= e($siteName . ' — ' . $brandTagline) ?>">
                        <span class="mm-heading-mark" aria-hidden="true"><svg viewBox="0 0 120 100"><path d="M 17 89 L 25 11 L 47 11 L 64 43 L 91 11 L 112 11 L 104 89 L 81 89 L 85 51 L 62 78 L 41 50 L 37 89 Z" fill="#1152df"/><path d="M 2 31 H 18 M 0 47 H 16 M 3 63 H 18" fill="none" stroke="#49B8FF" stroke-width="4" stroke-linecap="round"/></svg></span>
                        <span class="mm-heading-name"><?= e($siteName) ?></span>
                    </a>
                    <button type="button" id="mobile-menu-close" class="ref-menu-close" aria-label="Close menu"><span aria-hidden="true">&times;</span></button>
                </div>
                <nav class="mm-nav" aria-label="Mobile navigation">
<?php foreach ($navItems as $item): $active = ($pageKey === $item['key']); ?>
                    <a href="<?= e($item['href']) ?>" data-nav="<?= e($item['key']) ?>"<?= $active ? ' aria-current="page"' : '' ?> class="mobile-nav-item mm-item<?= $active ? ' is-active' : '' ?>"><span class="mm-label" data-i18n="<?= e($item['i18n']) ?>"><?= e($item['label']) ?></span><span class="mm-chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></span></a>
<?php endforeach; ?>
                    <a href="service.php" class="mm-action-button">
                        <span class="mm-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 20.5 4l2 6.5L5 16z"/><path d="M7.5 17.5V21h4"/><path d="m9 8 4 3M14 6.8l4 3"/></svg></span>
                        <span class="mm-action-label" data-i18n="header.ourServices">Our Services</span>
                        <span class="mm-action-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12 6l6 6-6 6"/></svg></span>
                    </a>
                </nav>
            </div>
        </div>
