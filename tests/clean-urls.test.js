const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

test('no page links to a .php address any more', () => {
    const files = ['includes/header.php', 'includes/footer.php', 'includes/admin_header.php',
        ...fs.readdirSync('pages').map(f => 'pages/' + f),
        ...fs.readdirSync('admin').map(f => 'admin/' + f)];
    for (const file of files) {
        const src = read(file);
        const links = [...src.matchAll(/(?:href|action)="([^"]*)"|Location: ([^'"]+)/g)].map(m => m[1] || m[2]);
        for (const link of links) {
            // API endpoints are form targets, not addresses anyone sees.
            if (/api\//.test(link)) continue;
            assert.doesNotMatch(link, /\.php/, file + ' still links to ' + link);
        }
    }
});

test('Apache and the built-in server both route clean URLs and keep the API untouched', () => {
    const ht = read('.htaccess');
    const router = read('router.php');

    assert.match(ht, /RewriteCond %\{REQUEST_FILENAME\}\.php -f/);
    assert.match(ht, /RewriteCond %\{THE_REQUEST\} \\s\(\/\[\^\?\\s\]\*\)\\\.php\[\?\\s\]/);
    assert.match(ht, /RewriteCond %\{REQUEST_URI\} !\/api\//);
    assert.match(ht, /RewriteCond %\{REQUEST_METHOD\} \^\(GET\|HEAD\)\$/);
    assert.match(ht, /-MultiViews/);

    assert.match(router, /str_starts_with\(\$path, '\/api\/'\)/);
    assert.match(router, /config\|includes\|database\|storage\|pages/);
    // Both entry points fall back to the router under `php -S`.
    assert.match(read('index.php'), /router\.php/);
    assert.match(read('admin/index.php'), /router\.php/);
});

test('admin sessions expire, are bound to the browser and sign out only by POST', () => {
    const fn = read('includes/functions.php');
    const logout = read('admin/logout.php');
    const login = read('admin/login.php');

    assert.match(fn, /MEXA_ADMIN_IDLE_SECONDS/);
    assert.match(fn, /function admin_login_user[\s\S]{0,400}session_regenerate_id\(true\)/);
    assert.match(fn, /function require_admin[\s\S]{0,200}admin_no_cache_headers\(\)/);
    assert.match(logout, /!== 'POST'[\s\S]{0,120}Location: \.\//);
    assert.match(logout, /require_csrf\(false\)/);
    assert.match(login, /require_csrf\(false\)/);
    assert.match(login, /rate_limit_allow\('admin_login'/);
    assert.match(login, /password_verify/);
    // Self-contained page: no third-party stylesheet on the sign-in screen.
    assert.doesNotMatch(login, /https?:\/\//);
});

test('the phone sizing sheet cannot reach desktop', () => {
    const css = read('assets/css/mobile-responsive.css').replace(/\/\*[\s\S]*?\*\//g, '');
    // Every top-level block is a max-width media query or the typography layer
    // (whose only content is one).
    let depth = 0, start = 0; const blocks = [];
    for (let i = 0; i < css.length; i++) {
        if (css[i] === '{') { if (depth === 0) blocks.push(css.slice(start, i).trim()); depth++; }
        else if (css[i] === '}') { depth--; if (depth === 0) start = i + 1; }
    }
    assert.ok(blocks.length >= 2);
    for (const head of blocks) assert.match(head, /^@media \(max-width|^@layer mx-typography$/, 'unguarded block: ' + head);
    assert.match(css, /@layer mx-typography \{\s*@media \(max-width/);
    assert.match(read('includes/functions.php'), /mobile-responsive\.css\?v=/);
});

test('reviews are capped at 100 words on display, on submit and in the form', () => {
    const fn = read('includes/functions.php');
    assert.match(fn, /const MEXA_REVIEW_MAX_WORDS = 100;/);
    assert.match(fn, /'body' => limit_words\(\(string\) \$r\['body'\]\)/);
    assert.match(fn, /function get_featured_reviews[\s\S]{0,700}limit_words/);
    assert.match(read('api/submit-review.php'), /mexa_word_count\(\$body\) > MEXA_REVIEW_MAX_WORDS/);
    assert.match(read('assets/js/page-review.js'), /wordCount\(bodyVal\) > MAX_WORDS/);
});

test('review cards scroll: page is never trapped and long text scrolls in place', () => {
    const css = read('assets/css/section-additions.css');
    const js = read('assets/js/site-common.js');
    assert.match(css, /\.reviews-container\s*\{[^}]*overscroll-behavior-y:\s*auto\s*!important/);
    assert.match(css, /\.rv-quote\s*\{[^}]*overflow-y:\s*auto\s*!important/);
    // A press on an overflowing review must not start a row drag.
    assert.match(js, /closest\('\.rv-quote\.is-scrollable'\)/);
    // Wheel scrolling stays native: the slider adds no wheel listener.
    assert.doesNotMatch(js.slice(js.indexOf('initReviewSlider')), /addEventListener\('wheel'/);
});

test('home has Seen More under services and work, in the existing style', () => {
    const home = read('pages/index.php');
    const links = [...home.matchAll(/<a href="([^"]+)" class="seen-more-link"/g)].map(m => m[1]);
    assert.deepEqual(links, ['service', 'work', 'review']);
});

test('service page: no deliverables, and a contact card with a working ticket form', () => {
    const page = read('pages/service.php');
    const js = read('assets/js/page-service.js');
    assert.doesNotMatch(page, /sv2-deliv|Deliverables|\$s\['deliverables'\]/);
    assert.doesNotMatch(js, /sv2-deliv|deliverables/i);

    assert.match(page, /WP Message Me/);
    assert.match(page, /TG Message Me/);
    assert.match(page, /https:\/\/wa\.me\//);
    assert.match(page, /id="ticket-form"[^>]*action="api\/submit-ticket\.php"/);
    for (const name of ['name', 'whatsapp', 'message']) assert.match(page, new RegExp('name="' + name + '"'));
    assert.match(page, /csrf_field\(\)/);

    const api = read('api/submit-ticket.php');
    assert.match(api, /require_csrf\(true\)/);
    assert.match(api, /rate_limit_allow\('ticket_submit'/);
    assert.match(api, /INSERT INTO `messages`/);
    assert.match(api, /'ticket' => \$ticketRef/);
});
