const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

const PAGE_FILES = ['pages/index.php', 'pages/work.php', 'pages/service.php'];

test('every public page loads the one shared video player', () => {
    const styles = read('includes/functions.php');
    const footer = read('includes/footer.php');

    assert.match(styles, /assets\/css\/video-player\.css/);
    assert.match(footer, /assets\/js\/video-player\.js/);
    assert.doesNotMatch(styles, /video-close-button\.css/);
    assert.equal(fs.existsSync('assets/css/video-close-button.css'), false);
});

test('pages do not ship their own video modal or close button', () => {
    PAGE_FILES.forEach((page) => {
        const markup = read(page);
        assert.doesNotMatch(markup, /data-mxvp-close/, page + ' must not define its own player close button');
        assert.doesNotMatch(
            markup,
            /id="(?:mm-work-modal|wk-modal|sv2-video|showreel-modal)"/,
            page + ' must not ship a page-specific video modal'
        );
        assert.doesNotMatch(markup, /class="(?:mmvp-close|wk-modal-x|showreel-close)"/, page + ' must not ship a legacy close button');
        assert.doesNotMatch(markup, /&times;/, page + ' must not render a text close glyph');
    });
});

test('the player renders exactly one close button with no generated × glyph', () => {
    const js = read('assets/js/video-player.js');
    const css = read('assets/css/video-player.css');

    assert.equal((js.match(/class="mxvp__close"/g) || []).length, 1);
    assert.equal((js.match(/data-mxvp-close/g) || []).length, 1);
    assert.doesNotMatch(css, /content\s*:\s*['"]\s*(?:\\00d7|\\d7|×)/i);
    assert.doesNotMatch(css, /mxvp__close\s*::?(?:before|after)/);
});

test('YouTube clips play through a chrome-free frame driven by postMessage', () => {
    const js = read('assets/js/video-player.js');

    assert.match(js, /mode: 'youtube'/, 'YouTube gets its own playback mode');
    assert.match(js, /function youtubeFrameUrl\(/, 'builds the embed URL itself');
    assert.match(js, /youtube(?:-nocookie)?\.com\/embed\//, 'embeds the clip directly');
    // No third-party script anymore: an ad blocker can no longer break the
    // player, which is exactly what used to fall back to YouTube chrome.
    assert.doesNotMatch(js, /youtube\.com\/iframe_api/, 'no dependency on the blockable iframe_api script');
    assert.doesNotMatch(js, /new YT\.Player\(/);

    // Every piece of YouTube chrome is switched off in the URL ...
    [
        "'controls=' + (nativeUi ? '1' : '0')",
        'modestbranding=1',
        'rel=0',
        'showinfo=0',
        'iv_load_policy=3',
        'disablekb=1',
        "'fs=' + (nativeUi ? '1' : '0')",
        'autoplay=1',
        'playsinline=1',
        'enablejsapi=1'
    ].forEach((needle) => {
        assert.ok(js.includes(needle), 'YouTube parameter missing: ' + needle);
    });

    // ... and our bar drives it over postMessage.
    assert.match(js, /event: 'command', func: func/, 'sends YouTube command messages');
    assert.match(js, /event: 'listening'/, 'asks the frame for player events');
    ['playVideo', 'pauseVideo', 'seekTo', 'setVolume', 'mute', 'unMute'].forEach((func) => {
        assert.ok(js.includes("'" + func + "'"), 'command missing: ' + func);
    });
    assert.match(js, /addEventListener\('message', onYtMessage\)/, 'listens for the frame');
    assert.match(js, /onStateChange/, 'reads player state');
    assert.match(js, /infoDelivery/, 'reads position and duration');

    // The end screen ("More videos") is hidden behind our own replay plate.
    assert.match(js, /showEndPlate\(/);
    assert.match(read('assets/css/video-player.css'), /\.mxvp\.is-ended \.mxvp__media/);
});

test('a YouTube frame that cannot be scripted still plays with YouTube controls', () => {
    const js = read('assets/js/video-player.js');

    assert.match(js, /function degradeYoutube\(reason\)/, 'degradation helper exists');
    assert.match(js, /var YT_HANDSHAKE_TIMEOUT = \d+;/, 'handshake watchdog exists');
    assert.match(js, /degradeYoutube\('no answer from the frame'\)/, 'silent frame -> native controls');
    assert.match(js, /degradeYoutube\('player error '/, 'player error -> native controls');
    assert.match(js, /degradeYoutube\('playback did not start'\)/, 'rejected play -> native controls');
    assert.match(js, /ytNativeUi = true;/, 'the working mode is remembered');
    assert.match(js, /is-embed/, 'our bar is hidden when YouTube draws its own');

    // A throw anywhere in the mount path must not leave an empty player.
    assert.match(js, /catch \(err\) \{\s*\/\/ Never leave the viewer with an empty player/);
});

test('the close button sits on the very top-right corner of the player', () => {
    const css = read('assets/css/video-player.css');
    const close = css.match(/\n\.mxvp__close \{([^}]*)\}/);
    assert.ok(close, 'close button rule exists');
    assert.match(close[1], /top:\s*-\d+px/, 'close button sits above the top edge of the stage');
    assert.match(close[1], /right:\s*-\d+px/, 'close button sits past the right edge of the stage');
    // Style itself is unchanged (size, colours, icon).
    assert.match(close[1], /width:\s*40px/);
    assert.match(close[1], /height:\s*40px/);
    assert.match(close[1], /border-radius:\s*50%/);
});

test('the shared player offers the full control set', () => {
    const js = read('assets/js/video-player.js');

    [
        'data-mxvp-play',
        'data-mxvp-back',
        'data-mxvp-forward',
        'data-mxvp-seek',
        'data-mxvp-volume',
        'data-mxvp-fullscreen',
        'data-mxvp-mute'
    ].forEach((hook) => {
        assert.match(js, new RegExp(hook), 'missing control: ' + hook);
    });

    assert.match(js, /SKIP_SECONDS = 10/);
    assert.match(js, /requestFullscreen/);
    assert.match(js, /togglePlay/);
    assert.match(js, /skip\(-SKIP_SECONDS\)/);
    assert.match(js, /skip\(SKIP_SECONDS\)/);
});

test('the player is initialised once and keeps a single listener set', () => {
    const js = read('assets/js/video-player.js');

    assert.match(js, /if \(window\.MexaVideoPlayer && window\.MexaVideoPlayer\.isReady\) return;/);
    assert.match(js, /if \(built\) return;/);
    assert.match(js, /pauseEverythingElse\(/);
    assert.match(js, /function close\(/);
});

test('video cards and player dialogs do not render per-video metadata', () => {
    const home = read('pages/index.php');
    const work = read('pages/work.php');
    const workJs = read('assets/js/page-work.js');
    const js = read('assets/js/video-player.js');

    assert.doesNotMatch(home, /class="mmvp-meta"/);
    assert.doesNotMatch(work, /class="(?:info|cap)"|id="wk-modal-(?:title|desc)"/);
    assert.doesNotMatch(workJs, /class="(?:info|cap|wk-rc-featured)"|wk-modal-(?:title|desc)/);

    // Custom controls only: no native control bar duplicated on top of them.
    assert.doesNotMatch(js, /\.controls\s*=\s*true/);
    assert.doesNotMatch(js, /controls autoplay playsinline/);
    // No title/description panel next to the video.
    assert.doesNotMatch(js, /mxvp__(?:title|desc|meta|caption)/);
});
