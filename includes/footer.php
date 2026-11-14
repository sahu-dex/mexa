<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

$pageKey = $pageKey ?? 'home';
$pageScripts = $pageScripts ?? [];
$hashPlaceholder = chr(35);

$footerLogo = setting('footer_logo_file_path', 'assets/images/footer-logo.png');
$footerDesc = setting('footer_description', 'Elevating brands through premium video editing and motion graphics. Your vision, expertly crafted.');
$footerCopy = setting('footer_copyright', '© 2026 Mexa Motion. All rights reserved.');
$newsHeading = setting('newsletter_heading', 'Newsletter');
$newsText = setting('newsletter_text', 'Subscribe to get the latest editing tips and special offers.');

$fbUrl = setting_raw('social_facebook', '');
$tgUrl = setting_raw('social_telegram', '') ?: setting_raw('telegram_url', '');
$waRaw = preg_replace('/[^\d]/', '', setting_raw('social_whatsapp', '') ?: setting_raw('whatsapp_number', ''));
$waUrl = $waRaw !== '' ? 'https://wa.me/' . $waRaw : '';
$ytUrl = setting_raw('social_youtube', '');

$footerServices = db()->query('SELECT `id`, `name` FROM `services` WHERE `is_active` = 1 ORDER BY `sort_order` ASC, `id` ASC LIMIT 5')->fetchAll();
$clientPayload = build_page_payload($pageKey);
$accentHex = chr(35) . '1051DF';
?>
        <div id="custom-msg-box" class="fixed bottom-10 right-10 apple-glass-card border-l-4 border-primary rounded-r-xl p-4 transform translate-x-[200%] transition-transform duration-300 z-[9999] flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-green-100 text-green-500 flex items-center justify-center">
                <i class="fa-solid fa-check"></i>
            </div>
            <p id="custom-msg-text" class="text-secondary font-medium text-sm"></p>
        </div>

        <footer class="text-slate-600 pt-20 pb-10 border-t border-slate-200/50 bg-transparent">
            <div class="container mx-auto px-4 md:px-8">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
                    <div>
                        <a href="index.php" class="flex items-center gap-2 mb-6 group">
                            <span class="footer-brand-word text-2xl font-extrabold tracking-tight transition" aria-label="<?= e(strtoupper(setting('site_name', 'Mexa Motion'))) ?>" title="<?= e(strtoupper(setting('site_name', 'Mexa Motion'))) ?>"><?= e(strtoupper(setting('site_name', 'Mexa Motion'))) ?></span>
                        </a>
                        <p class="text-sm text-slate-500 mb-6 leading-relaxed"><?= e($footerDesc) ?></p>
                        <div class="flex gap-3">
                            <a href="<?= e($fbUrl ?: $hashPlaceholder) ?>"<?= $fbUrl !== '' ? ' target="_blank" rel="noopener"' : '' ?> aria-label="Facebook" class="w-10 h-10 rounded-full apple-glass-card flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all text-sm"><i class="fa-brands fa-facebook-f"></i></a>
                            <a href="<?= e($tgUrl ?: $hashPlaceholder) ?>"<?= $tgUrl !== '' ? ' target="_blank" rel="noopener"' : '' ?> aria-label="Telegram" class="w-10 h-10 rounded-full apple-glass-card flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all text-sm"><i class="fa-brands fa-telegram"></i></a>
                            <a href="<?= e($waUrl ?: $hashPlaceholder) ?>"<?= $waUrl !== '' ? ' target="_blank" rel="noopener"' : '' ?> aria-label="WhatsApp" class="w-10 h-10 rounded-full apple-glass-card flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all text-sm"><i class="fa-brands fa-whatsapp"></i></a>
                            <a href="<?= e($ytUrl ?: $hashPlaceholder) ?>"<?= $ytUrl !== '' ? ' target="_blank" rel="noopener"' : '' ?> aria-label="YouTube" class="w-10 h-10 rounded-full apple-glass-card flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all text-sm"><i class="fa-brands fa-youtube"></i></a>
                        </div>
                    </div>

                    <div>
                        <h4 class="text-secondary font-bold mb-6">Quick Links</h4>
                        <ul class="space-y-3">
                            <li><a href="index.php" class="text-sm hover:text-primary transition-colors flex items-center gap-2"><i class="fa-solid fa-angle-right text-xs" style="color: <?= $accentHex ?>;"></i> Home</a></li>
                            <li><a href="service.php" class="text-sm hover:text-primary transition-colors flex items-center gap-2"><i class="fa-solid fa-angle-right text-xs" style="color: <?= $accentHex ?>;"></i> Service</a></li>
                            <li><a href="work.php" class="text-sm hover:text-primary transition-colors flex items-center gap-2"><i class="fa-solid fa-angle-right text-xs" style="color: <?= $accentHex ?>;"></i> Work</a></li>
                            <li><a href="review.php" class="text-sm hover:text-primary transition-colors flex items-center gap-2"><i class="fa-solid fa-angle-right text-xs" style="color: <?= $accentHex ?>;"></i> Review</a></li>
                            <li><a href="team.php" class="text-sm hover:text-primary transition-colors flex items-center gap-2"><i class="fa-solid fa-angle-right text-xs" style="color: <?= $accentHex ?>;"></i> Team</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 class="text-secondary font-bold mb-6">Services</h4>
                        <ul class="space-y-3">
<?php foreach ($footerServices as $fSvc): ?>
                            <li><a href="service.php<?= chr(35) ?>svc-<?= (int) $fSvc['id'] ?>" class="text-sm hover:text-primary transition-colors flex items-center gap-2"><i class="fa-solid fa-angle-right text-xs" style="color: <?= $accentHex ?>;"></i> <?= e($fSvc['name']) ?></a></li>
<?php endforeach; ?>
                        </ul>
                    </div>

                    <div>
                        <h4 class="text-secondary font-bold mb-6"><?= e($newsHeading) ?></h4>
                        <p class="text-sm text-slate-500 mb-4"><?= e($newsText) ?></p>
                        <form id="newsletter-form" onsubmit="event.preventDefault(); if (window.handleNewsletterSubscribe) { window.handleNewsletterSubscribe(this); }" class="newsletter-form">
                            <?= csrf_field() ?>
                            <?= honeypot_field() ?>
                            <input type="email" name="email" required placeholder="Your email address" aria-label="Your email address" class="newsletter-input apple-glass-card">
                            <button type="submit" class="newsletter-btn glass-btn-primary">Subscribe</button>
                        </form>
                    </div>
                </div>

                <div class="border-t border-slate-200/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p class="text-sm text-slate-500"><?= e($footerCopy) ?></p>
                    <div class="flex gap-6 text-sm text-slate-500">
                        <a href="privacy.php" class="hover:text-primary transition-colors">Privacy Policy</a>
                        <a href="terms.php" class="hover:text-primary transition-colors">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    </div>

    <script>
        window.__MM_DEMO_DATA__ = <?= json_encode($clientPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.__MM_SHOWREEL_URL__ = <?= json_encode(setting_raw('showreel_video_url', ''), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.__MM_TAGLINE__ = <?= json_encode(setting('brand_tagline', 'Video Editing Agency'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    </script>
    <script src="assets/js/vendor-aos.js"></script>
    <script src="assets/js/video-player.js?v=20261114-autohide-fix"></script>
    <script src="assets/js/site-common.js?v=20261114-shared-player"></script>
<?php foreach ($pageScripts as $jsSrc): ?>
    <script src="<?= e($jsSrc) ?>"></script>
<?php endforeach; ?>
</body>
</html>
