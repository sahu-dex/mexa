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

test('the drawer is a full-width light sheet of white cards with blue accents', () => {
    const css = read(SHEET);

    // Full width under the header, not a right-hand side sheet.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*left:\s*12px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*right:\s*12px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*max-width:\s*none\s*!important/);
    // It hangs below the 54px bar (mobile-header-fixed.css) as a floating panel.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*top:\s*62px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*max-height:\s*calc\(100dvh - 74px\)\s*!important/);
    // A rounded container on all four corners, not a sheet welded to the bar.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*border-radius:\s*22px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*background:\s*#eef6fe\s*!important/);

    // White cards, dark label, grey chevron on the right.
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*background:\s*#ffffff\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*color:\s*#0e1a33\s*!important/);
    assert.match(css, /\.mm-nav \.mm-item\s*\{[^}]*justify-content:\s*space-between\s*!important/);
    assert.match(css, /\.mm-nav \.mm-chev\s*\{[^}]*color:\s*#64748b\s*!important/);

    // The current page is a tinted card with brand-blue text.
    assert.match(css, /\.mm-item\.is-active[\s\S]{0,220}?background:\s*#d8eafb\s*!important/);
    assert.match(css, /\.mm-item\.is-active[\s\S]{0,220}?color:\s*#1633b1\s*!important/);

    // The primary action is a full-width blue pill.
    assert.match(css, /\.mm-action-button\s*\{[^}]*background:\s*#1940e6\s*!important/);
    assert.match(css, /\.mm-action-button\s*\{[^}]*border-radius:\s*999px\s*!important/);
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
    assert.match(action, /href="service\.php"/);
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

    // The resting position clears the 54px bar.
    const top = +(css.match(/#mobile-menu-drawer\.mm-drawer\s*\{[^}]*top:\s*(\d+)px\s*!important/) || [])[1];
    assert.ok(top > 54, 'the drawer must hang below the 54px bar, got ' + top);

    // The closed offset is (measured height + that resting offset), which puts
    // the sheet's bottom edge at y=0 — above the viewport, not over the bar.
    const park = +(js.match(/menuHeight\(drawer\) \+ (\d+)/) || [])[1];
    assert.equal(park, top, 'the JS must park by height + the same resting offset');
    for (const H of [300, 394, 500]) {
        assert.ok(top - (H + park) + H <= 0, 'a ' + H + 'px sheet must end at or above y=0 when closed');
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

test('the panel is a floating rounded container with a light dark overlay', () => {
    const css = read(SHEET);

    // Rounded on all four corners, inset from the screen edges.
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*border-radius:\s*22px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*left:\s*12px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*right:\s*12px\s*!important/);
    // Padding at least the corner radius, or the pill runs into the corner arc.
    const pad = +(css.match(/#mobile-menu-drawer\.mm-drawer\s*\{[^}]*padding:\s*(\d+)px\s*!important/) || [])[1];
    const radius = +(css.match(/#mobile-menu-drawer\.mm-drawer\s*\{[^}]*border-radius:\s*(\d+)px\s*!important/) || [])[1];
    assert.ok(pad >= radius - 6, 'padding ' + pad + 'px is too tight for a ' + radius + 'px radius');

    // The overlay is a light dark wash, with no blur (a full-screen
    // backdrop-filter is re-sampled every frame).
    const flat = css.replace(/\s+/g, ' ');
    assert.match(flat, /mobile-menu-backdrop\.mm-backdrop\s*\{[^}]*background:\s*rgba\(9,\s*30,\s*66,\s*\.32\)\s*!important/);
    assert.match(flat, /mobile-menu-backdrop\.mm-backdrop\s*\{[^}]*backdrop-filter:\s*none\s*!important/);
});

test('the open/close animation is a short transform transition', () => {
    const css = read(SHEET);

    // Transform-only (compositor-friendly), 260ms, an ease-out curve.
    assert.match(css, /transition:\s*transform 260ms cubic-bezier\(\.22, \.61, \.36, 1\)\s*!important/);
    assert.match(css, /\.mm-drawer\s*\{[^}]*transform:\s*translateY\(0\)\s*!important/);
    // Reduced motion switches it off rather than shortening it.
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]{0,400}transition:\s*none\s*!important/);
});
