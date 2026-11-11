<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_admin(true);
require_csrf(true);

$fields = $_POST['settings'] ?? [];
if (!is_array($fields)) {
    $fields = [];
}

$mediaUploads = [
    'upload_hero_character' => ['key' => 'hero_character_file_path', 'type' => 'image', 'group' => 'hero'],
    'upload_favicon' => ['key' => 'favicon_file_path', 'type' => 'image', 'group' => 'general'],
    'upload_footer_logo' => ['key' => 'footer_logo_file_path', 'type' => 'image', 'group' => 'footer'],
    'upload_review_hero' => ['key' => 'review_hero_file_path', 'type' => 'image', 'group' => 'review'],
    'upload_about_photo_1' => ['key' => 'about_photo_1_file_path', 'type' => 'image', 'group' => 'about'],
    'upload_about_photo_2' => ['key' => 'about_photo_2_file_path', 'type' => 'image', 'group' => 'about'],
    'upload_about_photo_3' => ['key' => 'about_photo_3_file_path', 'type' => 'image', 'group' => 'about'],
    'upload_about_photo_4' => ['key' => 'about_photo_4_file_path', 'type' => 'image', 'group' => 'about'],
    'upload_showreel_video' => ['key' => 'hero_showreel_file_path', 'type' => 'video', 'group' => 'hero'],
];

foreach ($mediaUploads as $inputName => $meta) {
    if (!empty($_FILES[$inputName]) && (int) ($_FILES[$inputName]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $up = upload_media($_FILES[$inputName], $meta['type']);
        if (!$up['ok']) {
            json_response(['ok' => false, 'error' => $up['error']], 422);
        }
        $old = setting($meta['key']);
        if ($old !== '') {
            delete_uploaded_media($old);
        }
        save_setting($meta['key'], (string) $up['file_path'], $meta['group']);
    }
}

foreach ($fields as $key => $val) {
    $cleanKey = preg_replace('/[^a-z0-9_]/', '', strtolower((string) $key)) ?? '';
    if ($cleanKey === '') {
        continue;
    }
    $group = explode('_', $cleanKey)[0] ?: 'general';
    save_setting($cleanKey, trim((string) $val), $group);
}

json_response(['ok' => true]);
