<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

$pwdNotice = '';
$pwdError = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['form_kind'] ?? '') === 'change_password') {
    require_admin(false);
    require_csrf(false);
    $adm = current_admin();
    $currentPwd = (string) ($_POST['current_password'] ?? '');
    $newPwd = (string) ($_POST['new_password'] ?? '');
    $confirmPwd = (string) ($_POST['confirm_password'] ?? '');

    $stmt = db()->prepare('SELECT `password_hash` FROM `admins` WHERE `id` = :id LIMIT 1');
    $stmt->execute([':id' => (int) ($adm['id'] ?? 0)]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($currentPwd, (string) $row['password_hash'])) {
        $pwdError = 'Current password is incorrect.';
    } elseif (strlen($newPwd) < 10) {
        $pwdError = 'New password must be at least 10 characters.';
    } elseif (!hash_equals($newPwd, $confirmPwd)) {
        $pwdError = 'New password confirmation does not match.';
    } else {
        $upd = db()->prepare('UPDATE `admins` SET `password_hash` = :h WHERE `id` = :id');
        $upd->execute([
            ':h' => password_hash($newPwd, PASSWORD_DEFAULT),
            ':id' => (int) $adm['id'],
        ]);
        session_regenerate_id(true);
        $pwdNotice = 'Administrator password updated.';
    }
}

$adminPage = 'settings';
$adminTitle = 'Site & Page Settings';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$s = settings();
?>
<div class="adm-tabs">
    <button type="button" class="adm-tab is-active" data-tab-target="general">Brand, Contact &amp; Socials</button>
    <button type="button" class="adm-tab" data-tab-target="home">Homepage Hero, Stats, About &amp; FAQ</button>
    <button type="button" class="adm-tab" data-tab-target="pages">Inner Page Headings &amp; Media</button>
    <button type="button" class="adm-tab" data-tab-target="security">Admin Password</button>
</div>

<?php if ($pwdNotice !== ''): ?>
<div class="adm-alert adm-alert-ok"><?= e($pwdNotice) ?></div>
<?php endif; ?>
<?php if ($pwdError !== ''): ?>
<div class="adm-alert adm-alert-err"><?= e($pwdError) ?></div>
<?php endif; ?>

