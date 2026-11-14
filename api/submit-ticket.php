<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/functions.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

require_csrf(true);

if (honeypot_triggered()) {
    json_response(['ok' => true, 'ticket' => '']);
}

$name = trim((string) ($_POST['name'] ?? ''));
$whatsappRaw = trim((string) ($_POST['whatsapp'] ?? ''));
$details = trim((string) ($_POST['message'] ?? ''));

if ($name === '' || mb_strlen($name) < 2 || mb_strlen($name) > 120) {
    json_response(['ok' => false, 'error' => 'Please enter your name.', 'field' => 'name'], 422);
}

// Digits with an optional leading +; spaces, dashes and brackets are accepted
// on input and dropped before storing.
$whatsapp = preg_replace('/[\s().-]+/', '', $whatsappRaw) ?? '';
if (!preg_match('/^\+?\d{8,15}$/D', $whatsapp)) {
    json_response(['ok' => false, 'error' => 'Please enter a valid WhatsApp number, with country code if outside Bangladesh.', 'field' => 'whatsapp'], 422);
}

if (mb_strlen($details) < 10 || mb_strlen($details) > 2000) {
    json_response(['ok' => false, 'error' => 'Please describe what you need in 10 to 2000 characters.', 'field' => 'message'], 422);
}

// Checked after validation so a typo does not use up an attempt.
if (!rate_limit_allow('ticket_submit', 5, 900)) {
    json_response(['ok' => false, 'error' => 'Too many tickets from this connection. Please wait a few minutes and try again.'], 429);
}

// Stored in the existing `messages` table as a contact entry with a ticket
// reference, so it appears under Admin → Messages with no schema change.
$pdo = db();
$stmt = $pdo->prepare(
    'INSERT INTO `messages` (`type`, `ticket_ref`, `name`, `phone`, `subject`, `message`, `status`, `ip_hash`)
     VALUES (:type, :ref, :name, :phone, :subject, :message, :status, :ip_hash)'
);

$ticketRef = '';
for ($attempt = 0; $attempt < 5; $attempt++) {
    $ticketRef = 'TKT-' . gmdate('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    try {
        $stmt->execute([
            ':type' => 'contact',
            ':ref' => $ticketRef,
            ':name' => $name,
            ':phone' => $whatsapp,
            ':subject' => 'Support Ticket (WhatsApp)',
            ':message' => $details,
            ':status' => 'pending',
            ':ip_hash' => client_ip_hash(),
        ]);
        break;
    } catch (PDOException $e) {
        // 23000 = the reference already exists; draw another one.
        if ($e->getCode() !== '23000' || $attempt === 4) {
            error_log('[Mexa Motion Ticket] ' . $e->getMessage());
            json_response(['ok' => false, 'error' => 'We could not save your ticket. Please try again.'], 500);
        }
    }
}

send_admin_notification(
    "[Ticket {$ticketRef}] {$name}",
    "Ticket: {$ticketRef}\nName: {$name}\nWhatsApp: {$whatsapp}\n\n{$details}\n"
);

json_response(['ok' => true, 'ticket' => $ticketRef]);
