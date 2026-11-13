const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

test('video cards and player dialogs do not render per-video metadata', () => {
    const home = read('pages/index.php');
    const work = read('pages/work.php');
    const workJs = read('assets/js/page-work.js');
    assert.doesNotMatch(home, /class="mmvp-meta"/);
    assert.doesNotMatch(work, /class="(?:info|cap)"|id="wk-modal-(?:title|desc)"/);
    assert.doesNotMatch(workJs, /class="(?:info|cap|wk-rc-featured)"|wk-modal-(?:title|desc)/);
    assert.match(workJs, /controls autoplay playsinline/);
    assert.match(workJs, /allowfullscreen/);
    assert.match(read('assets/js/home-work-preview.js'), /video\.controls = true/);
});
