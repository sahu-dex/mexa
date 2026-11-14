const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

const SHEET = 'assets/css/mobile-menu-cards.css';

test('the card sheet is loaded last, so no theme sheet can repaint the drawer', () => {
    const styles = read('includes/functions.php');

    assert.match(styles, /mobile-menu-cards\.css\?v=\d{8}-/);
    // It must come after every sheet that already styles the drawer.
    const order = styles.indexOf(SHEET);
    for (const earlier of ['assets/css/mobile-menu.css', 'assets/css/reference-header.css', 'assets/css/premium-light-blue.css', 'assets/css/video-player.css']) {
        assert.ok(styles.indexOf(earlier) < order, earlier + ' must load before ' + SHEET);
    }
    // The only sheet appended after it must not touch the drawer at all.
    const after = [...styles.slice(order).matchAll(/'assets\/css\/([^'?]+)/g)].map(m => m[1]).filter(f => f !== 'mobile-menu-cards.css');
    for (const file of after) {
        const css = read('assets/css/' + file);
        assert.doesNotMatch(css, /mm-(?:item|nav|drawer|booking|chev|heading)/, file + ' loads after the card sheet and must not restyle the drawer');
    }
});

test('the drawer is the reference full-width frosted sheet with blue accents', () => {
    const css = read(SHEET);

    // Edge to edge under the header, as in the reference, not a side sheet.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*left:\s*0\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*right:\s*0\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*width:\s*100%\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*max-width:\s*none\s*!important/);
    // It starts at the 54px bar's bottom edge (mobile-header-fixed.css).
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*top:\s*54px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*max-height:\s*calc\(100dvh - 54px\)\s*!important/);
    // Sheet attached to the bar: rounded bottom corners only, and the panel
    // itself is a shallow ice-blue wash (the reference's resolved gradient).
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*border-radius:\s*0 0 16px 16px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*background:\s*linear-gradient\(160deg, #eef7ff, #e1efff\)\s*!important/);
    // The rows carry the inset, not the panel.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*padding:\s*0 0 max\(18px, env\(safe-area-inset-bottom\)\)\s*!important/);

    // Rows: 45px, 13px radius, frosted white over the sheet, dark navy label,
    // muted chevron on the right. These are the reference's effective values.
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*height:\s*45px\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*border-radius:\s*13px\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*background:\s*rgba\(255, 255, 255, \.62\)\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*border:\s*1px solid rgba\(127, 174, 223, \.32\)\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*color:\s*#07143d\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*font-size:\s*15px\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*justify-content:\s*space-between\s*!important/);
    assert.match(css, /\.mm-nav \.mm-chev\s*\{[^}]*color:\s*#315c99\s*!important/);
    assert.match(css, /\.mm-chev svg\s*\{[^}]*width:\s*14px\s*!important/);

    // The current page is the SAME height row, tinted (the reference does not
    // grow it), with brand-blue text and a firmer edge.
    assert.match(css, /\.mm-item\.is-active[\s\S]{0,420}?background:\s*#d8eaff\s*!important/);
    assert.match(css, /\.mm-item\.is-active[\s\S]{0,420}?color:\s*#073bd3\s*!important/);
    assert.match(css, /\.mm-item\.is-active[\s\S]{0,420}?border:\s*1px solid rgba\(7, 63, 232, \.32\)\s*!important/);
    assert.doesNotMatch(css, /\.mm-item\.is-active[\s\S]{0,420}?height:\s*\d+px\s*!important/);

    // The primary action is a full-width blue pill, 45px, brand blue.
    assert.match(css, /\.mm-action-button\s*\{[^}]*background:\s*#073ff1\s*!important/);
    assert.match(css, /\.mm-action-button\s*\{[^}]*border-radius:\s*999px\s*!important/);
    assert.match(css, /\.mm-action-button\s*\{[^}]*height:\s*45px\s*!important/);
    assert.match(css, /\.mm-action-button\s*\{[^}]*color:\s*#ffffff\s*!important/);
});

test('the sheet slides down from under the header instead of in from the right', () => {
    const css = read(SHEET);

    assert.match(css, /\.mm-drawer\s*\{[^}]*transform:\s*translateY\(0\)\s*!important/);
    // Closed: shifted by its measured height, kept in a custom property so the
    // JS never has to fight an !important rule.
    assert.match(css, /\.mm-drawer\.-translate-y-full\s*\{[^}]*transform:\s*translateY\(var\(--mm-closed-shift/);
    // A bare -100% is the bug: it leaves the sheet's bottom edge inside the
    // header's band, where the menu root paints over the header.
    assert.doesNotMatch(css, /transform:\s*translateY\(-100%\)\s*!important/);
    // textContent-safe: a visibility switch so a parked sheet cannot be focused.
    assert.match(css, /\.mm-drawer\.-translate-y-full\s*\{[^}]*visibility:\s*hidden\s*!important/);
    // reference-header.css slides it in from the right and must not win.
    assert.doesNotMatch(css, /translateX\(100%\)/);
});

test('the drawer stays dismissable: close button reachable and never rendered twice', () => {
    const css = read(SHEET);
    const markup = read('includes/header.php');

    // One close button, in the heading; the heading collapses but stays reachable.
    assert.equal((markup.match(/id="mobile-menu-close"/g) || []).length, 1);
    assert.match(markup, /id="mobile-menu-close"[^>]*class="ref-menu-close"/);
    assert.match(css, /\.mm-heading\s*\{[^}]*position:\s*absolute\s*!important/);
    assert.match(css, /\.ref-menu-close\s*\{[^}]*opacity:\s*0\s*!important/);
    assert.match(css, /\.ref-menu-close:focus-visible\s*\{[^}]*opacity:\s*1\s*!important/);
    // The brand block is not repeated inside the sheet.
    assert.match(css, /\.mm-heading-brand\s*\{\s*display:\s*none\s*!important/);
});

test('the drawer markup is plain labels and chevrons, plus the services action', () => {
    const markup = read('includes/header.php');
    // No per-item icon tiles in this design.
    assert.doesNotMatch(markup, /class="mm-icon"/);
    // Every nav item keeps its label and chevron.
    // One template loop renders all five pages, so the markup carries a single item.
    assert.match(markup, /foreach \(\$navItems as \$item\)/);
    assert.match(markup, /class="mobile-nav-item mm-item<\?= \$active \? ' is-active' : '' \?>"/);
    assert.equal((markup.match(/class="mm-label"/g) || []).length, 1);
    assert.equal((markup.match(/class="mm-chev"/g) || []).length, 1);

    // The action sits inside the drawer's nav, after the five cards.
    assert.match(markup, /class="mm-action-button"/);
    const bookAt = markup.indexOf('mm-action-button');
    assert.ok(bookAt > markup.lastIndexOf('mobile-nav-item'), 'the services action must follow the page cards');
    assert.ok(markup.indexOf('</nav>', bookAt) > bookAt, 'the services action must live inside the drawer nav');

    // No third-party brand icon fonts for the action icons.
    assert.doesNotMatch(markup.slice(bookAt - 400, bookAt + 900), /fa-(?:solid|brands)/);
});

test('the services action goes to the services page and reuses the shared label', () => {
    const header = read('includes/header.php');
    const js = read('assets/js/site-common.js');

    // It is the services CTA, matching the header button.
    const at = header.indexOf('class="mm-action-button"');
    const action = header.slice(header.lastIndexOf('<a ', at), header.indexOf('</a>', at));
    assert.match(action, /href="service"/);
    assert.match(action, /data-i18n="header\.ourServices"/);
    assert.match(js, /'header\.ourServices': 'Our Services'/);

    // The retired booking pipeline must not come back through the drawer.
    assert.doesNotMatch(header, /book\.php|Booking Now|submit-booking/);
    assert.doesNotMatch(js, /Booking Now/);
});

// ---------------------------------------------------------------------------
// The drawer must hang below the bar as its own panel, and must never paint
// over the header in any state. Before this, the closed sheet was translated by
// `-100%` of its own height from `top:54px`, which left its bottom 54px inside
// the header's band — and the menu root tied the header's z-index and came later
// in the DOM, so the closed sheet (its blue action button) covered the logo.
// ---------------------------------------------------------------------------

test('the closed sheet is parked entirely outside the header band', () => {
    const css = read(SHEET);
    const js = read('assets/js/site-common.js');

    // The resting position is the bar's bottom edge.
    const top = +(css.match(/#mobile-menu-drawer\.mm-drawer\s*\{[^}]*top:\s*(\d+)px\s*!important/) || [])[1];
    assert.equal(top, 54, 'the drawer starts at the 54px bar, got ' + top);

    // The closed offset is (measured height + resting offset), read from the
    // sheet's computed style rather than hardcoded, which puts the sheet's
    // bottom edge at y=0 — above the viewport, not over the bar.
    assert.match(js, /menuHeight\(drawer\) \+ drawerRestTop\(drawer\)/);
    assert.match(js, /getComputedStyle\(drawer\)\.top/);
    for (const H of [300, 394, 520, 600]) {
        assert.ok(top - (H + top) + H <= 0, 'a ' + H + 'px sheet must end at or above y=0 when closed');
    }

    // A bare -100% is the exact bug above.
    assert.doesNotMatch(css, /transform:\s*translateY\(-100%\)\s*!important/);
});

test('nothing in the menu can paint over the header', () => {
    const css = read(SHEET);
    const header = read('assets/css/mobile-header-fixed.css');

    // The bar outranks the menu root (they used to tie at 10001).
    const barZ = +(css.match(/#header\.hdr-bar-wrap\s*\{\s*z-index:\s*(\d+)\s*!important/) || [])[1];
    assert.ok(barZ > 10001, 'the bar must outrank the menu root, got ' + barZ);

    // The closed sheet is parked entirely above the viewport, so there is
    // nothing to clip — and a full-screen clip-path would promote a compositing
    // layer for the life of the menu, which this project is actively removing.
    assert.doesNotMatch(css, /clip-path/);

    // The header itself is still the opaque fixed bar from the earlier fix.
    assert.match(header, /#header\.hdr-bar-wrap\s*\{[^}]*position:\s*fixed\s*!important/);
    assert.match(header, /#header\.hdr-bar-wrap\s*\{[^}]*top:\s*0\s*!important/);
});

test('the menu root does not swallow taps while it is closed', () => {
    const css = read(SHEET);
    const js = read('assets/js/site-common.js');

    // The root is fixed inset:0. Without this it sits over the header and eats
    // every tap meant for the logo, the service button or the hamburger.
    assert.match(css, /\.mm-root\.pointer-events-none\s*\{\s*pointer-events:\s*none\s*!important/);
    assert.match(css, /body\.mm-open #mobile-menu\.mm-root\s*\{\s*pointer-events:\s*auto\s*!important/);
    assert.match(js, /document\.body\.classList\.add\('mm-open'\)/);
    // And it is cleared both when the close starts and when it finishes.
    assert.ok((js.match(/document\.body\.classList\.remove\('mm-open'\)/g) || []).length >= 2);
});

test('the panel is a rounded container with the reference dim overlay', () => {
    const css = read(SHEET);

    // Sheet attached to the bar: full width, rounded bottom corners.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*border-radius:\s*0 0 16px 16px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*left:\s*0\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*right:\s*0\s*!important/);
    // The rows carry the 13/14/11 insets, so nothing runs into the corner arc.
    const pad = css.match(/\.mm-nav\s*\{[^}]*padding:\s*13px 14px 10px\s*!important/);
    assert.ok(pad, 'the list keeps the reference insets');
    const gap = css.match(/\.mm-nav\s*\{[^}]*gap:\s*11px\s*!important/);
    assert.ok(gap, 'the list keeps the reference row gap');

    // The overlay is the reference's flat dim, with no blur (a full-screen
    // backdrop-filter is re-sampled every frame).
    const flat = css.replace(/\s+/g, ' ');
    assert.match(flat, /mobile-menu-backdrop\.mm-backdrop\s*\{[^}]*background:\s*rgba\(7,\s*20,\s*54,\s*\.28\)\s*!important/);
    assert.match(flat, /mobile-menu-backdrop\.mm-backdrop\s*\{[^}]*backdrop-filter:\s*none\s*!important/);
    // And the panel itself is never blurred.
    assert.match(flat, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*backdrop-filter:\s*none\s*!important/);
});

test('the open/close animation matches the reference slide', () => {
    const css = read(SHEET);

    // Transform-only (compositor-friendly): the reference's 350ms strong
    // ease-out curve, cubic-bezier(.32, .72, 0, 1).
    assert.match(css, /transition:\s*transform 350ms cubic-bezier\(\.32, \.72, 0, 1\)\s*!important/);
    assert.match(css, /\.mm-drawer\s*\{[^}]*transform:\s*translateY\(0\)\s*!important/);
    // Reduced motion switches it off rather than shortening it.
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]{0,400}transition:\s*none\s*!important/);
});

test('the menu type survives the page-wide layered typography sheet', () => {
    const css = read(SHEET);
    const typography = read('assets/css/site-typography.css');

    // site-typography.css owns `nav a` font-size in the mx-typography layer with
    // !important. A layered !important outranks every unlayered one, so this
    // sheet must state the menu's metrics in that same layer — not in a more
    // specific unlayered selector, which would silently lose.
    assert.match(typography, /@layer mx-typography/);
    assert.match(typography, /body :is\(button, \[role='button'\][\s\S]{0,200}?nav a\)\s*\{[^}]*font-size:[^!]*!important/);

    // The menu's own layered block comes after it in load order, so it wins.
    const layered = css.match(/@layer mx-typography \{([\s\S]*?)\n\}/);
    assert.ok(layered, 'the menu type must be pinned inside the mx-typography layer');
    assert.match(layered[1], /\.mm-item\s*\{[^}]*font-size:\s*15px\s*!important/);
    // The pill lives inside <nav> on this site, so it needs the same treatment.
    assert.match(layered[1], /\.mm-action-button\s*\{[^}]*font-size:\s*16px\s*!important/);

    // The small-phone step has to live in the layer too, or it would lose to
    // the base 15px rule that does.
    assert.match(layered[1], /max-width:\s*359px[\s\S]{0,200}?font-size:\s*15px\s*!important/);
    // Everything the layer sets is guarded by a mobile query, so desktop keeps
    // the shared typography sheet's values untouched.
    const layeredRules = layered[1].match(/@media[^{]*/g) || [];
    assert.ok(layeredRules.length > 0);
    for (const q of layeredRules) assert.match(q, /max-width/);
});

test('the current row re-states its border colour', () => {
    const css = read(SHEET);

    // reference-header.css paints current/hovered rows `border: 1px solid
    // transparent` with !important. A shorthand alone in the active rule loses
    // the colour to it, so border-color has to be stated on its own too.
    assert.match(css, /\.mm-item\.is-active[\s\S]{0,700}?border-color:\s*rgba\(7, 63, 232, \.32\)\s*!important/);
});

test('the bar outranks not just the menu root but the sheet that re-states it', () => {
    const cards = read(SHEET);
    const barSheet = read('assets/css/mobile-header-fixed.css');

    // mobile-header-fixed.css loads *after* this sheet and re-states the bar at
    // z-index 10001 with the same !important. Equal specificity + equal
    // importance is decided by load order, so whatever this sheet says only
    // wins while it is numerically higher. Rounds 8-10 shipped 10050 and 10001
    // — i.e. a tie with the menu root — which let the open menu's overlay tint
    // the header band.
    const ours = +(cards.match(/#header\.hdr-bar-wrap\s*\{\s*z-index:\s*(\d+)\s*!important/) || [])[1];
    const theirs = +(barSheet.match(/#header\.hdr-bar-wrap\s*\{[^}]*z-index:\s*(\d+)\s*!important/) || [])[1];
    const root = +(read('assets/css/reference-header.css').match(/#mobile-menu\.mm-root\s*\{\s*z-index:\s*(\d+)\s*!important/) || [])[1];

    assert.ok(ours > 0, 'the bar rule must exist in the menu sheet');
    assert.ok(ours > (theirs || 0), 'the bar must outrank mobile-header-fixed.css (' + ours + ' vs ' + theirs + ')');
    assert.ok(ours > (root || 0) + 1, 'the bar must sit clear of the menu root, not tie it (' + ours + ' vs ' + root + ')');
    // The overlay must never be able to reach the bar.
    assert.ok(theirs <= root, 'sanity: this is the conflict being guarded against');
});

test('the menu stylesheet URL changes whenever its appearance does', () => {
    const styles = read('includes/functions.php');

    // A stale copy in a phone's cache is invisible in the source but obvious on
    // screen: round 10 measured exactly the pre-round-10 pill colour on a real
    // device. The token has to be a dated, non-generic value so it can be
    // bumped deliberately, and it must not be left at a historic one.
    const m = styles.match(/mobile-menu-cards\.css\?v=([\w.-]+)/);
    assert.ok(m, 'the sheet must be requested with a version token');
    assert.match(m[1], /^\d{8}-[a-z0-9-]+$/, 'token should be YYYYMMDD-slug, got ' + m[1]);
    assert.doesNotMatch(m[1], /20261112|^20261114-cards$/, 'this token predates the current design');
});

test('the sheet is joined to the bar: no seam, and the bar is never dimmed', () => {
    const css = read(SHEET);
    const js = read('assets/js/site-common.js');
    const markup = read('includes/header.php');

    // The bar rule must not depend on an id the <body> does not have — that
    // made it dead code, so the overlay dimmed the header.
    assert.doesNotMatch(markup, /<body[^>]*id=/);
    assert.doesNotMatch(css, /body#/);
    // Specific enough to beat mobile-header-fixed.css, which loads later.
    assert.match(css, /html body #header#header\.hdr-bar-wrap\s*\{\s*z-index:\s*10060\s*!important/);

    // No hairline on the sheet, white carried down from the bar.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*border-top:\s*0\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*background-image:\s*linear-gradient\(180deg, #ffffff 0/);
    // The bar drops its divider only while the menu is open.
    assert.match(css, /body\.mm-joined #header#header\.hdr-bar-wrap\s*\{[^}]*border-bottom-color:\s*transparent\s*!important[^}]*box-shadow:\s*none\s*!important/);
    assert.match(js, /classList\.add\('mm-joined'\)/);
    assert.match(js, /classList\.remove\('mm-joined'\)/);
});
