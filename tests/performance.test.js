const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

const common = () => read('assets/js/site-common.js');
const player = () => read('assets/js/video-player.js');

// ---------------------------------------------------------------------------
// Scrolling must never wait on JavaScript.
// ---------------------------------------------------------------------------

test('no listener blocks the browser from scrolling', () => {
    // A non-passive touchmove/wheel listener forces the browser to wait for the
    // handler before it can start a scroll — the classic "page feels stuck".
    for (const file of ['assets/js/site-common.js', 'assets/js/video-player.js']) {
        const js = read(file);
        assert.doesNotMatch(js, /passive:\s*false/, file + ' must not use non-passive scroll listeners');

        // Every touch/wheel listener has to be passive. Match the whole call
        // including its options argument (which itself contains parentheses).
        const calls = [...js.matchAll(/addEventListener\(\s*['"](touchmove|wheel|touchstart)['"][\s\S]*?\}\s*\)/g)]
            .filter(m => !/passive:\s*true/.test(m[0]));
        assert.deepEqual(calls.map(m => m[0].slice(0, 60)), [], file + ' has a non-passive scroll listener');
    }
});

test('the drag on the review strip is coalesced into one write per frame', () => {
    const js = common();

    // Pointer events cover mouse/pen/touch in one path.
    assert.match(js, /addEventListener\('pointerdown'/);
    assert.match(js, /addEventListener\('pointermove'/);
    // The old handler wrote scrollLeft on every mousemove — a forced layout per
    // event. It must be gone entirely, not merely supplemented.
    assert.doesNotMatch(js, /window\.addEventListener\('mousemove'/);
    assert.match(js, /dragRaf = requestAnimationFrame/);
    // Touch must not be captured by the drag path; it pans natively.
    assert.match(js, /e\.pointerType === 'touch'/);
});

test('scroll-heavy handlers are throttled to one pass per frame', () => {
    const js = common();

    // Resize fires tens of times per drag; both handlers coalesce.
    assert.match(js, /let menuResizeRaf = 0;/);
    assert.match(js, /resizeRaf = requestAnimationFrame/);
    // The header's scroll class is still guarded by a cheap boolean compare.
    assert.match(js, /if \(scrolled !== headerScrolled\)/);
    assert.match(js, /window\.addEventListener\('scroll', onHeaderScroll, \{ passive: true \}\)/);
});

// ---------------------------------------------------------------------------
// Interaction must stay responsive.
// ---------------------------------------------------------------------------

test('the video player wakes its controls once per frame, not once per event', () => {
    const js = player();

    assert.match(js, /wakeQueued/);
    assert.match(js, /refs\.stage\.addEventListener\(type, scheduleWake, \{ passive: true \}\)/);
    assert.match(js, /modal\.addEventListener\('mousemove', scheduleWake, \{ passive: true \}\)/);
    // The one-shot preconnect priming must short-circuit before doing any DOM work.
    assert.match(js, /if \(primed\) return;/);
});

test('counters animate in one loop and write textContent', () => {
    const js = common();

    // Four separate rAF loops became one.
    assert.match(js, /const items = Array\.from\(counters\)\.map/);
    // A single loop drives every counter (the second call re-schedules it).
    assert.equal((js.match(/function updateCount\(now\)/g) || []).length, 1);
    assert.doesNotMatch(js, /counters\.forEach/);
    // innerText forces a layout to measure rendered text; textContent does not.
    assert.doesNotMatch(js, /counter\.innerText/);
    assert.match(js, /item\.el\.textContent = current/);
    // And a value that hasn't changed isn't written at all.
    assert.match(js, /if \(current === item\.shown\) continue;/);
});

test('the broken-image sweep does not walk the document twice', () => {
    const js = common();

    assert.doesNotMatch(js, /DOMContentLoaded', sweep\);\s*window\.addEventListener\('load', sweep\);\s*$/m);
    assert.match(js, /data-img-broken/);
    // The error listener is the primary path; `capture` keeps it cheap.
    assert.match(js, /document\.addEventListener\('error',[\s\S]{0,200}true\)/);
});

// ---------------------------------------------------------------------------
// Loading: no render-blocking scripts, no oversized posters.
// ---------------------------------------------------------------------------

test('scripts are deferred so they do not block rendering', () => {
    const footer = read('includes/footer.php');

    // Every external script in the footer must carry defer. Inline data scripts
    // run at parse time and are unaffected by defer.
    const tags = [...footer.matchAll(/<script\b[^>]*\bsrc="[^"]+"[^>]*>/gi)].map(m => m[0]);
    assert.ok(tags.length > 0, 'no external scripts found in the footer');
    assert.ok(tags.length >= 3, 'expected the shared scripts to be present');
    for (const tag of tags) {
        assert.match(tag, /\bdefer\b/, 'missing defer: ' + tag);
    }
    // The page-specific scripts must be deferred too.
    assert.match(footer, /<script defer src="<\?= e\(\$jsSrc\) \?>"><\/script>/);
});

test('the inline data script still runs before the deferred files', () => {
    const footer = read('includes/footer.php');

    // Deferred scripts execute after parsing, so the inline assignments above
    // them are always available — verify the order in the markup.
    const inlineAt = footer.indexOf('window.__MM_DEMO_DATA__');
    const firstDeferAt = footer.indexOf('<script defer');
    assert.ok(inlineAt > 0 && firstDeferAt > 0);
    assert.ok(inlineAt < firstDeferAt, 'the data globals must be defined before the deferred scripts');
    assert.doesNotMatch(footer, /<script defer[^>]*>[^<]*__MM_DEMO_DATA__/);
});

test('video posters are requested at a size the cards can use', () => {
    const js = read('assets/js/page-work.js');

    // maxresdefault is 1280x720 (~120 KB) for a card that renders ~370px wide.
    assert.doesNotMatch(js, /maxresdefault\.jpg'/);
    assert.match(js, /hqdefault\.jpg/);
});

test('third-party hosts are preconnected in the head, not from JS', () => {
    const header = read('includes/header.php');

    assert.match(header, /<link rel="preconnect" href="https:\/\/i\.ytimg\.com">/);
    assert.match(header, /<link rel="dns-prefetch" href="https:\/\/i\.ytimg\.com">/);
    // No crossorigin: thumbnails are plain <img> requests, and a crossorigin
    // preconnect opens a separate pool that would never be reused.
    assert.doesNotMatch(header, /rel="preconnect"[^>]*crossorigin/);
});

// ---------------------------------------------------------------------------
// CSS: rendering cost, without changing the design.
// ---------------------------------------------------------------------------

test('the performance sheet loads last and declares no visual properties', () => {
    const styles = read('includes/functions.php');
    const css = read('assets/css/performance.css');

    assert.match(styles, /performance\.css\?v=\d{8}-/);
    // It must be the final sheet: it overrides rendering behaviour.
    const order = styles.indexOf('assets/css/performance.css');
    for (const earlier of ['assets/css/reference-header.css', 'assets/css/mobile-header-fixed.css', 'assets/css/video-player.css']) {
        assert.ok(styles.indexOf(earlier) < order, earlier + ' must load before performance.css');
    }

    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const prop of ['color', 'background', 'border-radius', 'font-size', 'padding', 'margin', 'width', 'height', 'box-shadow']) {
        const re = new RegExp('(^|[;{\\s])' + prop.replace('-', '\\-') + '\\s*:');
        assert.equal(re.test(body), false, 'performance.css must not set ' + prop);
    }

    // Nothing in it may touch the drawer/header components owned by the other sheets.
    assert.doesNotMatch(body, /mm-item|mm-drawer|hdr-bar-wrap/);
});

test('expensive backdrop blurs are switched off where they cannot be seen', () => {
    const css = read('assets/css/performance.css');

    // The modal scrim is a 78%-opaque dark fill: the blur is invisible but is
    // re-sampled every frame it is on screen.
    assert.match(css, /\.mxvp__backdrop[\s\S]{0,200}backdrop-filter:\s*none\s*!important/);
    assert.match(css, /\.showreel-backdrop/);
});

test('smooth-scroll and motion settings respect the OS preference', () => {
    const css = read('assets/css/performance.css');

    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /scroll-behavior: auto !important/);
    // The review strip must not fight its own rAF panning with CSS smoothing.
    assert.match(css, /\.reviews-container[\s\S]{0,240}scroll-behavior: auto/);
});

test('the narrowed transitions still cover every property that actually changes', () => {
    // `transition: all` was replaced with an explicit property list. If a state
    // rule later animates something new, the change would silently lose its
    // transition, so assert the list matches the rules being replaced.
    const css = read('assets/css/performance.css');

    const transitionOf = selector => {
        // The sheet may touch a selector more than once (e.g. `will-change`
        // earlier), so inspect the *transition* rule specifically.
        const start = css.indexOf(selector + ' { transition-property');
        assert.ok(start > -1, 'no transition override for ' + selector);
        const startEnd = start;
        const body = css.slice(startEnd, css.indexOf('}', startEnd));
        const m = body.match(/transition-property:\s*([^;]+);/);
        assert.ok(m, 'not a transition-property declaration: ' + selector);
        return m[1].split(',').map(v => v.trim()).sort();
    };

    // .client-logo:hover sets filter, opacity and transform.
    assert.deepEqual(transitionOf('.client-logo'), ['filter', 'opacity', 'transform']);

    // .pf-tab (:hover / .is-active) sets colour, background and border-bottom-color.
    assert.deepEqual(
        transitionOf('body #portfolio .pf-tab'),
        ['background-color', 'border-bottom-color', 'color']
    );
});
