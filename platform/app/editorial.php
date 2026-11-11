<?php
declare(strict_types=1);
function editorial_post(PDO $db, string $path, ?array $me): bool {
    if (!in_array($path,['/admin/blog','/admin/users'],true)) return false;
    require_admin($me); $actor=(int)$me['id'];
    if ($path==='/admin/users') {
        $id=(int)($_POST['id'] ?? 0); $active=(string)($_POST['active'] ?? '');
        if (!$id || !in_array($active,['0','1'],true)) { http_response_code(400); exit('Invalid request'); }
        $db->beginTransaction(); $q=$db->prepare("UPDATE users SET active=? WHERE id=? AND role='user'"); $q->execute([(int)$active,$id]); if ($q->rowCount()) log_action($db,$actor,'Changed user #'.$id.' active status to '.$active); $db->commit(); flash('User status updated.'); redirect('/admin/users');
    }
    $id=(int)($_POST['id'] ?? 0); $title=trim((string)($_POST['title'] ?? '')); $slug=trim((string)($_POST['slug'] ?? '')); $summary=trim((string)($_POST['summary'] ?? '')); $body=trim((string)($_POST['body'] ?? '')); $published=isset($_POST['published'])?1:0;
    if ($title==='' || mb_strlen($title)>180 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$slug) || strlen($slug)>180 || mb_strlen($summary)>500 || $body==='' || mb_strlen($body)>50000) { flash('Check the post fields; use a lowercase URL slug.'); redirect('/admin/blog'); }
    try { $db->beginTransaction(); if($id) { $q=$db->prepare('UPDATE blog_posts SET title=?,slug=?,summary=?,body=?,published=? WHERE id=?'); $q->execute([$title,$slug,$summary,$body,$published,$id]); } else { $q=$db->prepare('INSERT INTO blog_posts(title,slug,summary,body,published) VALUES(?,?,?,?,?)'); $q->execute([$title,$slug,$summary,$body,$published]); $id=(int)$db->lastInsertId(); } log_action($db,$actor,'Saved blog post #'.$id); $db->commit(); } catch(PDOException $e) { if ($db->inTransaction()) $db->rollBack(); if ($e->getCode()!=='23000') throw $e; flash('That slug is already in use.'); redirect('/admin/blog'); }
    flash('Post saved.'); redirect('/admin/blog');
}
