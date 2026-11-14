const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

const SHEET = 'assets/css/mobile-header-fixed.css';
const css = () => read(SHEET);

// The mobile bar and its spacer must describe the same geometry, or page
// content ends up underneath the header again.
test('the mobile bar is fixed to the top of the viewport', () => {
    const sheet = css();

    const bar = sheet.match(/html body #header\.hdr-bar-wrap\s*\{[^}]*\}/);
    assert.ok(bar, 'the header bar must be pinned in this sheet');
    const body = bar[0];

    assert.match(body, /position:\s*fixed\s*!important/);
    assert.match(body, /top:\s*0\s*!important/);
    assert.match(body, /height:\s*54px\s*!important/);
    // Nothing may move the bar while scrolling.
    assert.match(body, /transform:\s*none\s*!important/);
    assert.match(body, /transition:\s*none\s*!important/);
});

test('the bar is fully opaque, not translucent', () => {
    const body = css().match(/html body #header\.hdr-bar-wrap\s*\{[^}]*\}/)[0];

    // A solid colour; no alpha, gradients or blur showing content through it.
    assert.match(body, /background:\s*#ffffff\s*!important/);
    assert.doesNotMatch(body, /background:[^;]*rgba/);
    assert.doesNotMatch(body, /background:[^;]*gradient/);
    assert.match(body, /backdrop-filter:\s*none\s*!important/);
    assert.match(body, /-webkit-backdrop-filter:\s*none\s*!important/);

    // The inner pill is opaque too.
    const pill = css().match(/html body #header\.hdr-bar-wrap > \.container\s*\{[^}]*\}/);
    assert.ok(pill, 'the header pill must be opaque');
    assert.match(pill[0], /background:\s*#ffffff\s*!important/);
});

test('the spacer matches the bar exactly, so content starts below it', () => {
    const sheet = css();

    // reference-header.css shows a 54px bar; the spacer has to agree with it.
    // mobile-menu.css and visual-refresh reserved 66/76px against a 54px bar
    // that also sat 16px lower — that mismatch is what put content under it.
    const spacer = sheet.match(/html body \.header-spacer:not\(\.hidden\)\s*\{[^}]*\}/);
    assert.ok(spacer, 'the mobile spacer must be sized here');
    const body = spacer[0];

    assert.match(body, /display:\s*block\s*!important/);
    assert.match(body, /height:\s*54px\s*!important/);
    assert.match(body, /min-height:\s*54px\s*!important/);
    assert.match(body, /max-height:\s*54px\s*!important/);
    assert.match(body, /flex:\s*0 0 54px\s*!important/);

    // The desktop spacer (hidden lg:block) must never be un-hidden.
    assert.ok(spacer[0].includes(':not(.hidden)'), 'the desktop spacer must be excluded');
    assert.doesNotMatch(sheet, /\.header-spacer\s*\{/, 'the bare .header-spacer must not be targeted');
});

test('the mask that reference-header painted behind a 16px-offset bar is gone', () => {
    const sheet = css();

    // reference-header.css: top:16px + a ::before strip covering the gap above.
    // With the bar at the top that strip would paint over page content.
    const before = sheet.match(/html body #header\.hdr-bar-wrap::before\s*\{[^}]*\}/);
    assert.ok(before, 'the inherited ::before strip must be switched off');
    assert.match(before[0], /display:\s*none\s*!important/);
    assert.match(before[0], /content:\s*none\s*!important/);
});

test('nothing here applies to the desktop header', () => {
    const sheet = css();

    // Every rule sits inside the mobile breakpoint; the desktop bar is 82px
    // with a 98px spacer and must stay exactly that.
    const blocks = sheet.split('@media (max-width: 1023.98px)');
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].replace(/\/\*[\s\S]*?\*\//g, '').trim(), '', 'no rules may live outside the mobile breakpoint');
    // And no desktop sizes are re-declared anywhere. (The mobile breakpoint's
    // own "1023.98px" is excluded so it is not mistaken for a 98px height.)
    const withoutBreakpoints = sheet.replace(/max-width:\s*1023\.98px/g, '');
    assert.doesNotMatch(withoutBreakpoints, /(?:^|[^-\d.])\b(?:82|98)px/m);
    assert.doesNotMatch(withoutBreakpoints, /min-width:\s*1024px/);
});

test('the header keeps its logo, service button and hamburger untouched', () => {
    const sheet = css();

    // Identity: this sheet only moves the bar and clears its background. It may
    // not restyle the brand lockup, the service CTA or the burger.
    // (.hdr-bar-wrap is the bar itself and is expected; the controls are not.)
    for (const sel of ['.brand-word', '.brand-tagline', '.brand-logo', '.header-service-button', '.hdr-burger', '.hdr-bar']) {
        const re = new RegExp(sel.replace('.', '\\.') + '(?![-\\w])');
        assert.doesNotMatch(sheet, re, sel + ' must not be restyled by the header fix');
    }
});

test('the mobile drawer opens under the bar, and the sheet loads last', () => {
    const sheet = css();
    const styles = read('includes/functions.php');
    const cards = read('assets/css/mobile-menu-cards.css');

    // The drawer is owned by mobile-menu-cards.css; it has to follow this bar's
    // height, and this sheet must not reach into another sheet's component.
    assert.match(cards, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*top:\s*54px\s*!important/);
    assert.match(cards, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*max-height:\s*calc\(100dvh - 54px\)\s*!important/);
    assert.doesNotMatch(sheet, /mm-drawer/, 'the drawer offset belongs to the drawer sheet');

    assert.match(styles, /mobile-header-fixed\.css\?v=\d{8}-/);
    const order = styles.indexOf(SHEET);
    for (const earlier of [
        'assets/css/mobile-menu.css',
        'assets/css/reference-header.css',
        'assets/css/reference-color-theme.css',
        'assets/css/premium-light-blue.css',
        'assets/css/premium-design-system.css',
        'assets/css/visual-refresh.css',
        'assets/css/mobile-menu-cards.css',
    ]) {
        assert.ok(styles.indexOf(earlier) < order, earlier + ' must load before ' + SHEET);
    }
});

test('the scrolled state cannot repaint or move the bar', () => {
    const sheet = css();

    // The header gets a `.scrolled` class on scroll (site-common.js). Because the
    // background and shadow here are !important, that class can no longer change
    // the bar's appearance mid-scroll.
    const body = sheet.match(/html body #header\.hdr-bar-wrap\s*\{[^}]*\}/)[0];
    assert.match(body, /box-shadow:[^;]*!important/);
    assert.match(body, /border-bottom:[^;]*!important/);
});
