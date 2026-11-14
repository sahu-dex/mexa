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
