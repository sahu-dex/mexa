'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const exists = name => fs.existsSync(path.join(root, name));
const count = (text, pattern) => (text.match(pattern) || []).length;

const player = require('../assets/js/mm-video-player.js');
const playerJs = read('assets/js/mm-video-player.js');
const playerCss = read('assets/css/mm-video-player.css');
const template = player.TEMPLATE;

const PAGE_TEMPLATES = ['pages/index.php', 'pages/work.php', 'pages/service.php'];
const PAGE_CONTROLLERS = [
    'assets/js/home-work-preview.js',
    'assets/js/page-work.js',
    'assets/js/page-service.js',
    'assets/js/site-common.js',
];

test('video cards and player dialogs do not render per-video metadata', () => {
    const home = read('pages/index.php');
    const work = read('pages/work.php');
    const workJs = read('assets/js/page-work.js');
    assert.doesNotMatch(home, /class="mmvp-meta"/);
    assert.doesNotMatch(work, /class="(?:info|cap)"|id="wk-modal-(?:title|desc)"/);
    assert.doesNotMatch(workJs, /class="(?:info|cap|wk-rc-featured)"|wk-modal-(?:title|desc)/);

    // The player itself has no title / description slot at all…
    assert.doesNotMatch(template, /<h[1-6]\b|<p\b|<figcaption\b|mmp-(?:title|desc|meta|caption|heading)/);
    // …its only visible words are the time read-out and the two message-panel buttons…
    const words = template.replace(/<[^>]*>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
    assert.deepEqual(words, ['0:00', '0:00', '/', '0:00', 'Try again', 'Open in a new tab']);
    // …and an item's title only ever reaches assistive technology, never the screen.
    assert.doesNotMatch(playerJs, /(?:textContent|innerText|innerHTML)\s*=[^;\n]*\btitle\b/);
});

test('the shared player has exactly one close button, drawn as a single cross', () => {
    assert.equal(count(template, /<button\b[^>]*\bdata-mmp-close\b/g), 1);
    assert.equal(count(template, /class="mmp-close"/g), 1);
    assert.equal(count(template, /data-mmp-close/g), 1);

    const button = /<button\b[^>]*\bdata-mmp-close\b[^>]*>([\s\S]*?)<\/button>/.exec(template);
    assert.ok(button, 'close button markup');
    assert.match(button[0], /aria-label="Close video"/);
    const inner = button[1];
    // One SVG holding one cross: no text node, entity, icon font or image that could double it.
    assert.equal(count(inner, /<svg\b/g), 1);
    assert.equal(count(inner, /class="mmp-close-x"/g), 1);
    assert.equal(inner.replace(/<[^>]*>/g, '').trim(), '');
    assert.doesNotMatch(inner, /<i\b|<img\b|<span\b|&times;|×|✕|✖/);

    // Nowhere else in the player either.
    assert.doesNotMatch(template, /&times;|×|✕|✖|fa-xmark|fa-times|fa-close/);
    assert.doesNotMatch(playerCss, /content:\s*['"](?:\\00d7|\\d7|×|✕|✖|x|X)['"]/i);
    // Site-wide button rules cannot add a pseudo-element glyph to it.
    assert.match(playerCss, /\.mmp \.mmp-close::before,\s*\.mmp \.mmp-close::after\s*\{[^}]*content:\s*none\s*!important/);

    // The dark backdrop also dismisses the player, but it is not a second button.
    assert.match(template, /<div class="mmp-backdrop" data-mmp-dismiss><\/div>/);
    // The markup is injected once and the script is safe to include twice.
    assert.equal(count(playerJs, /\.innerHTML\s*=/g), 1);
    assert.match(playerJs, /window\.MMPlayer && window\.MMPlayer\.__mmPlayer\) return;/);
});

test('the shared player offers play/pause, 10 second skips, progress, volume and fullscreen', () => {
    assert.equal(player.SKIP_SECONDS, 10);

    assert.equal(count(template, /data-mmp-toggle/g), 2); // centre button + control bar
    assert.equal(count(template, /data-mmp-back\b/g), 1);
    assert.equal(count(template, /data-mmp-forward\b/g), 1);
    assert.match(template, /data-mmp-back aria-label="Rewind 10 seconds"/);
    assert.match(template, /data-mmp-forward aria-label="Forward 10 seconds"/);
    assert.match(template, /data-mmp-progress role="slider"[^>]*aria-label="Seek"/);
    assert.match(template, /data-mmp-mute aria-label="Mute"/);
    assert.match(template, /data-mmp-volume role="slider"[^>]*aria-label="Volume"/);
    assert.match(template, /data-mmp-fullscreen aria-label="Full screen"/);

    // Rewind sits on the left, Play/Pause in the middle, Forward on the right.
    const back = template.indexOf('data-mmp-back');
    const big = template.indexOf('class="mmp-bigplay"');
    const forward = template.indexOf('data-mmp-forward');
    assert.ok(back > -1 && back < big && big < forward, 'centre controls order');

    // Every control is a real button / slider with an accessible name.
    for (const tag of template.match(/<button\b[^>]*>/g)) {
        assert.match(tag, /type="button"/);
        if (!/data-mmp-retry/.test(tag)) assert.match(tag, /aria-label="[^"]+"/);
    }

    // Uploaded files use these controls, never the browser's own control bar.
    assert.match(playerJs, /video\.controls = false;/);
    assert.doesNotMatch(playerJs, /\bvideo\.controls = true|setAttribute\('controls'/);
});

test('Home, Work and Service all open media in the one shared player', () => {
    for (const file of PAGE_CONTROLLERS) {
        const source = read(file);
        assert.match(source, /MMPlayer\.open\(/, `${file} opens the shared player`);
        // No page builds its own player, dialog or close button any more.
        assert.doesNotMatch(source, /<video\b|<iframe\b|createElement\(['"](?:video|iframe)['"]\)/, `${file} builds no player`);
        assert.doesNotMatch(source, /controls autoplay|allowfullscreen|&times;|fa-xmark|fa-times/, `${file} has no player chrome`);
        assert.doesNotMatch(source, /(?:mm-work-modal|showreel-modal|wk-modal|sv2-modal|sv2-video-stage|mmvp-)/, `${file} has no legacy dialog`);
    }
    for (const file of PAGE_TEMPLATES) {
        const source = read(file);
        assert.doesNotMatch(source, /id="(?:mm-work-modal|showreel-modal|wk-modal|sv2-video|sv2-image)"/, `${file} has no legacy dialog`);
        assert.doesNotMatch(source, /class="[^"]*(?:mmvp-|wk-modal|sv2-modal|showreel-modal)/, `${file} has no legacy dialog`);
        assert.doesNotMatch(source, /&times;/, `${file} has no hand-written close glyph`);
    }
});

test('player assets load once, and only on the pages that play video', () => {
    const functions = read('includes/functions.php');
    const footer = read('includes/footer.php');

    const pages = /function page_uses_video_player\(string \$pageKey\): bool\s*\{\s*return in_array\(\$pageKey, \[([^\]]*)\], true\);/.exec(functions);
    assert.ok(pages, 'page_uses_video_player()');
    assert.deepEqual(pages[1].split(',').map(s => s.trim().replace(/'/g, '')).sort(), ['home', 'service', 'work']);

    assert.equal(count(functions, /return 'assets\/js\/mm-video-player\.js\?v=[\w-]+';/g), 1);
    assert.equal(count(functions, /return 'assets\/css\/mm-video-player\.css\?v=[\w-]+';/g), 1);
    assert.equal(count(functions, /\$stylesheets\[\] = video_player_stylesheet\(\);/g), 1);
    assert.equal(count(footer, /video_player_script\(\)/g), 1);
    assert.match(footer, /page_uses_video_player\(/);
    // The player must be ready before the page controllers that call it.
    assert.ok(footer.indexOf('video_player_script()') < footer.lastIndexOf('$pageScripts'), 'player loads before page scripts');

    assert.ok(exists('assets/js/mm-video-player.js'));
    assert.ok(exists('assets/css/mm-video-player.css'));

    // The per-page player styles that used to fight each other are gone for good.
    for (const retired of ['assets/css/video-preview.css', 'assets/css/video-close-button.css']) {
        assert.equal(exists(retired), false, `${retired} is removed`);
    }
    const scan = dir => fs.readdirSync(path.join(root, dir))
        .filter(name => /\.(?:php|js|css|html)$/.test(name))
        .map(name => `${dir}/${name}`);
    for (const file of [...scan('includes'), ...scan('pages'), ...scan('assets/js'), ...scan('assets/css')]) {
        assert.doesNotMatch(read(file), /video-preview\.css|video-close-button\.css/, `${file} does not reference retired styles`);
    }
});
