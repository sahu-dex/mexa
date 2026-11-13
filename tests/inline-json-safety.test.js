const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('inline script data escapes HTML-sensitive characters', () => {
    const footer = fs.readFileSync(path.join(__dirname, '..', 'includes', 'footer.php'), 'utf8');
    const assignments = footer.match(/window\.__MM_(?:DEMO_DATA|SHOWREEL_URL|TAGLINE)__\s*=\s*<\?=\s*json_encode\([^\n]+/g) || [];
    assert.equal(assignments.length, 3);
    for (const assignment of assignments) {
        for (const flag of ['JSON_HEX_TAG', 'JSON_HEX_AMP', 'JSON_HEX_APOS', 'JSON_HEX_QUOT']) {
            assert.ok(assignment.includes(flag), `${flag} missing from inline JSON`);
        }
    }
});
