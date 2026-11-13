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

// Where every element of the player sits: [{ tag, cls, attrs, path }] with
// `path` listing the classes of its ancestors, outermost first.
const VOID = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'img', 'br', 'input']);
const elements = (() => {
    const out = [];
    const stack = [];
    for (const match of template.matchAll(/<(\/?)([a-z0-9]+)\b([^>]*)>/gi)) {
        const [, closing, tag, attrs] = match;
        if (closing) { stack.pop(); continue; }
        const cls = (/\bclass="([^"]*)"/.exec(attrs) || [, ''])[1];
        out.push({ tag, cls, attrs, path: stack.slice() });
        if (!VOID.has(tag.toLowerCase()) && !/\/\s*$/.test(attrs)) stack.push(cls.split(' ')[0] || tag);
    }
    assert.equal(stack.length, 0, 'player markup is balanced');
    return out;
})();
const find = pattern => elements.filter(node => pattern.test(node.attrs));
const one = pattern => {
    const hits = find(pattern);
    assert.equal(hits.length, 1, `exactly one element matching ${pattern}`);
    return hits[0];
};

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
    // …its only visible words are the two message-panel buttons and the time read-outs
    // (seek tooltip, time played, full length)…
    const words = template.replace(/<[^>]*>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
    assert.deepEqual(words, ['Try again', 'Open in a new tab', '0:00', '0:00', '0:00']);
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

    // One of each control: nothing is doubled.
    for (const control of ['toggle', 'back', 'forward', 'progress', 'mute', 'volume', 'fullscreen']) {
        assert.equal(count(template, new RegExp(`data-mmp-${control}\\b`, 'g')), 1, control);
    }
    assert.match(template, /data-mmp-toggle aria-label="Play"/);
    assert.match(template, /data-mmp-back aria-label="Rewind 10 seconds"/);
    assert.match(template, /data-mmp-forward aria-label="Forward 10 seconds"/);
    assert.match(template, /data-mmp-progress role="slider"[^>]*aria-label="Seek"/);
    assert.match(template, /data-mmp-mute aria-label="Mute"/);
    assert.match(template, /data-mmp-volume role="slider"[^>]*aria-label="Volume"/);
    assert.match(template, /data-mmp-fullscreen aria-label="Full screen"/);

    // Rewind 10s sits left of Play / Pause and Forward 10s right of it, side by side.
    const order = ['data-mmp-back', 'data-mmp-toggle', 'data-mmp-forward'].map(name => template.indexOf(name));
    assert.ok(order[0] > -1 && order[0] < order[1] && order[1] < order[2], 'rewind · play · forward');
    for (const name of ['back', 'toggle', 'forward']) {
        assert.deepEqual(one(new RegExp(`data-mmp-${name}\\b`)).path, ['mmp-layout', 'mmp-frame', 'mmp-dock', 'mmp-row', 'mmp-group'], name);
    }
    const centre = /<div class="mmp-group mmp-group-center">([\s\S]*?)<\/div>/.exec(template);
    assert.ok(centre, 'centre group');
    assert.deepEqual(centre[1].match(/data-mmp-(?:back|toggle|forward)\b/g), ['data-mmp-back', 'data-mmp-toggle', 'data-mmp-forward']);
    // Time played stands left of them and the full length right: Play stays in the middle.
    assert.ok(template.indexOf('data-mmp-current') < order[0], 'time played before the buttons');
    assert.ok(template.indexOf('data-mmp-duration') > order[2], 'full length after the buttons');
    assert.ok(template.indexOf('data-mmp-duration') < template.indexOf('data-mmp-fullscreen'), 'full length before Full screen');

    // Every control is a real button / slider with an accessible name.
    for (const tag of template.match(/<button\b[^>]*>/g)) {
        assert.match(tag, /type="button"/);
        if (!/data-mmp-retry/.test(tag)) assert.match(tag, /aria-label="[^"]+"/);
    }

    // Uploaded files use these controls, never the browser's own control bar.
    assert.match(playerJs, /video\.controls = false;/);
    assert.doesNotMatch(playerJs, /\bvideo\.controls = true|setAttribute\('controls'/);
});

