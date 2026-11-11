<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_csrf(true);

if (honeypot_triggered()) {
    json_response(['ok' => true]);
}

if (!rate_limit_allow('contact_submit', 5, 900)) {
    json_response(['ok' => false, 'error' => 'Too many requests. Please wait before sending another message.'], 429);
}

$name = trim((string) ($_POST['name'] ?? ''));
$email = trim((string) ($_POST['email'] ?? ''));
$phone = trim((string) ($_POST['phone'] ?? ''));
$subject = trim((string) ($_POST['subject'] ?? 'General Inquiry'));
$message = trim((string) ($_POST['message'] ?? ''));

if ($name === '' || mb_strlen($name) > 120) {
    json_response(['ok' => false, 'error' => 'Please enter your name.'], 422);
}
if ($email === '' || mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'Please enter a valid email address.'], 422);
}
if (mb_strlen($message) < 10 || mb_strlen($message) > 4000) {
    json_response(['ok' => false, 'error' => 'Message must be between 10 and 4000 characters.'], 422);
}

$stmt = db()->prepare(
    'INSERT INTO `messages` (`type`, `name`, `email`, `phone`, `subject`, `message`, `status`, `ip_hash`)
     VALUES (:type, :name, :email, :phone, :subject, :message, :status, :ip_hash)'
);
$stmt->execute([
    ':type' => 'contact',
    ':name' => $name,
    ':email' => $email,
    ':phone' => $phone !== '' ? mb_substr($phone, 0, 60) : null,
    ':subject' => mb_substr($subject, 0, 200),
    ':message' => $message,
    ':status' => 'pending',
    ':ip_hash' => client_ip_hash(),
]);

send_admin_notification(
    "[Contact] {$subject}",
    "Name: {$name}\nEmail: {$email}\nPhone: {$phone}\n\n{$message}\n",
    $email
);

json_response(['ok' => true]);
