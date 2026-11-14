const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (path) => fs.readFileSync(path, 'utf8');

test('one helper describes both video sources — upload and link', () => {
    const php = read('includes/functions.php');

    assert.match(php, /function video_source_meta\(string \$url, string \$kind = 'video'\): array/);

    // Uploaded files play in the native <video> element.
    assert.match(php, /'embed_type' => \$isImage \? 'image' : 'video'/);
    assert.match(php, /'embed_provider' => \$isImage \? 'image' : 'local'/);

    // Links resolve to the exactly right embed for the platform.
    assert.match(php, /https:\/\/www\.youtube-nocookie\.com\/embed\/' \. \$youtubeId/);
    assert.match(php, /https:\/\/player\.vimeo\.com\/video\/' \. \$m\[1\]/);
    assert.match(php, /https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=' \. rawurlencode\(\$url\)/);

    // Anything else embeddable is framed as-is.
    assert.match(php, /'embed_url' => \$url,/);
});

test('the admin API stores what the player needs for every source', () => {
    const api = read('api/admin/work.php');

    assert.match(api, /\$sourceMeta = video_source_meta\(\$filePath, \$kind\);/, 'source is derived from the media');
    assert.match(api, /\$platform = \$sourceMeta\['platform'\];/, 'the platform badge follows the source');

    const inserts = api.match(/`embed_type` = :embed_type, `embed_provider` = :embed_provider, `embed_url` = :embed_url/g) || [];
    assert.ok(inserts.length >= 1, 'updates refresh the embed columns');

    const params = api.match(/':embed_type' => \$sourceMeta\['embed_type'\]/g) || [];
    assert.equal(params.length, 2, 'create and update both write the embed metadata');

    // Uploads are validated and stored on the server, links are not uploaded.
    assert.match(api, /upload_media\(\$_FILES\['media_file'\]/);
    assert.match(api, /if \(\$filePath === ''\)/);
});

test('the admin form offers the two systems side by side', () => {
    const admin = read('admin/work.php');

    assert.match(admin, /name="file_path"/, 'link field');
    assert.match(admin, /Video link — YouTube, Facebook, Vimeo or any embed URL/);
    assert.match(admin, /name="media_file"/, 'upload field');
    assert.match(admin, /or upload a video file \(MP4, WebM, MOV/, 'upload label');
    assert.match(admin, /accept="video\/mp4,video\/webm,video\/quicktime"/);

    // The admin can check the media they published without leaving the panel.
    assert.match(admin, /target="_blank" rel="noopener" title="Open the media in a new tab"/);
});

test('every provider plays through the one shared player', () => {
    const js = read('assets/js/video-player.js');
    const css = read('assets/css/video-player.css');

    // A transparent sink makes "click the picture to pause" work even over a
    // YouTube frame, which would otherwise swallow the click.
    assert.match(js, /mxvp__sink/);
    assert.match(css, /\.mxvp__sink \{/);

    // Stored Facebook plugin URLs are not wrapped a second time.
    assert.match(js, /facebook\\\.com\\\/plugins\\\/video\\\.php/i);
    assert.match(js, /return withParam\(url, 'autoplay', 'true'\)/);

    // Local files start as soon as the player opens.
    assert.match(js, /video\.preload = 'auto'/);
});

test('shorts keep their 9:16 box in fullscreen on every device', () => {
    const css = read('assets/css/video-player.css');

    assert.match(css, /\.mxvp\.is-vertical \.mxvp__stage:fullscreen/);
    assert.match(css, /\.mxvp\.is-vertical\.is-pseudo-fullscreen \.mxvp__stage/);
    assert.match(css, /width: min\(100vw, calc\(100vh \* 9 \/ 16\)\)/, 'fullscreen is as wide as the picture, never stretched');
    assert.match(css, /object-fit: contain/, 'video keeps its aspect ratio');
});

test('YouTube clips get the same clean controls as uploaded files', () => {
    const js = read('assets/js/video-player.js');
    const css = read('assets/css/video-player.css');

    // One bar, one set of controls: the YouTube mode only swaps the transport.
    const template = js.slice(js.indexOf('var TEMPLATE ='), js.indexOf('var refs = {}'));
    const barCount = (template.match(/data-mxvp-bar/g) || []).length;
    assert.equal(barCount, 1, 'exactly one control bar for every provider');

    // The picture stays bare for YouTube too: nothing in the middle to cover
    // the clip, and the same double tap applies.
    assert.doesNotMatch(template, /mxvp__center|mxvp__cc/, 'no centre controls in either mode');
    assert.match(js, /function handleStageTap\(event, source\)/);
    assert.match(js, /if \(mode === 'youtube'\) return ytPlayerState === YT_PLAYING;/);

    // YouTube branding, title, channel and the related rail stay switched off.
    // Official embed parameters only — no undocumented tricks.
    ['controls=' , 'modestbranding=1', 'rel=0', 'showinfo=0', 'iv_load_policy=3', 'disablekb=1', 'fs=']
        .forEach((needle) => assert.ok(js.includes(needle), 'embed parameter missing: ' + needle));

    // Mute and level are separate, so the bar never shows "0 volume" for a mute.
    assert.match(js, /if \(mode === 'youtube'\) return ytVolume \/ 100;/);
    assert.match(js, /if \(!draggingVolume\) refs\.volume\.value = String\(volume\);/);
    assert.match(js, /The slider shows the real level; only the icon says "muted"/);
});

test('the site-wide form styling cannot turn the player controls white', () => {
    const css = read('assets/css/video-player.css');
    const site = read('assets/css/premium-design-system.css');

    // The culprit: every non-checkbox input is painted white with !important.
    assert.match(site, /body :is\(input:not\(\[type=radio\]\)[^{]*\{background:#fff!important/, 'site rule still exists');

    // The player therefore resets its two sliders with higher specificity and
    // pinned properties, so no white pill can appear in the control bar.
    ['seek', 'volume'].forEach((name) => {
        const rule = css.match(new RegExp('body \\.mxvp \\.mxvp__' + name + ' \\{([^}]*)\\}'));
        assert.ok(rule, name + ' is reset under body .mxvp');
        assert.match(rule[1], /appearance:\s*none !important/, name + ' drops the native look');
        assert.match(rule[1], /background:\s*transparent !important/, name + ' is not white');
        assert.match(rule[1], /border:\s*0 !important/, name + ' has no field border');
        assert.match(rule[1], /border-radius:\s*999px !important/, name + ' keeps its own radius');
        assert.match(rule[1], /box-shadow:\s*none !important/, name + ' has no field shadow');
    });

    // Buttons are real buttons, never form fields.
    const btn = css.match(/body \.mxvp \.mxvp__btn \{([^}]*)\}/)[1];
    assert.match(btn, /background:\s*transparent !important/);
    assert.match(btn, /border-radius:\s*50% !important/);
    assert.match(btn, /padding:\s*0 !important/);
    assert.match(btn, /box-shadow:\s*none !important/);
    // There is no leftover pill-shaped element in the bar at all.
    assert.doesNotMatch(css, /\.mxvp__bar[\s\S]{0,200}border-radius:\s*999px;\s*background:\s*#fff/);
});

test('the timeline is a dark track with a coloured played part and handle', () => {
    const css = read('assets/css/video-player.css');

    const track = css.match(/\.mxvp__seek::-webkit-slider-runnable-track \{([^}]*)\}/)[1];
    assert.match(track, /height:\s*4px/);
    assert.match(track, /border-radius:\s*999px/, 'rounded corners');
    assert.match(track, /var\(--mxvp-accent\) 0 var\(--mxvp-played\)/, 'played part uses the accent');
    assert.match(track, /rgba\(255, 255, 255, \.28\)/, 'unplayed part is dim grey, not white');

    const thumb = css.match(/\.mxvp__seek::-webkit-slider-thumb \{([^}]*)\}/)[1];
    assert.match(thumb, /background:\s*var\(--mxvp-accent\) !important/, 'the handle matches the played colour');

    // YouTube and Shorts get YouTube red; an uploaded video keeps its blue.
    assert.match(css, /body \.mxvp\.is-youtube \.mxvp__seek,\s*\nbody \.mxvp\.is-vertical \.mxvp__seek \{\s*--mxvp-accent:\s*#ff0033;/);
    assert.match(css, /--mxvp-accent:\s*#2f7cf6;/);

    // The handle thickens under the pointer, like YouTube's.
    assert.match(css, /\.mxvp__seek:hover::-webkit-slider-runnable-track[^{]*\{[^}]*height:\s*5px/);
});

test('the fullscreen control stays inside a 9:16 Short on every screen', () => {
    const css = read('assets/css/video-player.css');

    // The bar is laid out from the player's own width, not the viewport's.
    assert.match(css, /container-type:\s*inline-size/);
    assert.match(css, /container-name:\s*mxvp-stage/);
    assert.match(css, /@container mxvp-stage \(max-width: 430px\)/);
    assert.match(css, /@container mxvp-stage \(max-width: 340px\)/);
    assert.match(css, /@container mxvp-stage \(max-width: 310px\)/);

    // Fullscreen is pinned to the right of the row and can never be pushed out.
    assert.match(css, /body \.mxvp \.mxvp__btn--fs \{\s*margin-inline-start:\s*auto !important;/);
    assert.match(css, /\.mxvp__row \{[^}]*flex-wrap:\s*nowrap/);
    // The volume slider gives way before anything leaves the player.
    assert.match(css, /body \.mxvp \.mxvp__volume \{[^}]*min-width:\s*26px/);

    // 9:16 is untouched, in and out of fullscreen.
    assert.match(css, /\.mxvp\.is-vertical \.mxvp__stage \{[^}]*aspect-ratio:\s*9 \/ 16/);
    assert.match(
        css,
        /\.mxvp\.is-vertical \.mxvp__stage:fullscreen,[^}]*aspect-ratio:\s*9 \/ 16/,
        'fullscreen keeps the vertical box'
    );
});

test('a Short is never handed to the native fullscreen player', () => {
    const js = read('assets/js/video-player.js');

    assert.match(js, /function isVertical\(\)/);
    assert.match(js, /if \(!isVertical\(\) && currentVideo\(\) && currentVideo\(\)\.webkitEnterFullscreen\)/,
        'the 9:16 path stays on our own fullscreen');
});
