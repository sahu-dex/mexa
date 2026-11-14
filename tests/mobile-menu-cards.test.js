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
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*width:\s*100%\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*max-width:\s*none\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*top:\s*66px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*max-height:\s*calc\(100dvh - 66px\)\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*border-radius:\s*0 0 20px 20px\s*!important/);
    assert.match(css, /#mobile-menu-drawer\.mm-drawer\s*\{[^}]*background:\s*#e9f3fc\s*!important/);

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
    assert.match(css, /\.mm-drawer\.-translate-y-full\s*\{\s*transform:\s*translateY\(-100%\)\s*!important/);
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
