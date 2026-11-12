<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'review';
$pageTitle = 'Review | ' . setting('site_name', 'Mexa Motion');
$pageDescription = setting('review_hero_desc', 'Honest feedback from creators, shops and brands we edit for.');
$pageScripts = ['assets/js/page-review.js'];

$revBundle = get_reviews_bundle(true);
$initialReviews = array_slice($revBundle['items'], 0, 20);
$stats = $revBundle['stats'];
$heroImg = setting('review_hero_file_path', 'assets/images/review-hero.jpg');

include dirname(__DIR__) . '/includes/header.php';
?>
        <div class="rvx-wrap">
            <section class="rvx-hero" id="rvx-hero">
                <figure class="rvx-hero-media">
                    <img id="rvx-featured-img" src="<?= e($heroImg) ?>" alt="Inside the Mexa Motion editing suite" decoding="async" fetchpriority="high" loading="lazy">
                </figure>

                <div class="rvx-hero-main">
                    <h1 id="rvx-heading" class="mh-line2"><?= e(setting('review_heading', 'Client Reviews')) ?></h1>
                    <p id="rvx-desc" class="mh-desc"><?= e(setting('review_hero_desc', '')) ?></p>

                    <div class="rvx-score-row">
                        <div class="rvx-score"><b id="rvx-avg"><?= e(number_format((float) $stats['average'], 1)) ?></b><span>/ 5</span></div>
                        <div class="rvx-score-meta">
                            <div class="rvx-stars" id="rvx-hero-stars" aria-hidden="true"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></div>
                            <small id="rvx-meta">Based on <?= (int) $stats['count'] ?> verified reviews</small>
                        </div>
                        <span class="rvx-score-sep" aria-hidden="true"></span>
                        <div class="rvx-score-stat"><b id="rvx-five"><?= (int) $stats['five'] ?></b><span>five-star</span></div>
                        <span class="rvx-score-sep" aria-hidden="true"></span>
                        <div class="rvx-score-stat"><b id="rvx-count-hero"><?= (int) $stats['count'] ?></b><span>reviews</span></div>
                    </div>

                    <div class="rvx-hero-actions">
                        <a href="<?= chr(35) ?>rvx-write" class="rvx-btn rvx-btn-primary"><i class="fa-solid fa-pen"></i> Write a review</a>
                    </div>
                </div>
            </section>

            <hr class="rvx-rule" aria-hidden="true">

            <section class="rvx-list" id="rvx-list">
                <div class="rvx-list-head">
                    <div>
                        <h2>Recent client reviews</h2>
                        <p>Newest first · written by clients after delivery</p>
                    </div>
                    <span class="rvx-count" id="rvx-count"><?= (int) $stats['count'] ?> reviews</span>
                </div>

                <div class="rvx-grid" id="rvx-grid">
<?php foreach ($initialReviews as $r):
    $rWords = preg_split('/\s+/', trim($r['name'])) ?: ['?'];
    $rIni = mb_strtoupper(mb_substr($rWords[0] ?? '?', 0, 1) . mb_substr($rWords[1] ?? '', 0, 1));
    $rStars = max(1, min(5, (int) $r['rating']));
?>
                    <article class="rvx-card">
                        <div class="rvx-card-top">
<?php if ($r['file_path'] !== ''): ?>
                            <span class="rvx-avatar"><img src="<?= e($r['file_path']) ?>" alt="<?= e($r['name']) ?>" loading="lazy"></span>
<?php else: ?>
                            <span class="rvx-avatar" aria-hidden="true"><?= e($rIni) ?></span>
<?php endif; ?>
                            <div class="rvx-card-id">
                                <b><?= e($r['name']) ?></b>
<?php if ($r['role'] !== ''): ?>
                                <small><?= e($r['role']) ?></small>
<?php endif; ?>
                            </div>
                            <span class="rvx-stars" aria-label="<?= $rStars ?> out of 5"><?php for ($si = 1; $si <= 5; $si++): ?><i class="fa-solid fa-star<?= $si > $rStars ? ' off' : '' ?>"></i><?php endfor; ?></span>
                        </div>
                        <p class="rvx-card-text"><?= e($r['body']) ?></p>
                    </article>
