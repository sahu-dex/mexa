<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'book';
$pageTitle = 'Book a Service | ' . setting('site_name', 'Mexa Motion');
$pageDescription = setting('book_lead', 'Select a service and package quality to submit your booking ticket.');
$pageScripts = ['assets/js/store.js', 'assets/js/page-book.js?v=20261112-soc'];

$catalog = get_services_with_packages(true);
$services = $catalog['services'];

$requestedServiceId = isset($_GET['service']) ? (int) $_GET['service'] : 0;
$requestedQuality = isset($_GET['quality']) && in_array($_GET['quality'], ['premium', 'high', 'normal'], true)
    ? (string) $_GET['quality']
    : 'high';

$selectedService = $services[0] ?? null;
foreach ($services as $svc) {
    if ((int) $svc['id'] === $requestedServiceId) {
        $selectedService = $svc;
        break;
    }
}

$selectedPackage = null;
if ($selectedService !== null) {
    foreach ($selectedService['packages'] as $pkg) {
        if ($pkg['quality'] === $requestedQuality) {
            $selectedPackage = $pkg;
            break;
        }
    }
    if ($selectedPackage === null && !empty($selectedService['packages'])) {
        $selectedPackage = $selectedService['packages'][0];
    }
}

include dirname(__DIR__) . '/includes/header.php';
?>
<main class="tk-page">
    <div class="container mx-auto px-4 md:px-8">
        <div class="tk-wrap">
            <div class="tk-head">
                <nav class="tk-crumb" aria-label="Breadcrumb">
                    <a href="index.php">Home</a>
                    <i class="fa-solid fa-chevron-right"></i>
                    <a href="service.php">Service</a>
                    <i class="fa-solid fa-chevron-right"></i>
                    <span aria-current="page">Book a ticket</span>
                </nav>
                <h1 class="tk-h1">Book your <span>ticket</span></h1>
                <p class="tk-lead"><?= e(setting('book_lead', 'Your selected service and package are already loaded. Add your project details and the ticket goes straight to the founder with status Pending.')) ?></p>
            </div>

            <div class="tk-sum" id="tk-sum" aria-live="polite">
<?php if ($selectedService !== null && $selectedPackage !== null): ?>
                <div class="tk-sum-top">
                    <div>
                        <span class="tk-sum-kicker">Your selected package</span>
                        <h2 class="tk-sum-name"><?= e($selectedService['name']) ?></h2>
                        <span class="tk-sum-quality"><i class="fa-solid fa-layer-group"></i><?= e($selectedPackage['name']) ?></span>
                    </div>
                    <div class="tk-sum-price"><b>$<?= e(rtrim(rtrim(number_format((float) $selectedPackage['price'], 2, '.', ''), '0'), '.')) ?></b><span>per project</span></div>
                </div>
<?php if ($selectedPackage['description'] !== ''): ?>
                <p class="tk-sum-desc"><?= e($selectedPackage['description']) ?></p>
<?php endif; ?>
                <ul class="tk-sum-feats">
<?php foreach ($selectedPackage['features'] as $pf): ?>
                    <li><i class="fa-solid fa-check"></i><span><?= e($pf) ?></span></li>
<?php endforeach; ?>
                </ul>