<form data-adm-api="../api/admin/settings.php" enctype="multipart/form-data">
    <div data-tab-pane="general">
        <div class="adm-card">
            <div class="adm-card-head">
                <div>
                    <h2>Brand Identity, Contact Channels &amp; Email Alerts</h2>
                    <p>Changes here immediately update the header, footer, and admin email notifications.</p>
                </div>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save All Settings</button>
            </div>

            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Site Name</label>
                    <input class="adm-input" type="text" name="settings[site_name]" value="<?= e($s['site_name'] ?? 'Mexa Motion') ?>">
                </div>
                <div class="adm-field">
                    <label>Header Tagline</label>
                    <input class="adm-input" type="text" name="settings[site_tagline]" value="<?= e($s['site_tagline'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Admin Notification Email (Contact)</label>
                    <input class="adm-input" type="email" name="settings[notification_email]" value="<?= e($s['notification_email'] ?? '') ?>">
                </div>
            </div>

            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Public Contact Email</label>
                    <input class="adm-input" type="email" name="settings[contact_email]" value="<?= e($s['contact_email'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Phone Number</label>
                    <input class="adm-input" type="text" name="settings[contact_phone]" value="<?= e($s['contact_phone'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>WhatsApp URL</label>
                    <input class="adm-input" type="text" name="settings[contact_whatsapp]" value="<?= e($s['contact_whatsapp'] ?? '') ?>">
                </div>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Studio Location</label>
                    <input class="adm-input" type="text" name="settings[contact_address]" value="<?= e($s['contact_address'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Footer Copyright Notice</label>
                    <input class="adm-input" type="text" name="settings[copyright_text]" value="<?= e($s['copyright_text'] ?? '') ?>">
                </div>
            </div>

            <div class="adm-field">
                <label>Footer Studio Bio</label>
                <textarea class="adm-textarea" name="settings[footer_bio]"><?= e($s['footer_bio'] ?? '') ?></textarea>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Facebook URL</label>
                    <input class="adm-input" type="text" name="settings[social_facebook]" value="<?= e($s['social_facebook'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Instagram URL</label>
                    <input class="adm-input" type="text" name="settings[social_instagram]" value="<?= e($s['social_instagram'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>YouTube URL</label>
                    <input class="adm-input" type="text" name="settings[social_youtube]" value="<?= e($s['social_youtube'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>LinkedIn URL</label>
                    <input class="adm-input" type="text" name="settings[social_linkedin]" value="<?= e($s['social_linkedin'] ?? '') ?>">
                </div>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Upload New Favicon (JPG/PNG/WebP)</label>
                    <input class="adm-input" type="file" name="upload_favicon" accept="image/jpeg,image/png,image/webp">
                    <small style="color:<?= chr(35) ?>94a3b8">Current: <?= e($s['favicon_file_path'] ?? '') ?></small>
                </div>
                <div class="adm-field">
                    <label>Upload New Footer Logo (JPG/PNG/WebP)</label>
                    <input class="adm-input" type="file" name="upload_footer_logo" accept="image/jpeg,image/png,image/webp">
                    <small style="color:<?= chr(35) ?>94a3b8">Current: <?= e($s['footer_logo_file_path'] ?? '') ?></small>
                </div>
            </div>
        </div>
    </div>

    <div data-tab-pane="home" hidden>
        <div class="adm-card">
            <div class="adm-card-head">
                <div>
                    <h2>Homepage Hero, Stats, About Studio &amp; FAQ</h2>
                    <p>Every headline, counter, studio photo, and FAQ item on `index.php`.</p>
                </div>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save All Settings</button>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Hero Line 1</label>
                    <input class="adm-input" type="text" name="settings[hero_line_1]" value="<?= e($s['hero_line_1'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Hero Line 2 (Accent)</label>
                    <input class="adm-input" type="text" name="settings[hero_line_2]" value="<?= e($s['hero_line_2'] ?? '') ?>">
                </div>
            </div>
            <div class="adm-field">
                <label>Hero Subtitle</label>
                <textarea class="adm-textarea" name="settings[hero_subtitle]"><?= e($s['hero_subtitle'] ?? '') ?></textarea>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Hero Showreel `file_path` or Video URL</label>
                    <input class="adm-input" type="text" name="settings[hero_showreel_file_path]" value="<?= e($s['hero_showreel_file_path'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Or Upload Showreel Video (MP4/WebM)</label>
                    <input class="adm-input" type="file" name="upload_showreel_video" accept="video/mp4,video/webm,video/quicktime">
                </div>
            </div>
            <div class="adm-field">
                <label>Upload New Hero Character Artwork</label>
                <input class="adm-input" type="file" name="upload_hero_character" accept="image/jpeg,image/png,image/webp">
                <small style="color:<?= chr(35) ?>94a3b8">Current: <?= e($s['hero_character_file_path'] ?? '') ?></small>
            </div>

            <div class="adm-grid-2">
<?php for ($i = 1; $i <= 4; $i++): ?>
                <div class="adm-field">
                    <label>Stat <?= $i ?> Value &amp; Label</label>
                    <div class="adm-grid-2">
                        <input class="adm-input" type="text" name="settings[stat_<?= $i ?>_value]" value="<?= e($s["stat_{$i}_value"] ?? '') ?>">
                        <input class="adm-input" type="text" name="settings[stat_<?= $i ?>_label]" value="<?= e($s["stat_{$i}_label"] ?? '') ?>">
                    </div>
                </div>
<?php endfor; ?>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>About Heading Prefix</label>
                    <input class="adm-input" type="text" name="settings[about_heading]" value="<?= e($s['about_heading'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>About Heading Accent</label>
                    <input class="adm-input" type="text" name="settings[about_heading_accent]" value="<?= e($s['about_heading_accent'] ?? '') ?>">
                </div>
            </div>
            <div class="adm-field">
                <label>About Paragraph 1</label>
                <textarea class="adm-textarea" name="settings[about_paragraph_1]"><?= e($s['about_paragraph_1'] ?? '') ?></textarea>
            </div>
            <div class="adm-field">
                <label>About Paragraph 2</label>
                <textarea class="adm-textarea" name="settings[about_paragraph_2]"><?= e($s['about_paragraph_2'] ?? '') ?></textarea>
            </div>
            <div class="adm-grid-2">