<?php endforeach; ?>
                </div>

                <div class="rvx-more" id="rvx-more-wrap"<?= $stats['count'] <= 20 ? ' hidden' : '' ?>>
                    <button type="button" class="rvx-btn rvx-btn-ghost" id="rvx-more">
                        See more reviews <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <small id="rvx-more-note"><?= count($initialReviews) ?> of <?= (int) $stats['count'] ?> shown · <?= max(0, (int) $stats['count'] - count($initialReviews)) ?> more</small>
                </div>
            </section>

            <section class="rvx-write" id="rvx-write">
                <div class="rvx-form-head">
                    <div>
                        <h2>Write a review</h2>
                        <p>Worked with us? Tell people what you worked on, how the process felt and what stood out. Reviews appear publicly after our team approves them.</p>
                    </div>
                    <span class="rvx-pending-note"><i class="fa-solid fa-clock"></i> Reviewed before publishing</span>
                </div>

                <form class="rvx-form" id="rvx-form" novalidate>
                    <?= csrf_field() ?>
                    <?= honeypot_field() ?>
                    <div class="rvx-form-card rvx-fcard">
                        <div class="rvx-field">
                            <label>Your rating <span aria-hidden="true">*</span></label>
                            <div class="rvx-rate-wrap">
                                <div class="rvx-rate" id="rvx-rate" role="radiogroup" aria-label="Rating" aria-required="true">
                                    <button type="button" role="radio" aria-checked="false" tabindex="0" data-star="1" aria-label="1 star"><i class="fa-solid fa-star"></i></button>
                                    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-star="2" aria-label="2 stars"><i class="fa-solid fa-star"></i></button>
                                    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-star="3" aria-label="3 stars"><i class="fa-solid fa-star"></i></button>
                                    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-star="4" aria-label="4 stars"><i class="fa-solid fa-star"></i></button>
                                    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-star="5" aria-label="5 stars"><i class="fa-solid fa-star"></i></button>
                                </div>
                                <span class="rvx-rate-label" id="rvx-rate-label">Choose a rating</span>
                            </div>
                        </div>

                        <div class="rvx-form-row">
                            <div class="rvx-field">
                                <label for="rvx-name">Your name <span aria-hidden="true">*</span></label>
                                <input class="rvx-input" type="text" id="rvx-name" name="name" maxlength="60" autocomplete="name" required>
                            </div>
                            <div class="rvx-field">
                                <label for="rvx-role">Your title <span style="color:<?= chr(35) ?>7C96B8;font-weight:600">(optional)</span></label>
                                <input class="rvx-input" type="text" id="rvx-role" name="role" maxlength="60" autocomplete="organization-title">
                            </div>
                        </div>

                        <div class="rvx-field">
                            <div class="rvx-photo-box">
                                <div class="rvx-photo-prev" id="rvx-photo-prev" aria-live="polite"><i class="fa-solid fa-user"></i></div>
                                <div>
                                    <div class="rvx-photo-actions">
                                        <button type="button" class="rvx-mini-btn" id="rvx-photo-pick"><i class="fa-solid fa-arrow-up-from-bracket"></i> Upload photo</button>
                                        <button type="button" class="rvx-mini-btn" id="rvx-photo-change" hidden><i class="fa-solid fa-rotate"></i> Change</button>
                                        <button type="button" class="rvx-mini-btn is-danger" id="rvx-photo-remove" hidden><i class="fa-solid fa-xmark"></i> Remove</button>
                                    </div>
                                </div>
                                <input class="rvx-hidden-file" type="file" id="rvx-photo" name="photo" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="Choose a profile photo">
                            </div>
                        </div>
                    </div>

                    <div class="rvx-form-card rvx-fcard">
                        <div class="rvx-field">
                            <label for="rvx-body">Your review <span aria-hidden="true">*</span></label>
                            <textarea class="rvx-textarea" id="rvx-body" name="body" maxlength="900" required></textarea>
                            <span class="rvx-counter" id="rvx-body-count">0 / 900</span>
                        </div>

                        <span class="rvx-err" id="rvx-err" role="alert" aria-live="polite" hidden></span>

                        <div class="rvx-form-foot">
                            <p class="rvx-form-note">Only approved reviews appear publicly. Submissions are stored as <b>pending</b> and go live after an admin approves them.</p>
                            <button type="submit" class="rvx-btn rvx-btn-primary rvx-submit" id="rvx-send">
                                <i class="fa-solid fa-paper-plane"></i> Submit review
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        </div>

        <div class="rvx-modal" id="rvx-modal" hidden>
            <div class="rvx-modal-bd" data-rvx-close="1"></div>
            <div class="rvx-modal-box" role="dialog" aria-modal="true" aria-labelledby="rvx-modal-title">
                <div class="rvx-modal-tick"><i class="fa-solid fa-check"></i></div>
                <h3 id="rvx-modal-title">Thanks, <span id="rvx-modal-name">there</span>!</h3>
                <p>Your review has been received and is now <b>pending approval</b>. Our team reads every submission before it appears on this page.</p>
                <span class="rvx-modal-tag"><i class="fa-solid fa-clock"></i> Pending approval</span>
                <button type="button" data-rvx-close="1" id="rvx-modal-done">Done</button>
            </div>
        </div>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
