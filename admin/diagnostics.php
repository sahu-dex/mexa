<?php
declare(strict_types=1);
$adminPage = 'diagnostics';
$adminTitle = 'cPanel / Server Diagnostics';
require_once dirname(__DIR__) . '/includes/admin_header.php';
$pdo = null;
$dbStatus = 'unknown';
$dbError = null;
$tables = [];
try {
    $pdo = db();
    $pdo->query('SELECT 1');
    $dbStatus = 'connected';
    // Check tables
    $expected = ['settings','services','packages','work_items','team_members','reviews','messages','admins'];
    foreach ($expected as $t) {
        try {
            $c = (int) $pdo->query("SELECT COUNT(*) FROM `{$t}`")->fetchColumn();
            $tables[$t] = ['exists'=>true, 'count'=>$c];
        } catch (Throwable $e) {
            $tables[$t] = ['exists'=>false, 'count'=>0, 'error'=>$e->getMessage()];
            $dbStatus = 'partial';
        }
    }
} catch (Throwable $e) {
    $dbStatus = 'error';
    $dbError = $e->getMessage();
}
$phpOk = version_compare(PHP_VERSION, '8.0.0', '>=');
$ext = [
    'pdo_mysql' => extension_loaded('pdo_mysql'),
    'mbstring'  => extension_loaded('mbstring'),
    'fileinfo'  => extension_loaded('fileinfo'),
    'gd'        => extension_loaded('gd'),
    'curl'      => extension_loaded('curl'),
];
$writable = [
    'storage' => is_writable(MEXA_STORAGE_DIR),
    'storage/logs' => is_writable(MEXA_STORAGE_DIR . '/logs'),
    'storage/ratelimits' => is_writable(MEXA_STORAGE_DIR . '/ratelimits'),
    'uploads' => is_writable(MEXA_UPLOADS_DIR),
    'uploads/images' => is_writable(MEXA_UPLOADS_DIR . '/images'),
    'uploads/videos' => is_writable(MEXA_UPLOADS_DIR . '/videos'),
];
$envExists = is_file(MEXA_ROOT . '/.env');
$htaccessRoot = is_file(MEXA_ROOT . '/.htaccess');
$htaccessUploads = is_file(MEXA_UPLOADS_DIR . '/.htaccess');
$htaccessStorage = is_file(MEXA_STORAGE_DIR . '/.htaccess');
?>
<div class="adm-page-head">
  <h1>cPanel Diagnostics</h1>
  <p>Teacher / hosting check - sob green hole production ready.</p>
</div>

