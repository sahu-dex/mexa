<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/config/db.php';

function is_https_request(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        return true;
    }
    return false;
}

function mexa_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    if (PHP_SAPI === 'cli') {
        $_SESSION = $_SESSION ?? [];
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');

    session_name('MEXASESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => is_https_request(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function e(mixed $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function slugify(string $text): string
{
    $slug = strtolower(trim($text));
    $slug = (string) preg_replace('/[^a-z0-9]+/', '-', $slug);
    $slug = trim($slug, '-');
    return $slug !== '' ? $slug : 'item-' . bin2hex(random_bytes(3));
}

function split_lines(?string $text): array
{
    if ($text === null || trim($text) === '') {
        return [];
    }
    $trimmedAll = trim($text);
    if (str_starts_with($trimmedAll, '[')) {
        $decoded = json_decode($trimmedAll, true);
        if (is_array($decoded)) {
            return array_values(array_filter(array_map(static fn($v) => trim((string) $v), $decoded), static fn($v) => $v !== ''));
        }
    }
    $parts = preg_split('/\r\n|\r|\n/', $text) ?: [];
    $out = [];
    foreach ($parts as $part) {
        $trimmed = trim($part);
        if ($trimmed !== '') {
            $out[] = $trimmed;
        }
    }
    return $out;
}

function start_secure_session(): void
{
    mexa_start_session();
}

function send_security_headers(): void
{
    if (PHP_SAPI === 'cli' || headers_sent()) {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function redirect_to(string $url): never
{
    header('Location: ' . $url);
    exit;
}

function flash_set(string $type, string $message): void
{
    mexa_start_session();
    $_SESSION['_flash'] = ['type' => $type, 'message' => $message];
}

function flash_get(): ?array
{
    mexa_start_session();
    if (empty($_SESSION['_flash']) || !is_array($_SESSION['_flash'])) {
        return null;
    }
    $msg = $_SESSION['_flash'];
    unset($_SESSION['_flash']);
    return $msg;
}

function csrf_token(): string
{
    mexa_start_session();
    if (empty($_SESSION['_csrf_token']) || !is_string($_SESSION['_csrf_token'])) {
        $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function csrf_verify(?string $provided = null): bool
{
    mexa_start_session();
    if (empty($_SESSION['_csrf_token']) || !is_string($_SESSION['_csrf_token'])) {
        return false;
    }
    $token = $provided;
    if ($token === null) {
        $token = $_POST['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    }
    if (!is_string($token) || $token === '') {
        return false;
    }
    return hash_equals($_SESSION['_csrf_token'], $token);
}

function require_csrf(bool $asJson = false): void
{
    if (!csrf_verify()) {
        if ($asJson) {
            json_response(['ok' => false, 'error' => 'Invalid or expired security token. Please refresh the page.'], 403);
        }
        http_response_code(403);
        exit('Invalid CSRF token.');
    }
}

function honeypot_field(): string
{
    return '<div style="position:absolute;left:-9999px;top:-9999px;height:0;width:0;overflow:hidden" aria-hidden="true">'
        . '<label>Website <input type="text" name="website_url" value="" tabindex="-1" autocomplete="off"></label>'
        . '</div>';
}

function honeypot_triggered(): bool
{
    $val = $_POST['website_url'] ?? '';
    return is_string($val) && trim($val) !== '';
}

function client_ip_hash(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return hash_hmac('sha256', $ip, MEXA_ROOT . '|mexa-ip-salt');
}

function rate_limit_allow(string $bucket, int $maxHits, int $windowSeconds): bool
{
    $dir = MEXA_STORAGE_DIR . '/ratelimits';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $key = hash('sha256', $bucket . '|' . client_ip_hash());
    $file = $dir . '/' . $key . '.json';
    $now = time();
    $cutoff = $now - $windowSeconds;

    $fp = @fopen($file, 'c+');
    if ($fp === false) {
        return true;
    }

    $allowed = true;
    if (flock($fp, LOCK_EX)) {
        $raw = stream_get_contents($fp);
        $hits = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        if (!is_array($hits)) {
            $hits = [];
        }
        $hits = array_values(array_filter($hits, static fn($ts) => is_int($ts) && $ts > $cutoff));
        if (count($hits) >= $maxHits) {
            $allowed = false;
        } else {
            $hits[] = $now;
        }
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($hits));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return $allowed;
}

function settings(bool $refresh = false): array
{
    static $cache = null;
    if ($cache !== null && !$refresh) {
        return $cache;
    }
    $cache = [];
    $stmt = db()->query('SELECT `setting_key`, `setting_value` FROM `settings`');
    foreach ($stmt->fetchAll() as $row) {
        $cache[(string) $row['setting_key']] = (string) ($row['setting_value'] ?? '');
    }
    return $cache;
}

function setting(string $key, string $default = ''): string
{
    $all = settings();
    if (!array_key_exists($key, $all)) {
        return $default;
    }
    return $all[$key] !== '' ? $all[$key] : $default;
}

function setting_raw(string $key, string $default = ''): string
{
    $all = settings();
    return array_key_exists($key, $all) ? $all[$key] : $default;
}

function save_setting(string $key, string $value, string $group = 'general'): void
{
    $stmt = db()->prepare(
        'INSERT INTO `settings` (`setting_key`, `setting_value`, `setting_group`)
         VALUES (:k, :v, :g)
         ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`), `setting_group` = VALUES(`setting_group`)'
    );
    $stmt->execute([
        ':k' => $key,
        ':v' => $value,
        ':g' => $group,
    ]);
    settings(true);
}

function upload_media(array $file, string $mediaType = 'image'): array
{
    $errCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($errCode !== UPLOAD_ERR_OK) {
        return ['ok' => false, 'error' => 'File upload failed (code ' . $errCode . ').'];
    }

    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        return ['ok' => false, 'error' => 'Invalid uploaded file.'];
    }

    $size = (int) ($file['size'] ?? 0);
    $maxBytes = $mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if ($size <= 0 || $size > $maxBytes) {
        $mb = round($maxBytes / 1048576, 1);
        return ['ok' => false, 'error' => "File size exceeds maximum limit ({$mb} MB)."];
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string) $finfo->file($tmpName);

    if ($mediaType === 'video') {
        $allowedMimes = [
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'video/quicktime' => 'mov',
        ];
        if (!isset($allowedMimes[$mime])) {
            return ['ok' => false, 'error' => 'Only MP4, WebM, or MOV video files are allowed.'];
        }
        $ext = $allowedMimes[$mime];
        $subDir = 'videos';
    } else {
        $allowedMimes = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
        ];
        if (!isset($allowedMimes[$mime])) {
            return ['ok' => false, 'error' => 'Only JPG, PNG, WebP, or GIF image files are allowed.'];
        }
        if (@getimagesize($tmpName) === false) {
            return ['ok' => false, 'error' => 'Uploaded file is not a valid image.'];
        }
        $ext = $allowedMimes[$mime];
        $subDir = 'images';
    }

    $targetDir = MEXA_UPLOADS_DIR . '/' . $subDir;
    if (!is_dir($targetDir) && !@mkdir($targetDir, 0755, true)) {
        return ['ok' => false, 'error' => 'Upload directory could not be created.'];
    }

    $randomName = bin2hex(random_bytes(16)) . '.' . $ext;
    $destPath = $targetDir . '/' . $randomName;

    if (!move_uploaded_file($tmpName, $destPath)) {
        return ['ok' => false, 'error' => 'Could not save uploaded file.'];
    }
    @chmod($destPath, 0644);

    return [
        'ok' => true,
        'file_path' => 'uploads/' . $subDir . '/' . $randomName,
    ];
}

function delete_uploaded_file(?string $relativePath): void
{
    if ($relativePath === null || $relativePath === '') {
        return;
    }
    if (!str_starts_with($relativePath, 'uploads/images/') && !str_starts_with($relativePath, 'uploads/videos/')) {
        return;
    }
    $fullPath = realpath(MEXA_ROOT . '/' . ltrim($relativePath, '/'));
    $uploadsRoot = realpath(MEXA_UPLOADS_DIR);
    if ($fullPath !== false && $uploadsRoot !== false && str_starts_with($fullPath, $uploadsRoot . DIRECTORY_SEPARATOR) && is_file($fullPath)) {
        @unlink($fullPath);
    }
}

function send_admin_notification(string $subject, string $body, ?string $replyTo = null): bool
{
    $to = trim(setting('notification_email', MAIL_TO_DEFAULT));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    if (str_contains($to, '@your-domain.com') || str_contains($to, '@example.com')) {
        return false;
    }

    $cleanSubject = str_replace(["\r", "\n"], ' ', $subject);
    $fromEmail = str_replace(["\r", "\n"], '', MAIL_FROM);
    if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        $fromEmail = 'noreply@localhost';
    }
    $fromName = str_replace(["\r", "\n"], ' ', setting('site_name', MAIL_FROM_NAME));

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . mb_encode_mimeheader($fromName, 'UTF-8') . " <{$fromEmail}>",
    ];
    if ($replyTo !== null && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $cleanReply = str_replace(["\r", "\n"], '', $replyTo);
        $headers[] = "Reply-To: {$cleanReply}";
    }

    $encodedSubject = mb_encode_mimeheader($cleanSubject, 'UTF-8');
    return @mail($to, $encodedSubject, $body, implode("\r\n", $headers));
}

function delete_uploaded_media(?string $relativePath): void
{
    delete_uploaded_file($relativePath);
}

function admins_count(): int
{
    return admin_count();
}

function admin_count(): int
{
    return (int) db()->query('SELECT COUNT(*) FROM `admins`')->fetchColumn();
}

function current_admin(): ?array
{
    mexa_start_session();
    $adminId = $_SESSION['admin_id'] ?? null;
    if (!is_int($adminId) && !ctype_digit((string) $adminId)) {
        return null;
    }
    $stmt = db()->prepare('SELECT `id`, `username`, `email`, `last_login_at`, `created_at` FROM `admins` WHERE `id` = :id LIMIT 1');
    $stmt->execute([':id' => (int) $adminId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function require_admin(bool $asJson = false): array
{
    $admin = current_admin();
    if ($admin === null) {
        if ($asJson) {
            json_response(['ok' => false, 'error' => 'Unauthorized. Please log in as admin.'], 401);
        }
        redirect_to('login.php');
    }
    return $admin;
}

function admin_login_user(array $adminRow): void
{
    mexa_start_session();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $adminRow['id'];
    $_SESSION['admin_username'] = (string) $adminRow['username'];
    $_SESSION['_csrf_token'] = bin2hex(random_bytes(32));

    $stmt = db()->prepare('UPDATE `admins` SET `last_login_at` = NOW() WHERE `id` = :id');
    $stmt->execute([':id' => (int) $adminRow['id']]);
}

function admin_logout_user(): void
{
    mexa_start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'] ?? '/',
            $params['domain'] ?? '',
            (bool) ($params['secure'] ?? false),
            (bool) ($params['httponly'] ?? true)
        );
    }
    session_destroy();
}

function get_services_with_packages(bool $onlyActive = true): array
{
    $pdo = db();
    $sql = 'SELECT * FROM `services`';
    if ($onlyActive) {
        $sql .= ' WHERE `is_active` = 1';
    }
    $sql .= ' ORDER BY `sort_order` ASC, `id` ASC';
    $services = $pdo->query($sql)->fetchAll();

    $packages = $pdo->query('SELECT * FROM `packages` ORDER BY `sort_order` ASC, `id` ASC')->fetchAll();
    $pkgMap = [];
    foreach ($packages as $pkg) {
        $sid = (int) $pkg['service_id'];
        $pkgMap[$sid][] = [
            'id' => (int) $pkg['id'],
            'serviceId' => $sid,
            'service_id' => $sid,
            'quality' => (string) $pkg['quality'],
            'name' => (string) $pkg['name'],
            'price' => (float) $pkg['price'],
            'currency' => (string) $pkg['currency'],
            'description' => (string) ($pkg['description'] ?? ''),
            'features' => split_lines($pkg['features'] ?? ''),
            'delivery' => (string) ($pkg['delivery'] ?? ''),
            'revisions' => (string) ($pkg['revisions'] ?? ''),
            'badge' => (string) ($pkg['badge'] ?? ''),
            'highlight' => (int) $pkg['highlight'] === 1,
            'sort_order' => (int) $pkg['sort_order'],
        ];
    }

    $formattedServices = [];
    $flatPackages = [];

    foreach ($services as $svc) {
        $sid = (int) $svc['id'];
        $demos = [];
        if (!empty($svc['demo_videos_json'])) {
            $decoded = json_decode((string) $svc['demo_videos_json'], true);
            if (is_array($decoded)) {
                $demos = $decoded;
            }
        }
        $filePath = (string) ($svc['file_path'] ?? '');
        $thumbPath = (string) ($svc['thumbnail_path'] ?? '');
        $svcPackages = $pkgMap[$sid] ?? [];
        foreach ($svcPackages as $sp) {
            $flatPackages[] = $sp;
        }
        $formattedServices[] = [
            'id' => $sid,
            'name' => (string) $svc['name'],
            'slug' => (string) $svc['slug'],
            'category' => (string) $svc['category'],
            'label' => (string) $svc['category'],
            'icon' => (string) $svc['icon'],
            'price_from' => (float) $svc['price_from'],
            'subtitle' => (string) ($svc['subtitle'] ?? ''),
            'description' => (string) $svc['description'],
            'long_description' => (string) ($svc['long_description'] ?? ''),
            'deliverables' => (string) ($svc['deliverables'] ?? ''),
            'bullet_points' => (string) ($svc['bullet_points'] ?? ''),
            'features' => split_lines($svc['bullet_points'] ?? ''),
            'file_path' => $filePath,
            'thumbnail_path' => $thumbPath,
            'main_video_url' => $filePath,
            'video_thumbnail' => $thumbPath,
            'main_video_embed_type' => (string) ($svc['embed_type'] ?? 'video'),
            'main_video_embed_url' => $filePath,
            'main_video_provider' => (string) ($svc['embed_provider'] ?? ''),
            'embed_type' => (string) ($svc['embed_type'] ?? 'video'),
            'embed_provider' => (string) ($svc['embed_provider'] ?? ''),
            'demo_videos' => $demos,
            'is_active' => (int) $svc['is_active'],
            'sort_order' => (int) $svc['sort_order'],
            'packages' => $svcPackages,
        ];
    }

    return [
        'services' => $formattedServices,
        'packages' => $flatPackages,
    ];
}

function get_work_bundle(?string $kind = null, ?string $category = null, ?string $section = null): array
{
    $sql = 'SELECT * FROM `work_items` WHERE `status` = :status';
    $params = [':status' => 'published'];

    if ($kind !== null && $kind !== '') {
        $sql .= ' AND `kind` = :kind';
        $params[':kind'] = $kind;
    }
    if ($category !== null && $category !== '') {
        $sql .= ' AND `category` = :category';
        $params[':category'] = $category;
    }
    if ($section !== null && $section !== '') {
        $sql .= ' AND `section` = :section';
        $params[':section'] = $section;
    }
    $sql .= ' ORDER BY `sort_order` ASC, `id` ASC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $items = [];
    $recent = [];
    $demos = [];
    $shorts = [];
    $videos = [];
    $categories = [];

    foreach ($rows as $r) {
        $filePath = (string) $r['file_path'];
        $thumbPath = (string) ($r['thumbnail_path'] ?? '');
        $sec = (string) $r['section'];
        $cat = (string) $r['category'];
        if ($cat !== '' && !in_array($cat, $categories, true) && $sec !== 'preview') {
            $categories[] = $cat;
        }
        $formatted = [
            'id' => (int) $r['id'],
            'title' => (string) $r['title'],
            'description' => (string) ($r['description'] ?? ''),
            'kind' => (string) $r['kind'],
            'platform' => (string) $r['platform'],
            'category' => $cat,
            'section' => $sec,
            'file_path' => $filePath,
            'thumbnail_path' => $thumbPath,
            'url' => $filePath,
            'video_url' => $filePath,
            'thumbnail_url' => $thumbPath,
            'embed_type' => (string) ($r['embed_type'] ?? ''),
            'embed_provider' => (string) ($r['embed_provider'] ?? ''),
            'embed_url' => (string) ($r['embed_url'] ?? ''),
            'duration' => (string) ($r['duration'] ?? ''),
            'service' => (string) ($r['service_name'] ?? ''),
            'is_featured' => (int) $r['is_featured'],
            'sort_order' => (int) $r['sort_order'],
            'status' => 'done',
        ];
        if ($sec === 'preview') {
            $videos[] = $formatted;
            continue;
        }
        $items[] = $formatted;
        if ($sec === 'recent') {
            $recent[] = $formatted;
        } elseif ($sec === 'demo') {
            $demos[] = $formatted;
        } elseif ($sec === 'short') {
            $shorts[] = $formatted;
        }
    }

    return [
        'items' => $items,
        'recent' => $recent,
        'demos' => $demos,
        'shorts' => $shorts,
        'videos' => $videos,
        'categories' => $categories,
    ];
}

function get_reviews_bundle(bool $excludeFeaturedOnly = false): array
{
    $sql = 'SELECT * FROM `reviews` WHERE `status` = :status';
    if ($excludeFeaturedOnly) {
        $sql .= ' AND `is_featured` = 0';
    }
    $sql .= ' ORDER BY `created_at` DESC, `id` DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute([':status' => 'approved']);
    $rows = $stmt->fetchAll();

    if ($excludeFeaturedOnly && empty($rows)) {
        return get_reviews_bundle(false);
    }

    $items = [];
    $sum = 0;
    $five = 0;
    foreach ($rows as $r) {
        $rating = max(1, min(5, (int) $r['rating']));
        $sum += $rating;
        if ($rating === 5) {
            $five++;
        }
        $fp = (string) ($r['file_path'] ?? '');
        $items[] = [
            'id' => (int) $r['id'],
            'name' => (string) $r['name'],
            'role' => (string) ($r['role'] ?? ''),
            'rating' => $rating,
            'body' => (string) $r['body'],
            'file_path' => $fp,
            'photo_url' => $fp,
            'is_featured' => (int) $r['is_featured'],
            'status' => (string) $r['status'],
            'created_at' => (string) $r['created_at'],
        ];
    }

    $count = count($items);
    $avg = $count > 0 ? round($sum / $count, 1) : 5.0;

    return [
        'items' => $items,
        'stats' => [
            'count' => $count,
            'average' => $avg,
            'five' => $five,
        ],
    ];
}

function get_featured_reviews(): array
{
    $stmt = db()->prepare('SELECT * FROM `reviews` WHERE `status` = :status AND `is_featured` = 1 ORDER BY `id` ASC');
    $stmt->execute([':status' => 'approved']);
    $rows = $stmt->fetchAll();
    if (!empty($rows)) {
        return $rows;
    }
    $fallback = db()->prepare('SELECT * FROM `reviews` WHERE `status` = :status ORDER BY `created_at` DESC LIMIT 10');
    $fallback->execute([':status' => 'approved']);
    return $fallback->fetchAll();
}

function get_team_bundle(): array
{
    $stmt = db()->query('SELECT * FROM `team_members` WHERE `is_active` = 1 ORDER BY `is_founder` DESC, `sort_order` ASC, `id` ASC');
    $rows = $stmt->fetchAll();

    $members = [];
    foreach ($rows as $m) {
        $fp = (string) ($m['file_path'] ?? '');
        $members[] = [
            'id' => (int) $m['id'],
            'slug' => (string) $m['slug'],
            'name' => (string) $m['name'],
            'role' => (string) $m['role'],
            'bio' => (string) ($m['bio'] ?? ''),
            'description' => (string) ($m['description'] ?? ''),
            'skills' => split_lines($m['skills'] ?? ''),
            'responsibilities' => split_lines($m['responsibilities'] ?? ''),
            'file_path' => $fp,
            'photo_url' => $fp,
            'whatsapp' => (string) ($m['whatsapp'] ?? ''),
            'telegram' => (string) ($m['telegram'] ?? ''),
            'phone' => (string) ($m['phone'] ?? ''),
            'email' => (string) ($m['email'] ?? ''),
            'is_founder' => (int) $m['is_founder'],
            'is_active' => (int) $m['is_active'],
            'sort_order' => (int) $m['sort_order'],
        ];
    }

    return [
        'heading' => setting('team_heading', 'Our Team'),
        'intro' => setting('team_intro', ''),
        'members' => $members,
    ];
}

function build_page_payload(string $pageKey): array
{
    $payload = [
        'content' => [
            'services_heading' => setting('services_heading', 'Our Services'),
            'services_intro' => setting('services_intro', ''),
            'show_services' => setting_raw('show_services', '1'),
            'show_packages' => setting_raw('show_packages', '1'),
            'show_overview' => setting_raw('show_overview', '1'),
            'overview_video_url' => setting_raw('overview_video_file_path', ''),
            'overview_poster_url' => setting_raw('overview_poster_file_path', ''),
            'overview_video_embed_type' => setting('overview_video_embed_type', 'video'),
            'overview_video_embed_url' => setting_raw('overview_video_file_path', ''),
            'overview_video_provider' => setting_raw('overview_video_provider', ''),
            'review_heading' => setting('review_heading', 'Client Reviews'),
            'review_hero_image' => setting('review_hero_file_path', 'assets/images/review-hero.jpg'),
            'review_hero_desc' => setting('review_hero_desc', ''),
            'team_heading' => setting('team_heading', 'Our Team'),
            'team_intro' => setting('team_intro', ''),
        ],
        'contact' => [
            'founder_name' => setting('founder_name', 'Rowshan Taieen'),
            'founder_role' => setting('founder_role', 'Founder & Lead Mentor'),
            'founder_bio' => setting('founder_bio', ''),
            'welcome_message' => setting('welcome_message', ''),
            'whatsapp_number' => setting_raw('whatsapp_number', ''),
            'telegram_url' => setting_raw('telegram_url', ''),
            'call_number' => setting_raw('call_number', ''),
            'email' => setting_raw('contact_email', ''),
            'facebook_url' => setting_raw('social_facebook', ''),
        ],
    ];

    if (in_array($pageKey, ['service', 'book'], true)) {
        $cat = get_services_with_packages(true);
        $payload['services'] = $cat['services'];
        $payload['packages'] = $cat['packages'];
    }
    if ($pageKey === 'work') {
        $work = get_work_bundle();
        $payload['work'] = $work;
        $payload['videos'] = $work['videos'];
    }
    if ($pageKey === 'review') {
        $payload['reviews'] = get_reviews_bundle(true);
    }
    if (in_array($pageKey, ['team', 'book'], true)) {
        $payload['team'] = get_team_bundle();
    }

    return $payload;
}

function page_stylesheets(string $pageKey): array
{
    $map = [
        'home' => [
            'assets/css/site-vendor-base.css',
            'assets/css/tailwind-home.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/site-header-lockup.css',
            'assets/css/mm-hero-character.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/home-hero.css',
            'assets/css/mm-subscribe-fix.css',
            'assets/css/mm-services-cta.css',
            'assets/css/home-ui-fixes.css',
        ],
        'service' => [
            'assets/css/site-vendor-base.css',
            'assets/css/tailwind-service.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/site-header-lockup.css',
            'assets/css/service-booking-theme.css',
            'assets/css/site-page-hero.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/mm-subscribe-fix.css',
        ],
        'work' => [
            'assets/css/site-vendor-base.css',
            'assets/css/work-vendor-overrides.css',
            'assets/css/tailwind-work.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/work-page-final-layout.css',
            'assets/css/site-header-lockup.css',
            'assets/css/site-page-hero.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/mm-subscribe-fix.css',
            'assets/css/wk-layout-fix.css',
        ],
        'review' => [
            'assets/css/site-vendor-base.css',
            'assets/css/tailwind-review.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/site-header-lockup.css',
            'assets/css/rvx-review-redesign.css',
            'assets/css/site-page-hero.css',
            'assets/css/rvx-layout-v2.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/mm-subscribe-fix.css',
        ],
        'team' => [
            'assets/css/site-vendor-base.css',
            'assets/css/tailwind-team.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/site-header-lockup.css',
            'assets/css/t3-css.css',
            'assets/css/site-page-hero.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/mm-subscribe-fix.css',
        ],
        'book' => [
            'assets/css/site-vendor-base.css',
            'assets/css/tailwind-book.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/service-booking-theme.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/mm-subscribe-fix.css',
        ],
        'privacy' => [
            'assets/css/site-vendor-base.css',
            'assets/css/tailwind-book.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/site-header-lockup.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/mm-subscribe-fix.css',
            'assets/css/legal-page.css?v=20261112-legal',
        ],
        'terms' => [
            'assets/css/site-vendor-base.css',
            'assets/css/tailwind-book.css',
            'assets/css/site-image-fallbacks.css',
            'assets/css/site-header-lockup.css',
            'assets/css/mobile-menu.css',
            'assets/css/site-typography.css',
            'assets/css/video-preview.css',
            'assets/css/mm-subscribe-fix.css',
            'assets/css/legal-page.css?v=20261112-legal',
        ],
    ];
    return array_merge($map[$pageKey] ?? $map['home'], [
        'assets/css/plus-jakarta-font.css',
        'assets/css/premium-design-system.css?v=20261112-footer',
        'assets/css/visual-refresh.css?v=20261112-footer',
    ]);
}