test('nothing is placed over the video: controls live in the dock under it', () => {
    // The picture area holds the media, a loading spinner behind it, the poster
    // and the message panel. No control of any kind.
    const stage = one(/class="mmp-stage"/);
    assert.deepEqual(stage.path, ['mmp-layout', 'mmp-frame']);
    const inStage = elements.filter(node => node.path.includes('mmp-stage'));
    assert.ok(inStage.length > 0);
    for (const node of inStage) {
        assert.doesNotMatch(node.attrs, /data-mmp-(?:toggle|back|forward|progress|mute|volume|fullscreen|close|prev|next|dismiss)\b/, node.attrs);
        if (node.tag === 'button') assert.match(node.attrs, /data-mmp-retry/, 'the only button in the picture area is "Try again" of the error message');
    }
    assert.deepEqual(one(/data-mmp-media\b/).path, ['mmp-layout', 'mmp-frame', 'mmp-stage']);

    // The dock follows the picture inside the same frame, so it also goes fullscreen with it.
    const dock = one(/data-mmp-dock\b/);
    assert.deepEqual(dock.path, ['mmp-layout', 'mmp-frame']);
    assert.ok(template.indexOf('class="mmp-stage"') < template.indexOf('class="mmp-dock"'), 'dock comes after the picture');
    for (const control of ['toggle', 'back', 'forward', 'progress', 'mute', 'volume', 'fullscreen', 'current', 'duration']) {
        const node = one(new RegExp(`data-mmp-${control}\\b`));
        assert.ok(node.path.includes('mmp-dock') && !node.path.includes('mmp-stage'), `${control} is in the dock`);
    }

    // The earlier overlay design is gone: no centre play button, click layer or bar on the video.
    assert.doesNotMatch(template, /mmp-(?:bigplay|shield|bar|overlay|center|controls)\b/);
    assert.doesNotMatch(playerCss, /\.mmp-(?:bigplay|shield|bar|overlay)\b/);
    assert.doesNotMatch(playerJs, /is-idle|mmp-shield|mmp-bigplay/);
    // An embed is never cropped, scaled or made unclickable to hide the provider's own screen.
    for (const rule of playerCss.match(/[^{}]*\{[^{}]*\}/g)) {
        const [selector, body] = [rule.slice(0, rule.indexOf('{')), rule.slice(rule.indexOf('{'))];
        if (/iframe|mmp-embed|mmp-media\b/.test(selector)) {
            assert.doesNotMatch(body, /pointer-events\s*:\s*none|transform\s*:|clip-path|\bscale\b|margin(?:-top|-bottom)?\s*:\s*-/, selector.trim());
        }
    }
});

