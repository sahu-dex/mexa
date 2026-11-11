<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_csrf(true);

if (honeypot_triggered()) {
    json_response(['ok' => true, 'ticket_ref' => 'MM-' . strtoupper(bin2hex(random_bytes(3)))]);
}

if (!rate_limit_allow('booking_submit', 6, 900)) {
    json_response(['ok' => false, 'error' => 'Too many submissions. Please wait a few minutes and try again.'], 429);
}

$serviceId = isset($_POST['service_id']) ? (int) $_POST['service_id'] : 0;
$quality = isset($_POST['quality']) ? strtolower(trim((string) $_POST['quality'])) : '';
$message = trim((string) ($_POST['message'] ?? ''));
$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));

if ($serviceId <= 0 || !in_array($quality, ['normal', 'high', 'premium'], true)) {
    json_response(['ok' => false, 'error' => 'Please choose a valid service and package quality.'], 422);
}

if (mb_strlen($message) < 20 || mb_strlen($message) > 4000) {
    json_response(['ok' => false, 'error' => 'Project details must be between 20 and 4000 characters.'], 422);
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'Please enter a valid email address.'], 422);
}

$pdo = db();
$stmtSvc = $pdo->prepare('SELECT `id`, `name` FROM `services` WHERE `id` = :id AND `is_active` = 1 LIMIT 1');
$stmtSvc->execute([':id' => $serviceId]);
$svc = $stmtSvc->fetch();
if (!$svc) {
    json_response(['ok' => false, 'error' => 'Selected service is not available.'], 404);
}

$stmtPkg = $pdo->prepare('SELECT `id`, `name`, `price`, `currency` FROM `packages` WHERE `service_id` = :sid AND `quality` = :q LIMIT 1');
$stmtPkg->execute([':sid' => $serviceId, ':q' => $quality]);
$pkg = $stmtPkg->fetch();

$ticketRef = 'MM-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(2)));
$subject = $svc['name'] . ' — ' . ($pkg['name'] ?? ucfirst($quality));

$stmtIns = $pdo->prepare(
    'INSERT INTO `messages` (
        `type`, `ticket_ref`, `name`, `email`, `phone`, `subject`, `message`,
        `service_id`, `package_id`, `package_quality`, `quoted_price`, `currency`, `status`, `ip_hash`
    ) VALUES (
        :type, :ticket_ref, :name, :email, :phone, :subject, :message,
        :service_id, :package_id, :package_quality, :quoted_price, :currency, :status, :ip_hash
    )'
);
$stmtIns->execute([
    ':type' => 'booking',
    ':ticket_ref' => $ticketRef,
    ':name' => mb_substr($name, 0, 120) ?: null,
    ':email' => mb_substr($email, 0, 190) ?: null,
    ':phone' => mb_substr($phone, 0, 60) ?: null,
    ':subject' => mb_substr($subject, 0, 200),
    ':message' => $message,
    ':service_id' => (int) $svc['id'],
    ':package_id' => $pkg ? (int) $pkg['id'] : null,
    ':package_quality' => $quality,
    ':quoted_price' => $pkg ? (float) $pkg['price'] : null,
    ':currency' => $pkg ? (string) $pkg['currency'] : 'USD',
    ':status' => 'pending',
    ':ip_hash' => client_ip_hash(),
]);

$mailBody = "New Booking Ticket Submitted\n"
    . "Ticket Ref: {$ticketRef}\n"
    . "Service: {$svc['name']}\n"
    . 'Package: ' . ($pkg['name'] ?? $quality) . "\n"
    . 'Price: ' . ($pkg ? $pkg['currency'] . ' ' . $pkg['price'] : 'N/A') . "\n"
    . ($name !== '' ? "Client Name: {$name}\n" : '')
    . ($email !== '' ? "Client Email: {$email}\n" : '')
    . ($phone !== '' ? "Client Phone: {$phone}\n" : '')
    . "\nProject Details:\n{$message}\n";

send_admin_notification("[Booking {$ticketRef}] {$subject}", $mailBody, $email !== '' ? $email : null);

json_response([
    'ok' => true,
    'ticket_ref' => $ticketRef,
    'status' => 'pending',
]);