<?php for ($p = 1; $p <= 4; $p++): ?>
                <div class="adm-field">
                    <label>Upload About Collage Photo <?= $p ?></label>
                    <input class="adm-input" type="file" name="upload_about_photo_<?= $p ?>" accept="image/jpeg,image/png,image/webp">
                    <small style="color:<?= chr(35) ?>94a3b8">Current: <?= e($s["about_photo_{$p}_file_path"] ?? '') ?></small>
                </div>
<?php endfor; ?>
            </div>

<?php for ($fq = 1; $fq <= 5; $fq++): ?>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>FAQ <?= $fq ?> Question</label>
                    <input class="adm-input" type="text" name="settings[faq_<?= $fq ?>_q]" value="<?= e($s["faq_{$fq}_q"] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>FAQ <?= $fq ?> Answer</label>
                    <textarea class="adm-textarea" name="settings[faq_<?= $fq ?>_a]" style="min-height:60px"><?= e($s["faq_{$fq}_a"] ?? '') ?></textarea>
                </div>
            </div>
<?php endfor; ?>
        </div>
    </div>

    <div data-tab-pane="pages" hidden>
        <div class="adm-card">
            <div class="adm-card-head">
                <div>
                    <h2>Service, Work, Review &amp; Team Page Copy</h2>
                    <p>Customize the hero headings, intros, and featured banner imagery across all inner pages.</p>
                </div>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save All Settings</button>
            </div>

            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Services Page Heading</label>
                    <input class="adm-input" type="text" name="settings[services_heading]" value="<?= e($s['services_heading'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Services Page Subtitle</label>
                    <input class="adm-input" type="text" name="settings[services_subtitle]" value="<?= e($s['services_subtitle'] ?? '') ?>">
                </div>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Work Page Heading</label>
                    <input class="adm-input" type="text" name="settings[work_heading]" value="<?= e($s['work_heading'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Work Page Intro</label>
                    <input class="adm-input" type="text" name="settings[work_intro]" value="<?= e($s['work_intro'] ?? '') ?>">
                </div>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Review Page Heading</label>
                    <input class="adm-input" type="text" name="settings[review_heading]" value="<?= e($s['review_heading'] ?? '') ?>">
                </div>
                <div class="adm-field">
                    <label>Upload Review Hero Studio Image</label>
                    <input class="adm-input" type="file" name="upload_review_hero" accept="image/jpeg,image/png,image/webp">
                    <small style="color:<?= chr(35) ?>94a3b8">Current: <?= e($s['review_hero_file_path'] ?? '') ?></small>
                </div>
            </div>
            <div class="adm-field">
                <label>Review Page Hero Description</label>
                <textarea class="adm-textarea" name="settings[review_hero_desc]"><?= e($s['review_hero_desc'] ?? '') ?></textarea>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Team Page Kicker</label>
                    <input class="adm-input" type="text" name="settings[team_heading]" value="<?= e($s['team_heading'] ?? '') ?>">
                </div>
            </div>
            <div class="adm-field">
                <label>Team Page Intro</label>
                <textarea class="adm-textarea" name="settings[team_intro]"><?= e($s['team_intro'] ?? '') ?></textarea>
            </div>
        </div>
    </div>
</form>

<div data-tab-pane="security" hidden>
    <div class="adm-card" style="max-width:540px">
        <div class="adm-card-head">
            <div>
                <h2>Change Administrator Password</h2>
                <p>Uses bcrypt/Argon2 `password_hash()` and regenerates your session ID.</p>
            </div>
        </div>
        <form method="post" action="settings.php" autocomplete="off">
            <?= csrf_field() ?>
            <input type="hidden" name="form_kind" value="change_password">
            <div class="adm-field">
                <label>Current Password *</label>
                <input class="adm-input" type="password" name="current_password" required>
            </div>
            <div class="adm-field">
                <label>New Password (minimum 10 characters) *</label>
                <input class="adm-input" type="password" name="new_password" required minlength="10">
            </div>
            <div class="adm-field">
                <label>Confirm New Password *</label>
                <input class="adm-input" type="password" name="confirm_password" required minlength="10">
            </div>
            <button type="submit" class="adm-btn adm-btn-primary">Update Password</button>
        </form>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
