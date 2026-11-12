// Run with: node tests/team-bio-limit.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handlers = {}, counter = {};
const field = {
    value: '', selectionStart: 0, selectionEnd: 0,
    addEventListener(name, fn) { handlers[name] = fn; },
    getAttribute() { return 'counter'; },
    setCustomValidity(message) { this.error = message; },
    setRangeText(value, start, end) {
        this.value = this.value.slice(0, start) + value + this.value.slice(end);
        this.selectionStart = this.selectionEnd = start + value.length;
    },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
};
const document = {
    querySelectorAll() { return [field]; }, getElementById() { return counter; },
    addEventListener(name, fn) { handlers['document:' + name] = fn; }
};
vm.runInNewContext(fs.readFileSync('assets/js/admin-team-bio.js', 'utf8'), {document});
function edit(value, selection = value.length) {
    field.value = value; field.selectionStart = field.selectionEnd = selection;
    handlers['document:click']({ target: { closest() { return true; } } });
}
function before(data) {
    let prevented = false;
    handlers.beforeinput({inputType: 'insertText', data, preventDefault() { prevented = true; }});
    return prevented;
}
edit('a'.repeat(299));
assert.match(counter.textContent, /^299 \/ 300 characters/);
assert.equal(field.error, '');
assert.equal(before(' !'), true);
assert.equal(field.value, 'a'.repeat(299) + ' '); // spaces count too
assert.equal(before('b'), true); assert.equal(field.value, 'a'.repeat(299) + ' ');
edit('ক'.repeat(298) + 'ি ');
assert.match(counter.textContent, /^300 \/ 300 characters/); // combining marks and spaces count
assert.equal(before('খ'), true); assert.equal(Array.from(field.value).length, 300);
edit('a'.repeat(299), 150);
handlers.paste({ clipboardData: { getData() { return '😀bc'; } }, preventDefault() {} });
assert.equal(field.value, 'a'.repeat(150) + '😀' + 'a'.repeat(149));
edit('x'.repeat(301)); assert.match(field.error, /300 characters/);
field.value = 'x'.repeat(300); handlers.input({isComposing:false}); assert.equal(field.error, '');
edit('short bio'); assert.equal(field.error, '');
console.log('Team bio character limits passed.');
