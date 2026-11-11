<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_csrf(true);

if (honeypot_triggered()) {
    json_response(['ok' => true, 'message' => 'Subscribed! Thank you.']);
}

if (!rate_limit_allow('newsletter_submit', 5, 900)) {
    json_response(['ok' => false, 'error' => 'Too many attempts. Please try again later.'], 429);
}

$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if ($email === '' || mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'Please enter a valid email address.'], 422);
}

$pdo = db();
$chk = $pdo->prepare('SELECT `id` FROM `messages` WHERE `type` = :t AND `email` = :e LIMIT 1');
$chk->execute([':t' => 'newsletter', ':e' => $email]);

if (!$chk->fetch()) {
    $ins = $pdo->prepare(
        'INSERT INTO `messages` (`type`, `email`, `subject`, `status`, `ip_hash`)
         VALUES (:t, :e, :s, :st, :ip)'
    );
    $ins->execute([
        ':t' => 'newsletter',
        ':e' => $email,
        ':s' => 'Newsletter Subscription',
        ':st' => 'approved',
        ':ip' => client_ip_hash(),
    ]);
    send_admin_notification('[Newsletter] New Subscriber', "Subscriber email: {$email}\n", $email);
}

json_response([
    'ok' => true,
    'message' => 'Subscribed! Thank you.',
]);
