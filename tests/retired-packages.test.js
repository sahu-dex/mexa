'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
test('catalog and service screens do not depend on package records', () => {
    for (const file of ['includes/functions.php', 'pages/service.php', 'pages/index.php', 'api/services.php', 'api/admin/services.php', 'assets/js/page-service.js', 'assets/js/store.js']) {
        assert.doesNotMatch(read(file), /get_services_with_packages|\bFROM `packages`|\bINTO `packages`|data-buy-service|book\.php\?service|renderPackageSection/);
    }
    assert.doesNotMatch(read('includes/header.php'), /#packages|book\.php|Booking Now/);
    assert.doesNotMatch(read('admin/services.php'), /packages\.php|<th>Packages<\/th>/);
});
test('fresh seed does not recreate packages and migration preserves messages', () => {
    assert.equal(Object.hasOwn(JSON.parse(read('database/seed-data.json')), 'packages'), false);
    assert.doesNotMatch(read('database/schema.sql'), /CREATE TABLE IF NOT EXISTS `packages`/);
    assert.doesNotMatch(read('database/seed.sql'), /(?:INSERT INTO|DELETE FROM) `packages`/);
    assert.match(read('database/remove-packages.sql'), /DROP TABLE `packages`/);
    assert.doesNotMatch(read('database/remove-packages.sql'), /DELETE FROM `messages`/);
});
test('retired endpoints cannot accept new submissions', () => {
    for (const file of ['book.php','api/submit-booking.php','api/admin/packages.php','admin/packages.php']) {
        assert.match(read(file), /http_response_code\(410\)/);
    }
});