test('Previous / Next video buttons stand beside the player, one of each', () => {
    const prev = one(/data-mmp-prev\b/);
    const next = one(/data-mmp-next\b/);
    for (const [node, label] of [[prev, 'Previous video'], [next, 'Next video']]) {
        assert.equal(node.tag, 'button');
        assert.match(node.attrs, /type="button"/);
        assert.match(node.attrs, new RegExp(`aria-label="${label}"`));
        // Outside the frame: never on the picture, never inside the dock.
        assert.deepEqual(node.path, ['mmp-layout']);
        // Hidden until a gallery of two or more videos is opened.
        assert.match(node.attrs, /\bhidden\b/);
    }
    // Reading order = visual order: × · previous · player · next.
    const at = name => template.indexOf(name);
    assert.ok(at('data-mmp-close') < at('data-mmp-prev') && at('data-mmp-prev') < at('class="mmp-frame"') && at('class="mmp-dock"') < at('data-mmp-next'), 'order');
    // Icon only, like the ×: a single chevron and no text.
    for (const name of ['prev', 'next']) {
        const inner = new RegExp(`<button\\b[^>]*\\bdata-mmp-${name}\\b[^>]*>([\\s\\S]*?)<\\/button>`).exec(template)[1];
        assert.equal(count(inner, /<svg\b/g), 1);
        assert.equal(inner.replace(/<[^>]*>/g, '').trim(), '');
    }
    assert.deepEqual(one(/data-mmp-close\b/).path, ['mmp-layout']);

    // A hidden button really disappears, and fullscreen shows the player alone.
    assert.match(playerCss, /\.mmp\[hidden\],\s*\.mmp \[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
    assert.match(playerCss, /\.mmp\.is-fullscreen \.mmp-close,\s*\.mmp\.is-fullscreen \.mmp-nav\s*\{[^}]*visibility:\s*hidden/);

    // The public API: a single item or a list with a start position.
    assert.match(playerJs, /next: function \(\) \{ go\(1\); \}/);
    assert.match(playerJs, /prev: function \(\) \{ go\(-1\); \}/);

    // Work: a click opens the card's whole section, starting at that card.
    const work = read('assets/js/page-work.js');
    assert.match(work, /MMPlayer\.open\(gallery, start\)/);
    assert.match(work, /var CARDS = '\.wk-rc, \.wk-demo, \.wk-short';/);
    assert.match(work, /node\.getAttribute\('data-section'\) !== section/);
    // Cards keep their own link, embed address and thumbnail.
    assert.match(read('pages/work.php'), /data-mm-video-url=/);
    for (const attr of ['data-mm-video-url', 'data-mm-video-type', 'data-mm-video-embed-url', 'data-mm-video-poster']) {
        assert.match(work, new RegExp(attr), attr);
    }
});

test('the dock is exactly as tall as its content, on mouse and on touch screens', () => {
    const px = (name, block) => {
        const hit = new RegExp(`--mmp-${name}:\\s*(\\d+)px`).exec(block);
        assert.ok(hit, `--mmp-${name}`);
        return Number(hit[1]);
    };
    const base = /\.mmp\s*\{[^}]*\}/.exec(playerCss)[0];
    assert.match(base, /--mmp-dock-full:\s*calc\(var\(--mmp-bar\) \+ var\(--mmp-play\) \+ var\(--mmp-dock-gap\)\)/);
    assert.match(playerCss, /\.mmp--dock\s*\{\s*--mmp-dock:\s*var\(--mmp-dock-full\);/);
    assert.match(playerCss, /\.mmp--reserve\s*\{\s*--mmp-reserve:\s*var\(--mmp-dock-full\);/);
    assert.match(playerCss, /\.mmp-progress\s*\{[^}]*height:\s*var\(--mmp-bar\)/);
    assert.match(playerCss, /\.mmp-btn\s*\{[^}]*width:\s*var\(--mmp-btn\);\s*height:\s*var\(--mmp-btn\)/);
    assert.match(playerCss, /\.mmp \.mmp-play\s*\{[^}]*width:\s*var\(--mmp-play\);\s*height:\s*var\(--mmp-play\)/);
    assert.match(playerCss, /\.mmp-row\s*\{[^}]*padding-bottom:\s*var\(--mmp-dock-gap\)/);
    // Side columns flex symmetrically around the centred Play group, and narrow tiers step down cleanly.
    assert.match(playerCss, /\.mmp-row\s*\{[^}]*grid-template-columns:\s*minmax\(min-content,\s*1fr\)\s+auto\s+minmax\(min-content,\s*1fr\)/);
    assert.match(playerCss, /\.mmp--nano \.mmp-time\s*\{\s*display:\s*none;/);
    // Play is the largest button and has room under it.
    assert.ok(px('play', base) > px('btn', base));
    assert.ok(px('dock-gap', base) >= 4);
    assert.ok(px('btn', base) >= 40);
    // Touch screens: larger targets, same rule.
    const touch = /@media \(pointer: coarse\)\s*\{\s*\.mmp\s*\{[^}]*\}/.exec(playerCss);
    assert.ok(touch, 'touch sizes');
    assert.ok(px('btn', touch[0]) >= 44 && px('play', touch[0]) > px('btn', touch[0]) && px('bar', touch[0]) > px('bar', base));
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
