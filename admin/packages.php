<?php
declare(strict_types=1);

$adminPage = 'packages';
$adminTitle = 'Packages & Pricing';
require_once dirname(__DIR__) . '/includes/admin_header.php';

$catalog = get_services_with_packages(false);
$services = $catalog['services'];
$filterServiceId = isset($_GET['service_id']) ? (int) $_GET['service_id'] : 0;
?>
<div class="adm-card">
    <div class="adm-card-head">
        <div>
            <h2>Service Packages &amp; Tiers</h2>
            <p>Each service offers Normal, High, and Premium quality tiers used on the Service page and Booking calculator.</p>
        </div>
        <div class="adm-actions">
            <form method="get" action="packages.php" class="adm-actions">
                <select class="adm-select" name="service_id" onchange="this.form.submit()" style="width:240px">
                    <option value="0">All Services</option>
<?php foreach ($services as $s): ?>
                    <option value="<?= (int) $s['id'] ?>"<?= $filterServiceId === (int) $s['id'] ? ' selected' : '' ?>><?= e($s['name']) ?></option>
<?php endforeach; ?>
                </select>
            </form>
            <button type="button" class="adm-btn adm-btn-primary" data-modal-open="pkg-modal" data-title="Add / Upsert Package Tier">
                <i class="fa-solid fa-plus"></i> Add Tier
            </button>
        </div>
    </div>

    <div class="adm-table-wrap">
        <table class="adm-table">
            <thead>
                <tr>
                    <th>Service</th>
                    <th>Tier Quality</th>
                    <th>Display Name</th>
                    <th>Price</th>
                    <th>Delivery &amp; Revisions</th>
                    <th>Badge</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
<?php foreach ($services as $s):
    if ($filterServiceId > 0 && (int) $s['id'] !== $filterServiceId) {
        continue;
    }
    foreach ($s['packages'] as $pkg):
        $rowJson = htmlspecialchars(json_encode([
            'id' => $pkg['id'],
            'service_id' => $pkg['serviceId'],
            'quality' => $pkg['quality'],
            'name' => $pkg['name'],
            'price' => $pkg['price'],
            'currency' => $pkg['currency'],
            'delivery_time' => $pkg['delivery'],
            'revisions' => $pkg['revisions'],
            'badge' => $pkg['badge'],
            'is_highlighted' => $pkg['highlight'] ? 1 : 0,
            'description' => $pkg['description'],
            'features' => $pkg['features'],
            'sort_order' => $pkg['sort_order'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ENT_QUOTES, 'UTF-8');
?>
                <tr>
                    <td><b><?= e($s['name']) ?></b></td>
                    <td><span class="adm-badge adm-badge-active"><?= e($pkg['quality']) ?></span></td>
                    <td><?= e($pkg['name']) ?></td>
                    <td><b>$<?= e(number_format((float) $pkg['price'], 2)) ?></b> <small><?= e($pkg['currency']) ?></small></td>
                    <td><?= e($pkg['delivery']) ?> · <?= e($pkg['revisions']) ?></td>
                    <td><?= $pkg['badge'] !== '' ? e($pkg['badge']) : '—' ?><?= $pkg['highlight'] ? ' ★' : '' ?></td>
                    <td class="adm-actions">
                        <button type="button" class="adm-btn adm-btn-sm" data-modal-open="pkg-modal" data-title="Edit Package Tier" data-row="<?= $rowJson ?>">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button type="button" class="adm-btn adm-btn-sm adm-btn-danger" data-quick-api="../api/admin/packages.php" data-action="delete" data-id="<?= (int) $pkg['id'] ?>" data-confirm="Delete this package tier?">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
<?php endforeach; endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<div class="adm-modal" id="pkg-modal" hidden>
    <div class="adm-modal-box">
        <div class="adm-modal-head">
            <h3 data-modal-title>Edit Package</h3>
            <button type="button" class="adm-btn adm-btn-sm" data-modal-close>&times; Close</button>
        </div>
        <form data-adm-api="../api/admin/packages.php">
            <input type="hidden" name="action" value="create">
            <input type="hidden" name="id" value="0">
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Service *</label>
                    <select class="adm-select" name="service_id" required>
<?php foreach ($services as $s): ?>
                        <option value="<?= (int) $s['id'] ?>"><?= e($s['name']) ?></option>
<?php endforeach; ?>
                    </select>
                </div>
                <div class="adm-field">
                    <label>Quality Tier *</label>
                    <select class="adm-select" name="quality" required>
                        <option value="normal">normal</option>
                        <option value="high">high</option>
                        <option value="premium">premium</option>
                    </select>
                </div>
            </div>
            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Display Name *</label>
                    <input class="adm-input" type="text" name="name" value="High Quality" required maxlength="80">
                </div>
                <div class="adm-field">
                    <label>Price (USD) *</label>
                    <input class="adm-input" type="number" step="0.01" min="0" name="price" required>
                </div>
                <div class="adm-field">
                    <label>Currency</label>
                    <input class="adm-input" type="text" name="currency" value="USD" maxlength="8">
                </div>
            </div>
            <div class="adm-grid-3">
                <div class="adm-field">
                    <label>Delivery Time</label>
                    <input class="adm-input" type="text" name="delivery_time" placeholder="2–3 Days" maxlength="80">
                </div>
                <div class="adm-field">
                    <label>Revisions</label>
                    <input class="adm-input" type="text" name="revisions" placeholder="4 Revisions" maxlength="80">
                </div>
                <div class="adm-field">
                    <label>Ribbon Badge</label>
                    <input class="adm-input" type="text" name="badge" placeholder="Most Popular" maxlength="60">
                </div>
            </div>
            <div class="adm-grid-2">
                <div class="adm-field">
                    <label>Sort Order</label>
                    <input class="adm-input" type="number" name="sort_order" value="1">
                </div>
                <div class="adm-field" style="justify-content:flex-end">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                        <input type="checkbox" name="is_highlighted" value="1"> Highlight as Featured Tier
                    </label>
                </div>
            </div>
            <div class="adm-field">
                <label>Tier Summary</label>
                <textarea class="adm-textarea" name="description"></textarea>
            </div>
            <div class="adm-field">
                <label>Included Deliverables (one feature per line)</label>
                <textarea class="adm-textarea" name="features" placeholder="4K Master Export&#10;Sound Design &amp; Mixing&#10;Color Grading"></textarea>
            </div>
            <div class="adm-actions" style="justify-content:flex-end">
                <button type="button" class="adm-btn" data-modal-close>Cancel</button>
                <button type="submit" class="adm-btn adm-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save Package</button>
            </div>
        </form>
    </div>
</div>
<?php require_once dirname(__DIR__) . '/includes/admin_footer.php'; ?>
