<?php
declare(strict_types=1);
// All amounts are integer poisha. The database transaction is the source of truth.
function money(int $poisha): string { return '৳'.number_format($poisha / 100, 2); }
function form_key(): string {
    $now=time(); $_SESSION['form_keys']=array_filter($_SESSION['form_keys'] ?? [], static fn($created) => $created >= $now-3600);
    if (count($_SESSION['form_keys']) >= 50) array_shift($_SESSION['form_keys']);
    $key=bin2hex(random_bytes(32)); $_SESSION['form_keys'][$key]=$now; return $key;
}
function consume_key(): string {
    $key=(string)($_POST['request_key'] ?? '');
    if (!isset($_SESSION['form_keys'][$key]) || $_SESSION['form_keys'][$key] < time()-3600) { flash('This form expired or was already submitted.'); redirect('/dashboard'); }
    unset($_SESSION['form_keys'][$key]); return $key;
}
function wallet(PDO $db, int $id): void { $q=$db->prepare('INSERT INTO wallets(user_id,balance_poisha) VALUES(?,0) ON DUPLICATE KEY UPDATE user_id=user_id'); $q->execute([$id]); }
function amount_poisha(string $value): int {
    if (!preg_match('/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?$/D', $value)) return 0;
    $parts=explode('.',$value); return (int)$parts[0]*100+(int)str_pad($parts[1] ?? '',2,'0');
}
function business_post(PDO $db, string $path, ?array $me, array $settings): bool {
    if (!in_array($path,['/orders/new','/wallet','/support','/support/reply','/admin/deposits','/admin/orders','/admin/support'],true)) return false;
    require_user($me); $uid=(int)$me['id'];
    if (str_starts_with($path,'/admin/')) require_admin($me);
    if ($path==='/orders/new') {
        $key=consume_key(); $service=filter_var($_POST['service_id'] ?? '',FILTER_VALIDATE_INT); $quantity=filter_var($_POST['quantity'] ?? '',FILTER_VALIDATE_INT); $url=trim((string)($_POST['target_url'] ?? ''));
        if (!$service || !$quantity || $quantity<1 || $quantity>1000000 || strlen($url)>2048 || !filter_var($url,FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($url,PHP_URL_SCHEME)),['http','https'],true)) { flash('Enter a valid service, quantity and public HTTP(S) link.'); redirect('/orders/new'); }
        $db->beginTransaction(); $q=$db->prepare('SELECT * FROM services WHERE id=? AND active=1 FOR UPDATE'); $q->execute([$service]); $s=$q->fetch(PDO::FETCH_ASSOC);
        if (!$s || !(int)$s['rate_poisha_per_1000'] || $quantity<(int)$s['min_quantity'] || $quantity>(int)$s['max_quantity']) { $db->rollBack(); flash('Service is unavailable or quantity is outside its limits.'); redirect('/orders/new'); }
        $cost=intdiv((int)$s['rate_poisha_per_1000']*$quantity+999,1000);
        wallet($db,$uid); $q=$db->prepare('SELECT balance_poisha FROM wallets WHERE user_id=? FOR UPDATE'); $q->execute([$uid]);
        if ((int)$q->fetchColumn()<$cost) { $db->rollBack(); flash('Insufficient wallet balance.'); redirect('/wallet'); }
        $q=$db->prepare('INSERT INTO orders(user_id,service_id,service_title,target_url,quantity,cost_poisha,request_key) VALUES(?,?,?,?,?,?,?)'); $q->execute([$uid,$service,$s['title'],$url,$quantity,$cost,$key]); $id=(int)$db->lastInsertId();
        $db->prepare('UPDATE wallets SET balance_poisha=balance_poisha-? WHERE user_id=?')->execute([$cost,$uid]); $db->prepare("INSERT INTO ledger(user_id,amount_poisha,kind,reference_id) VALUES(?,?,'order',?)")->execute([$uid,-$cost,$id]); $db->commit(); flash('Order submitted for manual review.'); redirect('/orders');
    }
    if ($path==='/wallet') {
        $key=consume_key(); $amount=amount_poisha(trim((string)($_POST['amount'] ?? ''))); $method=(string)($_POST['method'] ?? ''); $reference=trim((string)($_POST['reference'] ?? ''));
        if (empty($settings['payment_instructions']) || $amount<100 || $amount>100000000 || !in_array($method,['bKash','Nagad','Other'],true) || !preg_match('/^[a-zA-Z0-9._-]{4,120}$/D',$reference)) { flash('Check the amount, payment reference and instructions.'); redirect('/wallet'); }
        try { $q=$db->prepare('INSERT INTO deposits(user_id,amount_poisha,method,reference,request_key) VALUES(?,?,?,?,?)'); $q->execute([$uid,$amount,$method,$reference,$key]); flash('Payment submitted for manual verification. No funds have been credited yet.'); } catch (PDOException $e) { if ($e->getCode()!=='23000') throw $e; flash('This payment reference has already been submitted.'); } redirect('/wallet');
    }
    if ($path==='/admin/deposits') {
        $id=(int)($_POST['id'] ?? 0); $decision=(string)($_POST['decision'] ?? ''); if (!$id || !in_array($decision,['approved','rejected'],true)) { http_response_code(400); exit('Invalid request'); }
        $db->beginTransaction(); $q=$db->prepare('SELECT * FROM deposits WHERE id=? FOR UPDATE'); $q->execute([$id]); $d=$q->fetch(PDO::FETCH_ASSOC);
        if (!$d || $d['status']!=='pending') { $db->rollBack(); flash('Payment is no longer pending.'); redirect('/admin/deposits'); }
        if ($decision==='approved') { wallet($db,(int)$d['user_id']); $db->prepare('UPDATE wallets SET balance_poisha=balance_poisha+? WHERE user_id=?')->execute([(int)$d['amount_poisha'],(int)$d['user_id']]); $db->prepare("INSERT INTO ledger(user_id,amount_poisha,kind,reference_id) VALUES(?,?,'deposit',?)")->execute([(int)$d['user_id'],(int)$d['amount_poisha'],$id]); }
        $db->prepare('UPDATE deposits SET status=? WHERE id=?')->execute([$decision,$id]); log_action($db,$uid,'Payment #'.$id.' '.$decision); $db->commit(); flash('Payment updated.'); redirect('/admin/deposits');
    }
    if ($path==='/admin/orders') {
        $id=(int)($_POST['id'] ?? 0); $status=(string)($_POST['status'] ?? ''); if (!$id || !in_array($status,['in_progress','completed','cancelled'],true)) { http_response_code(400); exit('Invalid request'); }
        $db->beginTransaction(); $q=$db->prepare('SELECT * FROM orders WHERE id=? FOR UPDATE'); $q->execute([$id]); $o=$q->fetch(PDO::FETCH_ASSOC);
        if (!$o || !in_array($o['status'],['pending','in_progress'],true)) { $db->rollBack(); flash('This order cannot be changed.'); redirect('/admin/orders'); }
        if ($status==='cancelled') { $db->prepare('UPDATE wallets SET balance_poisha=balance_poisha+? WHERE user_id=?')->execute([(int)$o['cost_poisha'],(int)$o['user_id']]); $db->prepare("INSERT INTO ledger(user_id,amount_poisha,kind,reference_id) VALUES(?,?,'refund',?)")->execute([(int)$o['user_id'],(int)$o['cost_poisha'],$id]); }
        $db->prepare('UPDATE orders SET status=? WHERE id=?')->execute([$status,$id]); log_action($db,$uid,'Order #'.$id.' '.$status); $db->commit(); flash('Order updated.'); redirect('/admin/orders');
    }
    if ($path==='/support') {
        $subject=trim((string)($_POST['subject'] ?? '')); $body=trim((string)($_POST['body'] ?? ''));
        if ($subject==='' || mb_strlen($subject)>150 || $body==='' || mb_strlen($body)>5000) { flash('Enter a subject and message.'); redirect('/support'); }
        $db->beginTransaction(); $db->prepare('INSERT INTO tickets(user_id,subject) VALUES(?,?)')->execute([$uid,$subject]); $id=(int)$db->lastInsertId(); $db->prepare('INSERT INTO ticket_messages(ticket_id,user_id,body) VALUES(?,?,?)')->execute([$id,$uid,$body]); $db->commit(); redirect('/support?id='.$id);
    }
    if ($path==='/support/reply' || $path==='/admin/support') {
        $id=(int)($_POST['id'] ?? 0); $body=trim((string)($_POST['body'] ?? '')); $isAdmin=$path==='/admin/support';
        $q=$db->prepare('SELECT * FROM tickets WHERE id=?'); $q->execute([$id]); $ticket=$q->fetch(PDO::FETCH_ASSOC);
        if (!$ticket || (!$isAdmin && (int)$ticket['user_id']!==$uid)) { http_response_code(404); exit('Not found'); }
        if ($ticket['status']!=='open' || $body==='' || mb_strlen($body)>5000) { flash('Ticket is closed or message is invalid.'); redirect(($isAdmin?'/admin/support':'/support').'?id='.$id); }
        $db->prepare('INSERT INTO ticket_messages(ticket_id,user_id,body) VALUES(?,?,?)')->execute([$id,$uid,$body]); if($isAdmin) log_action($db,$uid,'Replied to ticket #'.$id); redirect(($isAdmin?'/admin/support':'/support').'?id='.$id);
    }
    return true;
}
