// Run with: node tests/review-form.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
    return {
        handlers: {}, value: '', hidden: false, dataset: {}, files: [],
        classList: { toggle() {} }, style: {},
        addEventListener(type, fn) { this.handlers[type] = fn; },
        setAttribute() {}, scrollIntoView() {}, focus() {}, click() {},
        insertAdjacentHTML() {}, querySelectorAll() { return []; },
        querySelector() { return null; }, reset() {}
    };
}
const ids = {};
['rvx-form', 'rvx-rate', 'rvx-rating', 'rvx-name', 'rvx-role', 'rvx-body', 'rvx-photo', 'rvx-photo-remove', 'rvx-err', 'rvx-send', 'rvx-modal-id'].forEach(id => { ids[id] = element(); });
ids['rvx-photo'].dataset.maxBytes = String(5 * 1024 * 1024);
const requests = [];
class FormDataMock {
    constructor() { this.values = {}; }
    append(key, value) { this.values[key] = value; }
}
class FileReaderMock { readAsDataURL() { this.result = 'data:image/png;base64,AA=='; this.onload(); } }
const document = { getElementById(id) { return ids[id] || null; }, querySelectorAll() { return []; }, addEventListener() {}, body: { style: {} } };
const context = { document, window: { __MM_DEMO_DATA__: {}, location: { hash: '' } }, FormData: FormDataMock, FileReader: FileReaderMock,
    fetch: async (url, options) => { requests.push(options.body.values); return { ok: true, json: async () => ({ok:true, id:42}) }; }, console };
vm.runInNewContext(fs.readFileSync('assets/js/page-review.js', 'utf8'), context);
const submit = () => ids['rvx-form'].handlers.submit({ preventDefault() {} });
const star = { getAttribute() { return '5'; } };
const choosePhoto = file => { ids['rvx-photo'].files = file ? [file] : []; ids['rvx-photo'].handlers.change({target:ids['rvx-photo']}); };

(async function () {
    await submit(); assert.match(ids['rvx-err'].textContent, /rating/i); assert.equal(requests.length, 0);
    ids['rvx-rate'].handlers.click({target:{closest(){return star;}}});
    await submit(); assert.match(ids['rvx-err'].textContent, /name/i);
    ids['rvx-name'].value = 'Client'; await submit(); assert.match(ids['rvx-err'].textContent, /title/i);
    ids['rvx-role'].value = 'Creator'; ids['rvx-body'].value = 'An excellent review of this service.';
    await submit(); assert.match(ids['rvx-err'].textContent, /photo/i); assert.equal(requests.length, 0);
    choosePhoto({name:'bad.txt', type:'text/plain', size:5}); await submit(); assert.match(ids['rvx-err'].textContent, /JPG/i);
    choosePhoto({name:'large.png', type:'image/png', size:6 * 1024 * 1024}); await submit(); assert.match(ids['rvx-err'].textContent, /MB/i);
    const image = {name:'portrait.png', type:'image/png', size:100}; choosePhoto(image);
    ids['rvx-photo-remove'].handlers.click(); await submit(); assert.match(ids['rvx-err'].textContent, /photo/i);
    choosePhoto(image); ids['rvx-body'].value = 'short'; await submit(); assert.match(ids['rvx-err'].textContent, /15 and 900/i);
    ids['rvx-body'].value = 'An excellent review of this service.'; await submit();
    assert.equal(requests.length, 1); assert.equal(requests[0].photo, image); assert.equal(requests[0].role, 'Creator');
    assert.equal(ids['rvx-modal-id'].textContent, '#42');
    console.log('Review form validation and submission passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