<?php endif; ?>
            </div>

            <div class="tk-grid">
                <form class="tk-form" id="tk-form" novalidate>
                    <?= csrf_field() ?>
                    <?= honeypot_field() ?>
                    <div class="tk-steps">
                        <div class="tk-box">
                            <div class="tk-box-head">
                                <span class="tk-num">1</span>
                                <div>
                                    <div class="tk-box-title">Select service</div>
                                    <div class="tk-box-hint">Switch the service — packages and price follow instantly.</div>
                                </div>
                            </div>
                            <div class="tk-select-wrap">
                                <select id="tk-service" name="service_id" class="tk-select" aria-label="Select service">
    <?php foreach ($services as $svc): ?>
                                    <option value="<?= (int) $svc['id'] ?>"<?= ($selectedService !== null && (int) $svc['id'] === (int) $selectedService['id']) ? ' selected' : '' ?>><?= e($svc['name']) ?></option>
    <?php endforeach; ?>
                                </select>
                            </div>
                        </div>

                        <div class="tk-box">
                            <div class="tk-box-head">
                                <span class="tk-num">2</span>
                                <div>
                                    <div class="tk-box-title">Select package quality</div>
                                    <div class="tk-box-hint">Three levels — the price updates as soon as you pick one.</div>
                                </div>
                            </div>
                            <div class="tk-qgrid" id="tk-quality" role="radiogroup" aria-label="Package quality">
    <?php if ($selectedService !== null): ?>
    <?php foreach ($selectedService['packages'] as $pkg): $isOn = ($selectedPackage !== null && $pkg['quality'] === $selectedPackage['quality']); ?>
                                <label class="tk-q<?= $isOn ? ' is-on' : '' ?>" data-quality="<?= e($pkg['quality']) ?>">
                                    <input type="radio" name="tk-quality" value="<?= e($pkg['quality']) ?>"<?= $isOn ? ' checked' : '' ?>>
                                    <b><?= e($pkg['name']) ?></b>
                                    <small><?= e($pkg['revisions'] . ($pkg['delivery'] !== '' ? ' · ' . $pkg['delivery'] : '')) ?></small>
                                    <span class="tk-q-price">$<?= e(rtrim(rtrim(number_format((float) $pkg['price'], 2, '.', ''), '0'), '.')) ?></span>
                                </label>
    <?php endforeach; ?>
    <?php endif; ?>
                            </div>
                        </div>

                        <div class="tk-box">
                            <div class="tk-box-head">
                                <span class="tk-num">3</span>
                                <div>
                                    <div class="tk-box-title">Project details</div>
                                    <div class="tk-box-hint">Footage length, style, deadline, contact email/WhatsApp, references — anything that helps.</div>
                                </div>
                            </div>
                            <textarea id="tk-message" name="message" class="tk-textarea" maxlength="4000" placeholder="Tell us about your project…" aria-label="Project details"></textarea>
                            <div class="tk-counter"><span id="tk-count">0 / 4000</span></div>
                        </div>
                    </div>

                </form>

                <aside class="tk-prev" aria-label="Order preview">
                    <span class="tk-prev-kicker">Order preview</span>
                    <div class="tk-prev-title">Check it before you submit</div>
                    <div class="tk-prev-rows" id="tk-prev-rows">
                        <div class="tk-prev-row"><span>Service</span><b><?= e($selectedService['name'] ?? '—') ?></b></div>
                        <div class="tk-prev-row"><span>Package</span><b><?= e($selectedPackage['name'] ?? '—') ?></b></div>
                        <div class="tk-prev-row"><span>Price</span><b><?= $selectedPackage !== null ? '$' . e(rtrim(rtrim(number_format((float) $selectedPackage['price'], 2, '.', ''), '0'), '.')) : '—' ?></b></div>
                        <div class="tk-prev-row"><span>Delivery</span><b><?= e($selectedPackage['delivery'] ?? '—') ?></b></div>
                    </div>
                    <div class="tk-prev-msg is-empty" id="tk-prev-msg">Your project message will appear here…</div>
                    <div class="tk-err" id="tk-err" hidden></div>
                    <button type="submit" form="tk-form" class="tk-submit" id="tk-submit">
                        <i class="fa-solid fa-paper-plane"></i> Submit Ticket
                    </button>
                    <p class="tk-prev-note">You get a unique ticket reference. The founder reviews it and confirms scope and payment before anything starts.</p>
                </aside>
            </div>

            <section class="tk-founder" id="tk-founder" aria-label="Founder contact"></section>
        </div>
    </div>

    <div class="tk-done" id="tk-done" hidden>
        <div class="tk-done-box" role="dialog" aria-modal="true" aria-labelledby="tk-done-title">
            <div class="tk-done-tick"><i class="fa-solid fa-check"></i></div>
            <h3 id="tk-done-title">Ticket submitted</h3>
            <p>Your ticket is in the founder's queue with status <b>Pending</b>. Keep this reference — we use it in every reply.</p>
            <div class="tk-done-ref"><span>Ticket</span> <b id="tk-done-ref">—</b></div>
            <div class="tk-done-actions">
                <button type="button" class="tk-submit" data-tk-close-done>Close</button>
                <a class="tk-link" href="service.php"><i class="fa-solid fa-arrow-left"></i> Back to services</a>
            </div>
        </div>
    </div>
</main>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
