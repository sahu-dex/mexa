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

    // Every rule sits inside a mobile breakpoint (there are two: the page
    // background and the bar); the desktop bar is 82px with a 98px spacer and
    // must stay exactly that.
    assert.doesNotMatch(sheet, /min-width/);
    const openers = sheet.match(/@media \(max-width: 1023\.98px\)/g) || [];
    assert.ok(openers.length >= 2, 'the rules must be inside mobile breakpoints');
    // Walk the sheet by brace depth: every declaration must sit at depth >= 2,
    // i.e. inside both a media query and a rule.
    const src = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    let buffer = '';
    for (const ch of src) {
        if (ch === '{') { depth++; buffer = ''; continue; }
        if (ch === '}') { depth--; buffer = ''; continue; }
        buffer += ch;
        if (depth === 1 && ch === ';') {
            assert.fail('a declaration sits outside any media query: ' + buffer.trim().slice(0, 60));
        }
    }
    assert.equal(depth, 0, 'unbalanced braces');
    // And no desktop sizes are re-declared anywhere. (The mobile breakpoint's
    // own "1023.98px" is excluded so it is not mistaken for a 98px height.)
    const withoutBreakpoints = sheet.replace(/max-width:\s*1023\.98px/g, '');
    assert.doesNotMatch(withoutBreakpoints, /(?:^|[^-\d.])\b(?:82|98)px/m);
    assert.doesNotMatch(withoutBreakpoints, /min-width:\s*1024px/);
});

test('the header keeps its logo, service button and hamburger untouched', () => {
    const sheet = css();

    // Identity: this sheet moves the bar, clears its background, and hides the
    // services CTA at mobile widths (it lives in the drawer there). It may not
    // restyle anything else: the brand lockup and the burger must keep their
    // own design, and the CTA's only permitted rule is that one mobile hide.
    for (const sel of ['.brand-word', '.brand-tagline', '.brand-logo', '.hdr-burger', '.hdr-bar']) {
        const re = new RegExp(sel.replace('.', '\\.') + '(?![-\\w])');
        assert.doesNotMatch(sheet, re, sel + ' must not be restyled by the header fix');
    }

    // The service CTA may only be *hidden*, never restyled: one rule, display
    // only, and it is a mobile rule (covered by its own test).
    const ctaRules = sheet.match(/[^}]*\.header-service-button[^{]*\{[^}]*\}/g) || [];
    assert.equal(ctaRules.length, 1, 'the CTA gets exactly one rule here');
    const decls = ctaRules[0].slice(ctaRules[0].indexOf('{') + 1, ctaRules[0].lastIndexOf('}')).replace(/\s+/g, ' ').trim();
    assert.equal(decls, 'display: none !important;', 'the CTA rule may only hide it, got: ' + decls);
});

test('the mobile drawer opens under the bar, and the sheet loads last', () => {
    const sheet = css();
    const styles = read('includes/functions.php');
    const cards = read('assets/css/mobile-menu-cards.css');

    // The drawer is owned by mobile-menu-cards.css; it has to follow this bar's
    // height, and this sheet must not reach into another sheet's component.
    // The sheet starts at the bottom edge of the 54px bar, edge to edge, as in
    // the reference.
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

test('the page background scrolls on mobile, so the bar cannot shimmer', () => {
    const sheet = css();

    // reference-color-theme.css sets body{background-attachment:fixed}. On a
    // phone that repaints a viewport-sized gradient on every scrolled pixel,
    // which made the fixed header shimmer/jitter and (on iOS Safari) swapped the
    // background as you scroll. Desktop keeps the fixed attachment.
    const rule = sheet.match(/html body\s*\{[^}]*\}/);
    assert.ok(rule, 'the mobile page background must be pinned here');
    assert.match(rule[0], /background-attachment:\s*scroll\s*!important/);

    // Mobile only: a desktop-scoped rewrite of this would change desktop.
    const blocks = sheet.split('@media (max-width: 1023.98px)');
    assert.ok(blocks.length >= 2);
    assert.doesNotMatch(sheet, /background-attachment:[^;]*!important(?![\s\S]*max-width)/);
    assert.match(sheet, /@media \(max-width: 1023\.98px\)\s*\{\s*html body \{/);
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

// ---------------------------------------------------------------------------
// The bar on phones carries the brand and the menu toggle, nothing else. The
// services CTA used to sit between them as a compact "Service" pill, which read
// as a menu item stranded outside the menu. Service is a card in the drawer, so
// the header must not repeat it at mobile widths — and must keep it on desktop.
// ---------------------------------------------------------------------------

test('the services CTA is not shown in the mobile header', () => {
    const sheet = css();

    const rule = sheet.match(/html body #header \.header-service-button\s*\{[^}]*\}/);
    assert.ok(rule, 'the header sheet must hide the mobile services CTA');
    assert.match(rule[0], /display:\s*none\s*!important/);

    // Only below 1024px: the rule has to live inside that media query.
    const before = sheet.slice(0, sheet.indexOf('html body #header .header-service-button'));
    const mediaAt = before.lastIndexOf('@media (max-width: 1023.98px)');
    assert.ok(mediaAt > -1, 'the hide must be inside the mobile media query');
    const open = (before.slice(mediaAt).match(/\{/g) || []).length;
    const closed = (before.slice(mediaAt).match(/\}/g) || []).length;
    assert.ok(open > closed, 'the rule must still be inside the media query block');

    // And nothing re-shows it inside a desktop media query.
    assert.doesNotMatch(sheet, /@media \(min-width: 1024px\)[\s\S]*header-service-button\s*\{[^}]*display:\s*none/);
});

test('service is still reachable on mobile through the drawer', () => {
    const markup = read('includes/header.php');

    // The desktop button stays in the markup, label and i18n intact.
    assert.match(markup, /class="header-service-button"[^>]*href="service\.php"/);
    assert.match(markup, /data-i18n="header\.ourServices"/);

    // Service is a drawer card, and the action routes to the services page.
    assert.match(markup, /'key' => 'service'[\s\S]{0,140}label' => 'Service'/);
    assert.match(markup, /foreach \(\$navItems as \$item\)/);
    assert.match(markup, /class="mm-action-button"[\s\S]{0,200}href="service\.php"|href="service\.php" class="mm-action-button"/);
});

test('hiding the CTA leaves the brand and the hamburger untouched', () => {
    const sheet = css().replace(/\/\*[\s\S]*?\*\//g, '');

    // The header fix must not restyle the logo or the toggle.
    assert.doesNotMatch(sheet, /\.brand-logo|\sbrand-word\s*\{|\sbrand-tagline\s*\{/);
    assert.doesNotMatch(sheet, /\.hdr-burger\s*\{|\.hdr-bar\s*\{/);

    // Two visible children remain, so `justify-between` still splits them.
    const markup = read('includes/header.php');
    assert.match(markup, /flex justify-between items-center/);
});