<style>
.diag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin:16px 0}
.diag-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
.diag-card h3{margin:0 0 10px;font-size:14px;font-weight:800;color:#0f172a}
.diag-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.diag-row:last-child{border:0}
.badge-ok{background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.badge-bad{background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.badge-warn{background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
code{background:#f1f5f9;padding:2px 6px;border-radius:6px;font-size:12px}
</style>

<div class="diag-grid">
  <div class="diag-card">
    <h3>Environment (.env)</h3>
    <div class="diag-row"><span>File exists: <code>.env</code></span><span class="<?= $envExists?'badge-ok':'badge-bad' ?>"><?= $envExists?'OK':'MISSING' ?></span></div>
    <div class="diag-row"><span>APP_ENV</span><span><code><?= e(APP_ENV) ?></code></span></div>
    <div class="diag-row"><span>APP_URL</span><span><code><?= e(APP_URL) ?></code></span></div>
    <div class="diag-row"><span>APP_TIMEZONE</span><span><code><?= e(APP_TIMEZONE) ?></code></span></div>
    <div class="diag-row"><span>Root .htaccess</span><span class="<?= $htaccessRoot?'badge-ok':'badge-bad' ?>"><?= $htaccessRoot?'OK':'MISSING' ?></span></div>
    <div class="diag-row"><span>uploads/.htaccess (php engine off)</span><span class="<?= $htaccessUploads?'badge-ok':'badge-bad' ?>"><?= $htaccessUploads?'OK':'MISSING' ?></span></div>
    <div class="diag-row"><span>storage/.htaccess (deny all)</span><span class="<?= $htaccessStorage?'badge-ok':'badge-bad' ?>"><?= $htaccessStorage?'OK':'MISSING' ?></span></div>
  </div>

  <div class="diag-card">
    <h3>PHP & Extensions</h3>
    <div class="diag-row"><span>PHP Version <code><?= e(PHP_VERSION) ?></code></span><span class="<?= $phpOk?'badge-ok':'badge-bad' ?>"><?= $phpOk?'OK ≥8.0':'NEED ≥8.0' ?></span></div>
    <?php foreach ($ext as $name=>$ok): ?>
      <div class="diag-row"><span><?= e($name) ?></span><span class="<?= $ok?'badge-ok':'badge-bad' ?>"><?= $ok?'OK':'MISSING' ?></span></div>
    <?php endforeach; ?>
    <div class="diag-row"><span>display_errors (should be Off in production)</span><span><code><?= e(ini_get('display_errors') ?: '0') ?></code></span></div>
  </div>

  <div class="diag-card">
    <h3>Writable Directories (need 755)</h3>
    <?php foreach ($writable as $path=>$ok): ?>
      <div class="diag-row"><span><code><?= e($path) ?></code></span><span class="<?= $ok?'badge-ok':'badge-bad' ?>"><?= $ok?'Writable':'Not writable' ?></span></div>
    <?php endforeach; ?>
    <?php if (in_array(false, $writable, true)): ?>
      <p style="font-size:12px;color:#991b1b;margin:8px 0 0">Fix: File Manager → right-click → Permissions → 755</p>
    <?php endif; ?>
  </div>

  <div class="diag-card">
    <h3>Database</h3>
    <div class="diag-row"><span>Status</span><span class="<?= $dbStatus==='connected'?'badge-ok':($dbStatus==='partial'?'badge-warn':'badge-bad') ?>"><?= e($dbStatus) ?></span></div>
    <?php if ($dbError): ?><div class="diag-row"><span>Error</span><span><code style="max-width:180px;overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:middle"><?= e($dbError) ?></code></span></div><?php endif; ?>
    <?php foreach ($tables as $t=>$info): ?>
      <div class="diag-row"><span><code><?= e($t) ?></code> <?= $info['exists'] ? '('.(int)$info['count'].' rows)' : '' ?></span><span class="<?= $info['exists']?'badge-ok':'badge-bad' ?>"><?= $info['exists']?'OK':'MISSING' ?></span></div>
    <?php endforeach; ?>
    <?php if ($dbStatus==='error'): ?>
      <p style="font-size:12px;color:#991b1b;margin:8px 0 0">Check <code>.env</code> DB_HOST / DB_NAME / DB_USER / DB_PASS + phpMyAdmin import schema.sql & seed.sql</p>
    <?php endif; ?>
  </div>
</div>

<div class="diag-card" style="margin-top:12px">
  <h3>Security Quick Check (manual)</h3>
  <p style="font-size:13px;line-height:1.6;color:#334155">
    Browser e test korun — sob <b>403 Forbidden</b> asa uchit:<br>
    <code><?= e(APP_URL) ?>/.env</code> &nbsp; <code><?= e(APP_URL) ?>/config/config.php</code> &nbsp; <code><?= e(APP_URL) ?>/storage/logs/php-error.log</code><br>
    Jodi 403 na ase → <code>.htaccess</code> active na (hosting ke bolun <code>AllowOverride All</code> enable korte).
  </p>
  <p style="font-size:13px;line-height:1.6;color:#334155">
    Railway preview (Dockerfile, railway.json) cPanel-এ ignore হয় — kono khoti kore na. Production cPanel-ei cholbe.
  </p>
</div>

<p style="margin-top:16px">
  <a href="index.php" class="adm-btn">← Dashboard</a>
  <a href="../api/health.php" target="_blank" class="adm-btn adm-btn-ghost">Public health.php (JSON)</a>
</p>

<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
