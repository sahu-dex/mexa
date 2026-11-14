<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';
send_security_headers();
admin_no_cache_headers();

// Signing out changes state, so it only happens on a POST carrying the session's
// CSRF token. A plain link (or an <img> on another site) cannot sign anyone out.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Location: ./');
    exit;
}
require_csrf(false);

admin_logout_user();
header('Location: login?out=1');
exit;
