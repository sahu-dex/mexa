/**
 * The gallery play buttons are round brand-blue discs.
 *
 * They used to be white rounded rectangles (60x50, radius 14px) floating on the
 * thumbnails, so each card looked like it had a loose white box in the middle.
 * Every page ships its own white rule — some of them !important — so the shared
 * gallery sheet has to out-specify each of them, exactly like the video
 * player's controls.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (p) => fs.readFileSync(p, 'utf8');
const GALLERY = 'assets/css/video-clean-player.css';

test('the shared gallery sheet is loaded after the page sheets', () => {
    const php = read('includes/functions.php');
    const gallery = php.indexOf("'assets/css/video-clean-player.css");
    const player = php.indexOf("'assets/css/video-player.css");
    assert.ok(gallery > 0, 'the gallery sheet is part of every page');
    assert.ok(player > gallery, 'the gallery sheet loads before the player sheet');
    assert.match(php, /video-clean-player\.css\?v=/);
});

test('every gallery play button is a circle in the brand blue', () => {
    const css = read(GALLERY);

    // Each gallery: the selector, then a circle and the brand blue.
    const discs = [
        [/body \.pf-card \.pf-play/.source, /border-radius: 50% !important/, /background: #1051df !important/],
        [/html body \.pf-card\.pf-card-short \.pf-play/.source, /border-radius: 50% !important/, /background: #1051df !important/],
        [/body \.wk-rc-play i\b/.source, /background: #1051df !important/, /border-radius: 50% !important/],
        [/body \.wk-short \.wk-short-play/.source, /background: #1051df !important/, /border-radius: 50% !important/],
        [/body \.wk-demo \.ply/.source, /background: #1051df !important/, /border-radius: 50% !important/],
        [/html body \.sv2-hero-video \.sv2-video-btn \.sv2-play/.source, /background: #1051df !important/, /border-radius: 50% !important/]
    ];
    discs.forEach(([selector, ...decls]) => {
        assert.match(css, new RegExp(selector), 'missing the play disc selector: ' + selector);
        decls.forEach((re) => assert.match(css, re, 'the disc is not a round blue shape: ' + re));
    });

    // No white or near-white background is allowed on any of them any more.
    const playRules = css.match(/[^{}]*\.(?:pf-play|wk-rc-play|wk-short-play|ply|sv2-play)[^{}]*\{[^}]*\}/g) || [];
    assert.ok(playRules.length >= 6, 'the sheet actually styles every gallery');
    playRules.forEach((rule) => {
        assert.doesNotMatch(rule, /background:\s*(?:#fff\b|#ffffff\b|rgba\(255,\s*255,\s*255)/i,
            'a play disc is still white: ' + rule.split('{')[0].trim());
    });

    // The triangle inside is white, so it reads on the blue disc.
    assert.match(css, /\.pf-play svg path \{\s*fill: #fff !important;/);
    assert.match(css, /\.sv2-play i \{\s*color: #fff !important;/);
    // The work page disc colours its icon through the shared rule.
    assert.match(css, /body \.wk-rc-play i,\s*body \.wk-short-play,\s*body \.wk-demo \.ply \{[^}]*color: #fff !important/);
});

test('the fixes outrank the per-page white rules they replace', () => {
    const css = read(GALLERY);
    // Real competitors found in the page sheets, and why they are beaten:
    //   .pf-play                       (0,1,0)   -> body .pf-card .pf-play (0,2,1)!
    //   .pf-card-short .pf-play        (0,2,0)   -> html body .pf-card.pf-card-short .pf-play (0,3,2)!
    //   .wk-rc-play i / .wk-short .wk-short-play (0,1,1)/(0,2,0)
    //       -> body .wk-rc-play i (0,1,2)! / body .wk-short .wk-short-play (0,2,1)!
    //   .wk-demo .ply                  (0,2,0)   -> body .wk-demo .ply (0,2,1)!
    //   body .sv2-video-btn .sv2-play  (0,2,1)   -> html body .sv2-hero-video .sv2-video-btn .sv2-play (0,3,2)!
    assert.match(css, /body \.wk-demo \.ply \{[^}]*background: #1051df !important/);
    assert.match(css, /html body \.sv2-hero-video \.sv2-video-btn \.sv2-play \{[^}]*background: #1051df !important/);
    assert.match(css, /body \.wk-short \.wk-short-play \{[^}]*width: 44px/);
});

test('the discs keep their shape and hit area on a phone', () => {
    const css = read(GALLERY);
    const mobile = css.slice(css.indexOf('@media (max-width: 640px)'));
    assert.match(mobile, /body \.pf-card \.pf-play,[\s\S]{0,80}width: 44px;/, 'home disc shrinks, stays round');
    assert.match(mobile, /body \.wk-short \.wk-short-play \{\s*width: 36px;/, 'short disc shrinks, stays round');
    // The border radius is never taken back at any size.
    assert.doesNotMatch(css, /@media[^{]*\{[\s\S]*?\.pf-play[^{}]*\{[^}]*border-radius:\s*(?!50%)/);
});
