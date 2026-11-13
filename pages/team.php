<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'team';
$pageTitle = 'Team | ' . setting('site_name', 'Mexa Motion');
$pageDescription = setting('team_intro', 'Meet the editors, designers, and motion artists behind Mexa Motion.');
$pageScripts = ['assets/js/page-team.js?v=20261112-skill-limit2'];

$teamBundle = get_team_bundle();
$members = $teamBundle['members'];
$founder = null;
$specialists = [];
foreach ($members as $m) {
    if ($founder === null && ((int) $m['is_founder'] === 1 || stripos($m['role'], 'founder') !== false)) {
        $founder = $m;
    } else {
        $specialists[] = $m;
    }
}

include dirname(__DIR__) . '/includes/header.php';
?>
<main class="t3-page" id="team-page">
    <section class="t3-founder-sec">
        <div class="container mx-auto px-4 md:px-8">
            <div class="t3-sec-head mh-head">
                <h1 class="mh-line2">The people behind every edit</h1>
                <p class="mh-desc" id="t3-intro"><?= e($teamBundle['intro']) ?></p>
            </div>

<?php if ($founder !== null): ?>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-6xl mx-auto mx-founder-card" id="t3-founder">
                <div class="tm-founder-photo">
                    <img src="<?= e($founder['file_path']) ?>" alt="<?= e($founder['name']) ?> portrait" loading="lazy" decoding="async">
                </div>
                <div class="t3-founder-info">
                    <h2 class="tm-founder-name"><?= e($founder['name']) ?></h2>
                    <p class="tm-founder-role"><?= e($founder['role']) ?></p>
                    <p class="tm-founder-bio"><?= e($founder['bio'] !== '' ? $founder['bio'] : $founder['description']) ?></p>
<?php if (!empty($founder['skills'])): ?>
                    <div class="t3-block t3-founder-keywords">
                        <span class="t3-block-label">Skill keywords</span>
                        <ul class="t3-chips">
<?php foreach (array_slice($founder['skills'], 0, TEAM_SKILL_LIMIT) as $sk): ?>
                            <li><?= e($sk) ?></li>
<?php endforeach; ?>
                        </ul>
                    </div>
<?php endif; ?>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
                        <div class="tm-perk">
                            <span class="tm-perk-ic"><i class="fa-regular fa-user"></i></span>
                            <div>
                                <p class="tm-perk-title"><?= e(setting('founder_perk_1_title', '6+ Years Exp.')) ?></p>
                                <p class="tm-perk-text"><?= e(setting('founder_perk_1_text', 'Industry Veteran')) ?></p>
                            </div>
                        </div>
                        <div class="tm-perk">
                            <span class="tm-perk-ic"><i class="fa-solid fa-shield-halved"></i></span>
                            <div>
                                <p class="tm-perk-title"><?= e(setting('founder_perk_2_title', 'Certified Pro')) ?></p>
                                <p class="tm-perk-text"><?= e(setting('founder_perk_2_text', 'Adobe Workflow Expert')) ?></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
<?php endif; ?>
        </div>
    </section>

    <section class="t3-members-sec">
        <div class="container mx-auto px-4 md:px-8">
            <div class="t3-members-head">
                <div>
                    <span class="t3-kick">Team Members</span>
                    <h2 class="t3-h2">Specialists in every step of the pipeline</h2>
                </div>
                <p class="t3-sub" id="t3-count"><?= count($members) ?> people · founder + <?= count($specialists) ?> specialists</p>
            </div>
            <div class="t3-grid" id="t3-grid">
<?php foreach ($specialists as $sp): ?>
                <article class="t3-card" data-member-id="<?= (int) $sp['id'] ?>">
                    <div class="t3-media">
<?php if ($sp['file_path'] !== ''): ?>
                        <img src="<?= e($sp['file_path']) ?>" alt="<?= e($sp['name'] . ' — ' . $sp['role']) ?>" loading="lazy" decoding="async">
<?php else: ?>
                        <span class="t3-initials" aria-hidden="true"><?= e(mb_strtoupper(mb_substr($sp['name'], 0, 2))) ?></span>
<?php endif; ?>
                    </div>
                    <div class="t3-body">
                        <h3 class="t3-name"><?= e($sp['name']) ?></h3>
                        <p class="t3-role"><?= e($sp['role']) ?></p>
<?php if ($sp['description'] !== '' || $sp['bio'] !== ''): ?>
                        <p class="t3-desc"><?= e($sp['description'] !== '' ? $sp['description'] : $sp['bio']) ?></p>
<?php endif; ?>
<?php if (!empty($sp['skills'])): ?>
                        <div class="t3-block t3-skills">
                            <span class="t3-block-label">Skills &amp; expertise</span>
                            <ul class="t3-chips">
<?php foreach (array_slice($sp['skills'], 0, TEAM_SKILL_LIMIT) as $sk): ?>
                                <li><?= e($sk) ?></li>
<?php endforeach; ?>
                            </ul>
                        </div>
<?php endif; ?>
                    </div>
                </article>
<?php endforeach; ?>
            </div>
        </div>
    </section>

    <section class="container mx-auto px-4 md:px-8">
        <div class="t3-join">
            <div>
                <b><?= e(setting('team_join_title', 'Want to work with us?')) ?></b>
                <p><?= e(setting('team_join_text', 'Send your portfolio — we hire editors and designers from time to time.')) ?></p>
            </div>
            <a href="service.php">See our services</a>
        </div>
    </section>
</main>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
