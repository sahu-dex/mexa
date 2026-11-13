/**
 * MEXA MOTION — shared video player (window.MMPlayer).
 *
 * Every video preview on the site (Home, Service, Work) opens in this one
 * component, so the player looks and behaves the same everywhere:
 *
 *   - exactly one Close (×) button, drawn by a single inline SVG;
 *   - Play/Pause, 10s back (left), 10s forward (right), seekable progress
 *     bar, volume + mute and fullscreen;
 *   - nothing but the video and its controls on screen (no title or copy);
 *   - 16:9, 9:16 or any other ratio without distortion;
 *   - only one video at a time, and closing always stops playback and sound.
 *
 * Usage from a page controller:
 *
 *   window.MMPlayer.open({
 *       src: 'uploads/videos/clip.mp4',   // file URL or YouTube/Vimeo/Facebook link
 *       embed: '',                        // optional provider embed URL
 *       type: '',                         // optional: 'iframe' | 'link' | 'image'
 *       kind: 'video',                    // 'video' | 'image'
 *       poster: 'uploads/images/clip.jpg',
 *       vertical: false,                  // true for 9:16 Shorts
 *       title: 'Used for screen readers only — never displayed',
 *       trigger: clickedElement           // focus returns here on close
 *   });
 *   window.MMPlayer.close();
 */
(function (root) {
    'use strict';

    var SKIP_SECONDS = 10;
    var HIDE_DELAY = 2600;
    var INTENT_WINDOW = 500;
    var YT_ORIGIN = 'https://www.youtube-nocookie.com';
    var YT_WIDGET_ID = 1;
    var YT_HANDSHAKE_TIMEOUT = 6000;
    var VIMEO_ORIGIN = 'https://player.vimeo.com';
    var FRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

    /* ------------------------------------------------------------------ *
     * Pure helpers — no DOM access. Exported for the Node test-suite.
     * ------------------------------------------------------------------ */

    function trim(value) {
        return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '');
    }

    /**
     * Only http(s) and site-relative addresses may reach a src or href.
     * Anything else (javascript:, data:, vbscript: ...) is dropped, so stored
     * content can never run script through the player.
     */
    function safeUrl(value) {
        // Browsers skip control characters while reading a URL scheme.
        var url = trim(String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]+/g, ''));
        var scheme = /^([a-z][a-z0-9+.\-]*):/i.exec(url);
        if (scheme && !/^https?$/i.test(scheme[1])) return '';
        return url;
    }

    function clamp(value, min, max) {
        value = Number(value);
        if (!isFinite(value)) value = min;
        return Math.min(max, Math.max(min, value));
    }

    function formatTime(seconds) {
        var total = Math.floor(Number(seconds));
        if (!isFinite(total) || total < 0) total = 0;
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function youtubeId(url) {
        var m = String(url || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{6,})/i);
        // "embed/videoseries?list=…" is a playlist embed, not a video id.
        return m && m[1] !== 'videoseries' ? m[1] : '';
    }

    function youtubeStart(url) {
        var m = /[?&#](?:t|start)=([0-9hms]+)/i.exec(String(url || ''));
        if (!m) return 0;
        if (/^\d+$/.test(m[1])) return Number(m[1]);
        var total = 0;
        m[1].replace(/(\d+)([hms])/gi, function (all, amount, unit) {
            unit = unit.toLowerCase();
            total += Number(amount) * (unit === 'h' ? 3600 : unit === 'm' ? 60 : 1);
            return all;
        });
        return total;
    }

    function vimeoRef(url) {
        var s = String(url || '');
        if (!/vimeo\.com\//i.test(s)) return null;
        var m = s.match(/vimeo\.com\/(?:[^?#]*\/)?videos?\/(\d+)(?:\/([0-9a-z]+))?/i)
            || s.match(/vimeo\.com\/(?:channels\/[^\/?#]+\/|groups\/[^\/?#]+\/)?(\d+)(?:\/([0-9a-z]+))?/i);
        if (!m) return null;
        var hash = m[2] || ((s.match(/[?&]h=([0-9a-z]+)/i) || [])[1] || '');
        return { id: m[1], hash: hash };
    }

    function isFacebookUrl(url) {
        return /^(?:(?:https?:)?\/\/)?(?:[\w-]+\.)*(?:facebook\.com|fb\.watch|fb\.me)(?:[\/?#]|$)/i.test(trim(url));
    }

    function isImageUrl(url) {
        return /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(String(url || ''));
    }

    function query(params) {
        var parts = [];
        for (var key in params) {
            if (Object.prototype.hasOwnProperty.call(params, key) && params[key] != null && params[key] !== '') {
                parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
            }
        }
        return parts.join('&');
    }

    /** Add or replace query parameters while keeping any #fragment. */
    function withParams(url, params) {
        url = String(url || '');
        if (!url) return url;
        var hash = '';
        var hashAt = url.indexOf('#');
        if (hashAt !== -1) {
            hash = url.slice(hashAt);
            url = url.slice(0, hashAt);
        }
        for (var key in params) {
            if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
            var pair = encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            var re = new RegExp('([?&])' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=[^&]*');
            if (re.test(url)) url = url.replace(re, '$1' + pair);
            else url += (url.indexOf('?') === -1 ? '?' : '&') + pair;
        }
        return url + hash;
    }

    /**
     * YouTube embed URL. With `api` the provider chrome is switched off and the
     * player is driven by our own control bar through the IFrame Player API;
     * without it YouTube keeps its own controls (used as the safe fallback).
     */
    function youtubeEmbedUrl(id, options) {
        var o = options || {};
        var params = { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 };
        if (o.start) params.start = o.start;
        if (o.api) {
            params.controls = 0;
            params.disablekb = 1;
            params.fs = 0;
            params.iv_load_policy = 3;
            params.enablejsapi = 1;
            params.widgetid = YT_WIDGET_ID;
            if (o.origin) params.origin = o.origin;
        }
        return YT_ORIGIN + '/embed/' + encodeURIComponent(id) + '?' + query(params);
    }

    /** Vimeo embed URL: plays inline, without the title / author overlay. */
    function vimeoEmbedUrl(ref) {
        var params = { autoplay: 1, playsinline: 1, title: 0, byline: 0, portrait: 0 };
        if (ref.hash) params.h = ref.hash;
        return VIMEO_ORIGIN + '/video/' + encodeURIComponent(ref.id) + '?' + query(params);
    }

    function facebookEmbedUrl(url) {
        return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url) + '&show_text=false&autoplay=true';
    }

    function providerOf(url) {
        if (!url) return null;
        var yt = youtubeId(url);
        if (yt) {
            return {
                provider: 'youtube',
                id: yt,
                start: youtubeStart(url),
                vertical: /youtube\.com\/shorts\//i.test(url),
                externalUrl: 'https://www.youtube.com/watch?v=' + yt
            };
        }
        var vm = vimeoRef(url);
        if (vm) {
            return {
                provider: 'vimeo',
                id: vm.id,
                hash: vm.hash,
                externalUrl: 'https://vimeo.com/' + vm.id + (vm.hash ? '/' + vm.hash : '')
            };
        }
        if (isFacebookUrl(url)) {
            return { provider: 'facebook', url: url, externalUrl: url };
        }
        return null;
    }

    /**
     * Decide how a media item must be played. This is the single place that
     * maps a file path / link / embed URL to a provider for the whole site.
     */
    function resolveSource(options) {
        var o = options || {};
        var src = safeUrl(o.src);
        var embed = safeUrl(o.embed);
        var type = trim(o.type).toLowerCase();
        var kind = trim(o.kind).toLowerCase();
        var poster = safeUrl(o.poster);
        var out = {
            provider: 'none',
            url: '',
            externalUrl: src || embed,
            vertical: !!o.vertical,
            poster: poster,
            title: trim(o.title)
        };

        function merge(found) {
            for (var key in found) {
                if (Object.prototype.hasOwnProperty.call(found, key)) {
                    if (key === 'vertical') out.vertical = out.vertical || found.vertical;
                    else out[key] = found[key];
                }
            }
            return out;
        }

        if (kind === 'image' || type === 'image') {
            if (src || poster) merge({ provider: 'image', url: src || poster, externalUrl: src || poster });
            return out;
        }
        if (type === 'link') {
            if (src || embed) merge({ provider: 'link', url: src || embed, label: trim(o.provider) });
            return out;
        }

        var fromEmbed = providerOf(embed);
        if (fromEmbed) return merge(fromEmbed);
        if (embed && type === 'iframe') return merge({ provider: 'iframe', url: embed, externalUrl: embed });

        var fromSrc = providerOf(src);
        if (fromSrc) return merge(fromSrc);
        if (src) return merge({ provider: isImageUrl(src) ? 'image' : 'file', url: src, externalUrl: src });
        if (embed) return merge({ provider: 'iframe', url: embed, externalUrl: embed });
        return out;
    }

    /* ------------------------------------------------------------------ *
     * Markup (plain strings, so the tests can check it without a browser)
     * ------------------------------------------------------------------ */

    function icon(name, body) {
        return '<svg class="mmp-ic mmp-ic-' + name + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
    }

    var ICON_PLAY = icon('play', '<path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.4-6.4a1 1 0 0 0 0-1.7l-10.4-6.4A1 1 0 0 0 8 5.6z"/>');
    var ICON_PAUSE = icon('pause', '<rect x="6.2" y="4.8" width="4.2" height="14.4" rx="1"/><rect x="13.6" y="4.8" width="4.2" height="14.4" rx="1"/>');
    var ICON_REPLAY = icon('replay', '<path d="M12 5.2V2.4L7.6 6.3 12 10.2V7.4a5.6 5.6 0 1 1-5.6 5.6H4.2A7.8 7.8 0 1 0 12 5.2z"/>');
    var ICON_BACK = icon('back',
        '<path class="mmp-ic-line" d="M12 5.5a7.7 7.7 0 1 1-7.7 7.7"/>' +
        '<path d="M12.4 1.9v7.2L7.4 5.5z"/>' +
        '<path class="mmp-ic-line" d="M9.1 11.3l1.4-.95v5.9"/>' +
        '<ellipse class="mmp-ic-line" cx="14.3" cy="13.3" rx="1.75" ry="2.95"/>');
    var ICON_FORWARD = icon('forward',
        '<path class="mmp-ic-line" d="M12 5.5a7.7 7.7 0 1 0 7.7 7.7"/>' +
        '<path d="M11.6 1.9v7.2l5-3.6z"/>' +
        '<path class="mmp-ic-line" d="M9.1 11.3l1.4-.95v5.9"/>' +
        '<ellipse class="mmp-ic-line" cx="14.3" cy="13.3" rx="1.75" ry="2.95"/>');
    var ICON_VOLUME = icon('volume',
        '<path d="M4 9.4h3.2l4.2-3.7a.6.6 0 0 1 1 .45v11.7a.6.6 0 0 1-1 .45l-4.2-3.7H4a.6.6 0 0 1-.6-.6v-4a.6.6 0 0 1 .6-.6z"/>' +
        '<path class="mmp-ic-line mmp-ic-wave1" d="M15.3 9.3a3.8 3.8 0 0 1 0 5.4"/>' +
        '<path class="mmp-ic-line mmp-ic-wave2" d="M17.7 6.8a7.3 7.3 0 0 1 0 10.4"/>');
    var ICON_MUTED = icon('muted',
        '<path d="M4 9.4h3.2l4.2-3.7a.6.6 0 0 1 1 .45v11.7a.6.6 0 0 1-1 .45l-4.2-3.7H4a.6.6 0 0 1-.6-.6v-4a.6.6 0 0 1 .6-.6z"/>' +
        '<path class="mmp-ic-line" d="M15.6 9.6l4.8 4.8M20.4 9.6l-4.8 4.8"/>');
    var ICON_FS_ENTER = icon('fs-enter', '<path class="mmp-ic-line" d="M4.5 9.2V4.5h4.7M14.8 4.5h4.7v4.7M19.5 14.8v4.7h-4.7M9.2 19.5H4.5v-4.7"/>');
    var ICON_FS_EXIT = icon('fs-exit', '<path class="mmp-ic-line" d="M9.2 4.5v4.7H4.5M19.5 9.2h-4.7V4.5M14.8 19.5v-4.7h4.7M4.5 14.8h4.7v4.7"/>');
    var ICON_EXTERNAL = icon('external', '<path class="mmp-ic-line" d="M13.5 5H19v5.5M19 5l-8.2 8.2M10 6.5H6.5A1.5 1.5 0 0 0 5 8v9.5A1.5 1.5 0 0 0 6.5 19H16a1.5 1.5 0 0 0 1.5-1.5V14"/>');
    // The one and only close cross: a single SVG (white disc + cross). The
    // button holds no text node and no icon font, so it can never double up.
    var ICON_CLOSE = '<svg class="mmp-close-svg" viewBox="0 0 34 34" aria-hidden="true" focusable="false">' +
        '<circle class="mmp-close-disc" cx="17" cy="17" r="16.5"/>' +
        '<path class="mmp-close-x" d="M12.9 12.9l8.2 8.2M21.1 12.9l-8.2 8.2"/></svg>';

    var TEMPLATE =
        '<div class="mmp-backdrop" data-mmp-dismiss></div>' +
        '<div class="mmp-frame" data-mmp-frame>' +
            '<button type="button" class="mmp-close" data-mmp-close aria-label="Close video" title="Close">' + ICON_CLOSE + '</button>' +
            '<div class="mmp-stage" data-mmp-stage tabindex="-1">' +
                '<div class="mmp-media" data-mmp-media></div>' +
                '<div class="mmp-shield" data-mmp-shield></div>' +
                '<div class="mmp-spinner" data-mmp-spinner aria-hidden="true"></div>' +
                '<div class="mmp-center" data-mmp-center>' +
                    '<button type="button" class="mmp-skip mmp-skip-back" data-mmp-back aria-label="Rewind 10 seconds" title="Rewind 10 seconds">' + ICON_BACK + '</button>' +
                    '<button type="button" class="mmp-bigplay" data-mmp-toggle aria-label="Play">' + ICON_PLAY + ICON_PAUSE + ICON_REPLAY + '</button>' +
                    '<button type="button" class="mmp-skip mmp-skip-forward" data-mmp-forward aria-label="Forward 10 seconds" title="Forward 10 seconds">' + ICON_FORWARD + '</button>' +
                '</div>' +
                '<div class="mmp-bar" data-mmp-bar>' +
                    '<div class="mmp-progress" data-mmp-progress role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="0:00 of 0:00">' +
                        '<div class="mmp-progress-track" data-mmp-track>' +
                            '<div class="mmp-progress-buffer"></div>' +
                            '<div class="mmp-progress-fill"></div>' +
                        '</div>' +
                        '<div class="mmp-progress-thumb"></div>' +
                        '<div class="mmp-progress-tip" data-mmp-tip aria-hidden="true">0:00</div>' +
                    '</div>' +
                    '<div class="mmp-row">' +
                        '<button type="button" class="mmp-btn mmp-play" data-mmp-toggle aria-label="Play">' + ICON_PLAY + ICON_PAUSE + ICON_REPLAY + '</button>' +
                        '<button type="button" class="mmp-btn mmp-mute" data-mmp-mute aria-label="Mute">' + ICON_VOLUME + ICON_MUTED + '</button>' +
                        '<div class="mmp-volume" data-mmp-volume role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" aria-valuetext="100%">' +
                            '<div class="mmp-volume-track" data-mmp-track><div class="mmp-volume-fill"></div></div>' +
                            '<div class="mmp-volume-thumb"></div>' +
                        '</div>' +
                        '<div class="mmp-time" aria-hidden="true"><span data-mmp-current>0:00</span><span class="mmp-time-sep">/</span><span data-mmp-duration>0:00</span></div>' +
                        '<div class="mmp-spacer"></div>' +
                        '<button type="button" class="mmp-btn mmp-fs" data-mmp-fullscreen aria-label="Full screen">' + ICON_FS_ENTER + ICON_FS_EXIT + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="mmp-panel" data-mmp-panel hidden>' +
                    '<div class="mmp-panel-text" data-mmp-panel-text></div>' +
                    '<div class="mmp-panel-actions">' +
                        '<button type="button" class="mmp-action" data-mmp-retry>Try again</button>' +
                        '<a class="mmp-action" data-mmp-external target="_blank" rel="noopener noreferrer">' + ICON_EXTERNAL + '<span data-mmp-external-label>Open in a new tab</span></a>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="mmp-sr" data-mmp-status role="status" aria-live="polite"></div>';

    var helpers = {
        SKIP_SECONDS: SKIP_SECONDS,
        TEMPLATE: TEMPLATE,
        safeUrl: safeUrl,
        clamp: clamp,
        formatTime: formatTime,
        youtubeId: youtubeId,
        youtubeStart: youtubeStart,
        vimeoRef: vimeoRef,
        isFacebookUrl: isFacebookUrl,
        isImageUrl: isImageUrl,
        withParams: withParams,
        youtubeEmbedUrl: youtubeEmbedUrl,
        vimeoEmbedUrl: vimeoEmbedUrl,
        facebookEmbedUrl: facebookEmbedUrl,
        resolveSource: resolveSource
    };

    if (typeof module === 'object' && module && module.exports) module.exports = helpers;
    if (!root || !root.document) return;

    /* ------------------------------------------------------------------ *
     * Browser component
     * ------------------------------------------------------------------ */

    var window = root;
    var document = root.document;

    // Guard against a second include: one player, one set of listeners.
    if (window.MMPlayer && window.MMPlayer.__mmPlayer) return;

    var el = null;          // DOM references, created on first open()
    var adapter = null;     // active media adapter
    var current = null;     // options of the item on screen (for "Try again")
    var trigger = null;     // element that opened the player
    var resumeList = [];    // background media paused while the player is open
    var hideTimer = 0;
    var rafId = 0;
    var lastPointerType = 'mouse';
    var pseudoFullscreen = false;
    var intent = null;      // last play / pause command while its effect is still in flight
    var pressFocus = false; // focus is being moved by a mouse / touch press, not the keyboard
    var prefs = loadPrefs();

    var st = freshState();

    function freshState() {
        return {
            open: false,
            mode: 'static',     // 'custom' (our controls) | 'provider' (embed keeps its own) | 'static' (image / link)
            interactive: false, // custom controls live (always true for files; YouTube after first play)
            skips: false,       // ±10s available in provider mode
            paused: true,
            ended: false,
            waiting: false,
            duration: 0,
            buffered: 0,
            volume: 1,
            muted: false,
            error: false,
            fullscreen: false,
            controls: true,
            scrubbing: false,
            scrubTime: 0,
            hover: false
        };
    }

    function now() {
        return window.performance && performance.now ? performance.now() : Date.now();
    }

    function isNum(value) {
        return typeof value === 'number' && isFinite(value);
    }

    function loadPrefs() {
        var out = { volume: 1, muted: false, touched: false };
        try {
            var raw = window.sessionStorage.getItem('mm-player');
            var saved = raw ? JSON.parse(raw) : null;
            if (saved && isNum(saved.volume)) {
                out.volume = clamp(saved.volume, 0, 1);
                out.muted = !!saved.muted;
                out.touched = true;
            }
        } catch (err) {}
        return out;
    }

    function savePrefs(volume, muted) {
        prefs.volume = clamp(volume, 0, 1);
        prefs.muted = !!muted;
        prefs.touched = true;
        try {
            window.sessionStorage.setItem('mm-player', JSON.stringify({ volume: prefs.volume, muted: prefs.muted }));
        } catch (err) {}
    }

    // iOS keeps volume under hardware control: script changes are ignored there.
    var canSetVolume = (function () {
        try {
            var probe = document.createElement('video');
            probe.volume = 0.5;
            return probe.volume === 0.5;
        } catch (err) {
            return true;
        }
    })();

    function toggleClass(node, name, on) {
        if (!node) return;
        if (on) node.classList.add(name);
        else node.classList.remove(name);
    }

    /* ---------------------------- build ---------------------------- */

    function build() {
        if (el) return;

        var rootEl = document.createElement('div');
        rootEl.className = 'mmp';
        rootEl.id = 'mm-player';
        rootEl.hidden = true;
        rootEl.setAttribute('role', 'dialog');
        rootEl.setAttribute('aria-modal', 'true');
        rootEl.setAttribute('aria-label', 'Video player');
        rootEl.innerHTML = TEMPLATE;
        document.body.appendChild(rootEl);

        function q(selector) { return rootEl.querySelector(selector); }

        el = {
            root: rootEl,
            frame: q('[data-mmp-frame]'),
            stage: q('[data-mmp-stage]'),
            media: q('[data-mmp-media]'),
            shield: q('[data-mmp-shield]'),
            center: q('[data-mmp-center]'),
            bar: q('[data-mmp-bar]'),
            progress: q('[data-mmp-progress]'),
            tip: q('[data-mmp-tip]'),
            volume: q('[data-mmp-volume]'),
            mute: q('[data-mmp-mute]'),
            fs: q('[data-mmp-fullscreen]'),
            timeCurrent: q('[data-mmp-current]'),
            timeDuration: q('[data-mmp-duration]'),
            panel: q('[data-mmp-panel]'),
            panelText: q('[data-mmp-panel-text]'),
            retry: q('[data-mmp-retry]'),
            external: q('[data-mmp-external]'),
            externalLabel: q('[data-mmp-external-label]'),
            status: q('[data-mmp-status]'),
            toggles: rootEl.querySelectorAll('[data-mmp-toggle]')
        };

        toggleClass(rootEl, 'mmp--novolume', !canSetVolume);

        rootEl.addEventListener('click', onRootClick);
        el.shield.addEventListener('dblclick', function () {
            if (lastPointerType === 'mouse') toggleFullscreen();
        });

        // Remember what kind of pointer is in use: a mouse click on the video
        // toggles playback, a touch tap reveals / hides the controls.
        rootEl.addEventListener('pointerdown', function (event) {
            lastPointerType = event.pointerType || 'mouse';
            pressFocus = true;
        }, true);
        rootEl.addEventListener('touchstart', function () {
            if (!window.PointerEvent) lastPointerType = 'touch';
            pressFocus = true;
        }, { capture: true, passive: true });
        rootEl.addEventListener('mousedown', function () {
            pressFocus = true;
        }, true);

        el.stage.addEventListener('pointermove', function (event) {
            if (event.pointerType === 'touch') return;
            showControls();
        });
        // Over an embed the page only learns that the pointer came in, not that it moves.
        el.stage.addEventListener('pointerenter', function (event) {
            if (event.pointerType === 'touch') return;
            showControls();
        });
        el.stage.addEventListener('pointerleave', function (event) {
            if (event.pointerType === 'touch') return;
            st.hover = false;
            scheduleHide(600);
        });
        [el.bar, el.center].forEach(function (node) {
            node.addEventListener('pointerover', function (event) {
                if (event.pointerType === 'touch') return;
                if (event.target === el.center) return;
                st.hover = true;
            });
            node.addEventListener('pointerout', function (event) {
                if (event.pointerType === 'touch') return;
                st.hover = false;
                scheduleHide();
            });
        });
        // Keyboard focus reveals the controls. Focus that merely follows a press
        // is left to the click itself — otherwise a tap on the picture would
        // show the controls (focus) and hide them again (click) in one go.
        rootEl.addEventListener('focusin', function () {
            if (!pressFocus) showControls();
        });

        bindSlider(el.progress, {
            start: function (ratio) {
                if (!canSeek()) return false;
                st.scrubbing = true;
                st.scrubTime = ratio * st.duration;
                if (adapter.scrubStart) adapter.scrubStart();
                toggleClass(el.root, 'is-scrubbing', true);
                showControls();
                renderTime();
                return true;
            },
            move: function (ratio) {
                st.scrubTime = ratio * st.duration;
                if (adapter && adapter.scrubMove) adapter.scrubMove(st.scrubTime);
                renderTime();
            },
            end: function (ratio, cancelled) {
                var target = ratio * st.duration;
                st.scrubbing = false;
                toggleClass(el.root, 'is-scrubbing', false);
                if (adapter) {
                    if (!cancelled) seekTo(target);
                    if (adapter.scrubEnd) adapter.scrubEnd();
                }
                renderTime();
                scheduleHide();
            },
            hover: function (ratio, offset) {
                if (!canSeek()) return;
                el.tip.textContent = formatTime(ratio * st.duration);
                el.progress.style.setProperty('--mmp-tip', offset + 'px');
            }
        });

        bindSlider(el.volume, {
            start: function (ratio) {
                if (!adapter || st.mode !== 'custom') return false;
                setVolume(ratio);
                return true;
            },
            move: function (ratio) { setVolume(ratio); },
            end: function () { scheduleHide(); }
        });
        el.volume.addEventListener('keydown', function (event) {
            var step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 0.05
                : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -0.05 : 0;
            if (event.key === 'Home') { setVolume(0); } else if (event.key === 'End') { setVolume(1); } else if (step) { setVolume(effectiveVolume() + step); } else { return; }
            event.preventDefault();
            event.stopPropagation();
            showControls();
        });

        if (window.ResizeObserver) {
            new ResizeObserver(measure).observe(el.stage);
        }
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);

        document.addEventListener('keydown', onKeydown);
        window.addEventListener('message', function (event) {
            if (adapter && adapter.onMessage) adapter.onMessage(event);
        });
        ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (name) {
            document.addEventListener(name, onFullscreenChange);
        });
        window.addEventListener('pagehide', function () {
            if (st.open) close();
        });
    }

    /**
     * Pointer + touch slider. `handlers.start` may return false to refuse the drag.
     */
    function bindSlider(node, handlers) {
        var track = node.querySelector('[data-mmp-track]') || node;
        var dragging = false;
        var last = 0;

        function ratioAt(clientX) {
            var rect = track.getBoundingClientRect();
            if (!rect.width) return 0;
            return clamp((clientX - rect.left) / rect.width, 0, 1);
        }
        function offsetAt(clientX) {
            var rect = node.getBoundingClientRect();
            return clamp(clientX - rect.left, 0, rect.width);
        }
        function begin(clientX) {
            last = ratioAt(clientX);
            if (handlers.start(last) === false) return false;
            dragging = true;
            toggleClass(node, 'is-dragging', true);
            if (handlers.hover) handlers.hover(last, offsetAt(clientX));
            return true;
        }
        function move(clientX) {
            last = ratioAt(clientX);
            if (handlers.hover) handlers.hover(last, offsetAt(clientX));
            if (dragging && handlers.move) handlers.move(last);
        }
        function finish(cancelled) {
            if (!dragging) return;
            dragging = false;
            toggleClass(node, 'is-dragging', false);
            if (handlers.end) handlers.end(last, !!cancelled);
        }

        if (window.PointerEvent) {
            node.addEventListener('pointerdown', function (event) {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                if (!begin(event.clientX)) return;
                try { node.setPointerCapture(event.pointerId); } catch (err) {}
                event.preventDefault();
                try { node.focus({ preventScroll: true }); } catch (err) { node.focus(); }
            });
            node.addEventListener('pointermove', function (event) { move(event.clientX); });
            node.addEventListener('pointerup', function () { finish(false); });
            node.addEventListener('pointercancel', function () { finish(true); });
            node.addEventListener('lostpointercapture', function () { finish(false); });
        } else {
            node.addEventListener('mousedown', function (event) {
                if (event.button !== 0 || !begin(event.clientX)) return;
                event.preventDefault();
                function onMove(e) { move(e.clientX); }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    finish(false);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            node.addEventListener('mousemove', function (event) { if (!dragging) move(event.clientX); });
            node.addEventListener('touchstart', function (event) {
                if (!event.touches.length || !begin(event.touches[0].clientX)) return;
                event.preventDefault();
            }, { passive: false });
            node.addEventListener('touchmove', function (event) {
                if (!dragging || !event.touches.length) return;
                move(event.touches[0].clientX);
                event.preventDefault();
            }, { passive: false });
            node.addEventListener('touchend', function () { finish(false); });
            node.addEventListener('touchcancel', function () { finish(true); });
        }
    }

    function measure() {
        if (!el || !st.open) return;
        var width = el.stage.clientWidth;
        toggleClass(el.root, 'mmp--compact', width > 0 && width < 480);
        toggleClass(el.root, 'mmp--tiny', width > 0 && width < 300);
        toggleClass(el.root, 'mmp--micro', width > 0 && width < 270);
    }

    /* ---------------------------- render ---------------------------- */

    function isPlaying() {
        return !st.paused && !st.ended;
    }

    function currentTime() {
        if (st.scrubbing) return st.scrubTime;
        return adapter && adapter.time ? adapter.time() : 0;
    }

    function effectiveVolume() {
        return st.muted ? 0 : st.volume;
    }

    function canSeek() {
        return !!adapter && st.mode === 'custom' && st.interactive && st.duration > 0;
    }

    function setLabel(node, label) {
        if (node.getAttribute('aria-label') !== label) {
            node.setAttribute('aria-label', label);
            node.setAttribute('title', label);
        }
    }

    function render() {
        if (!el) return;
        var r = el.root;
        var playing = isPlaying();
        var custom = st.mode === 'custom' && st.interactive && !st.error;

        toggleClass(r, 'mmp--custom', st.mode === 'custom');
        toggleClass(r, 'mmp--provider', st.mode === 'provider');
        toggleClass(r, 'mmp--static', st.mode === 'static');
        toggleClass(r, 'mmp--live', custom);
        toggleClass(r, 'mmp--skips', st.mode === 'provider' && st.skips && !st.error);
        toggleClass(r, 'is-playing', playing);
        toggleClass(r, 'is-paused', !playing);
        toggleClass(r, 'is-ended', st.ended);
        toggleClass(r, 'is-waiting', st.waiting && !st.error);
        toggleClass(r, 'is-muted', st.muted || st.volume === 0);
        toggleClass(r, 'is-quiet', !st.muted && st.volume > 0 && st.volume < 0.5);
        toggleClass(r, 'is-fullscreen', st.fullscreen);
        toggleClass(r, 'is-idle', hasOverlay() && !st.controls);
        toggleClass(r, 'has-error', st.error);

        var toggleLabel = st.ended ? 'Replay' : playing ? 'Pause' : 'Play';
        for (var i = 0; i < el.toggles.length; i++) setLabel(el.toggles[i], toggleLabel);
        setLabel(el.mute, st.muted || st.volume === 0 ? 'Unmute' : 'Mute');
        setLabel(el.fs, st.fullscreen ? 'Exit full screen' : 'Full screen');

        var level = effectiveVolume();
        el.volume.style.setProperty('--mmp-level', String(level));
        el.volume.setAttribute('aria-valuenow', String(Math.round(level * 100)));
        el.volume.setAttribute('aria-valuetext', st.muted ? 'Muted' : Math.round(level * 100) + '%');

        renderTime();
        tick();
    }

    function renderTime() {
        if (!el) return;
        var duration = st.duration > 0 ? st.duration : 0;
        var time = clamp(currentTime(), 0, duration || Number.MAX_VALUE);
        var played = duration ? clamp(time / duration, 0, 1) : 0;
        var buffered = duration ? clamp(st.buffered / duration, 0, 1) : 0;

        el.progress.style.setProperty('--mmp-played', played.toFixed(5));
        el.progress.style.setProperty('--mmp-buffered', buffered.toFixed(4));

        var currentText = formatTime(time);
        var durationText = formatTime(duration);
        if (el.timeCurrent.textContent !== currentText) {
            el.timeCurrent.textContent = currentText;
            el.progress.setAttribute('aria-valuenow', String(Math.floor(time)));
            el.progress.setAttribute('aria-valuetext', currentText + ' of ' + durationText);
        }
        if (el.timeDuration.textContent !== durationText) {
            el.timeDuration.textContent = durationText;
            el.progress.setAttribute('aria-valuemax', String(Math.floor(duration)));
            el.progress.setAttribute('aria-valuetext', currentText + ' of ' + durationText);
        }
    }

    // Smooth progress while the bar is on screen; stops by itself otherwise.
    function tick() {
        if (rafId || !st.open || !st.controls || !isPlaying() || st.mode !== 'custom') return;
        rafId = window.requestAnimationFrame(function () {
            rafId = 0;
            if (!st.open) return;
            renderTime();
            tick();
        });
    }

    function announce(text) {
        if (el) el.status.textContent = text;
    }

    /* --------------------- controls visibility --------------------- */

    // Our own controls (custom mode) and the 10s buttons laid over a provider
    // embed both step aside while the video plays.
    function hasOverlay() {
        if (st.error) return false;
        return (st.mode === 'custom' && st.interactive) || (st.mode === 'provider' && st.skips);
    }

    function canAutoHide() {
        return st.open && hasOverlay() && isPlaying() && !st.scrubbing && !st.hover;
    }

    function showControls() {
        if (!st.open) return;
        if (!st.controls) {
            st.controls = true;
            toggleClass(el.root, 'is-idle', false);
            renderTime();
            tick();
        }
        scheduleHide();
    }

    function hideControls() {
        if (!canAutoHide()) return;
        st.controls = false;
        toggleClass(el.root, 'is-idle', true);
    }

    function scheduleHide(delay) {
        window.clearTimeout(hideTimer);
        if (!canAutoHide()) return;
        hideTimer = window.setTimeout(hideControls, delay || HIDE_DELAY);
    }

    /* --------------------------- commands --------------------------- */

    function play() {
        if (!adapter || !adapter.play) return;
        if (st.ended && adapter.seek) {
            st.ended = false;
            adapter.seek(0);
        }
        adapter.play();
    }

    function pause() {
        if (adapter && adapter.pause) adapter.pause();
    }

    // What a toggle has to flip. A native <video> answers synchronously; an
    // embed confirms by message a moment later, so until then the last command
    // counts. This keeps two quick presses (a double-click, a key repeat) from
    // sending the same command twice.
    function wantsPlaying() {
        if (adapter && adapter.playing) return adapter.playing();
        if (intent && now() < intent.until) return intent.playing;
        return isPlaying();
    }

    function togglePlay() {
        if (!adapter || st.mode !== 'custom') return;
        var playing = wantsPlaying();
        if (playing) pause();
        else play();
        intent = { playing: !playing, until: now() + INTENT_WINDOW };
        showControls();
    }

    function seekTo(time) {
        if (!canSeek()) return;
        var target = clamp(time, 0, st.duration);
        var resume = st.ended && target < st.duration - 0.25;
        if (resume) st.ended = false;
        adapter.seek(target);
        if (resume) adapter.play();
        renderTime();
    }

    function skip(direction) {
        if (!adapter) return;
        if (st.mode === 'provider') {
            if (st.skips && adapter.skip) adapter.skip(direction * SKIP_SECONDS);
            return;
        }
        if (!canSeek()) return;
        seekTo(clamp(currentTime() + direction * SKIP_SECONDS, 0, st.duration));
        showControls();
    }

    function setVolume(level) {
        if (!adapter || st.mode !== 'custom') return;
        level = clamp(level, 0, 1);
        if (level < 0.02) level = 0;    // the very bottom of the slider means silent
        st.volume = level;
        st.muted = level === 0;
        if (adapter.setVolume) adapter.setVolume(level);
        if (adapter.setMuted) adapter.setMuted(st.muted);
        savePrefs(level > 0 ? level : prefs.volume, st.muted);
        render();
    }

    function toggleMute() {
        if (!adapter || st.mode !== 'custom') return;
        var mute = !(st.muted || st.volume === 0);
        if (!mute && st.volume === 0) {
            st.volume = prefs.volume > 0 ? prefs.volume : 1;
            if (adapter.setVolume) adapter.setVolume(st.volume);
        }
        st.muted = mute;
        if (adapter.setMuted) adapter.setMuted(mute);
        savePrefs(st.volume, mute);
        render();
        showControls();
    }

    /* -------------------------- fullscreen -------------------------- */

    function fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function exitFullscreen() {
        if (pseudoFullscreen) {
            pseudoFullscreen = false;
            onFullscreenChange();
            return;
        }
        if (fullscreenElement() && el && fullscreenElement() === el.frame) {
            var exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) {
                try {
                    var result = exit.call(document);
                    if (result && result.catch) result.catch(function () {});
                } catch (err) {}
            }
        }
    }

    function enterPseudoFullscreen() {
        pseudoFullscreen = true;
        onFullscreenChange();
    }

    function toggleFullscreen() {
        if (!st.open || st.mode === 'static') return;
        if (st.fullscreen) {
            exitFullscreen();
            return;
        }
        var frame = el.frame;
        var request = frame.requestFullscreen || frame.webkitRequestFullscreen;
        var enabled = document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false;
        if (request && enabled) {
            try {
                var result = request.call(frame);
                if (result && result.catch) result.catch(enterPseudoFullscreen);
            } catch (err) {
                enterPseudoFullscreen();
            }
            return;
        }
        // iPhone: only the <video> element itself can go fullscreen.
        if (adapter && adapter.nativeFullscreen && adapter.nativeFullscreen()) return;
        enterPseudoFullscreen();
    }

    function onFullscreenChange() {
        if (!el) return;
        var active = pseudoFullscreen || fullscreenElement() === el.frame;
        st.fullscreen = active;
        toggleClass(el.root, 'mmp--fill', pseudoFullscreen);
        lockOrientation(active);
        render();
        measure();
        showControls();
    }

    function lockOrientation(active) {
        var orientation = window.screen && window.screen.orientation;
        if (!orientation) return;
        try {
            if (active && el.frame.classList.contains('mmp-frame--landscape') && orientation.lock) {
                var locking = orientation.lock('landscape');
                if (locking && locking.catch) locking.catch(function () {});
            } else if (!active && orientation.unlock) {
                orientation.unlock();
            }
        } catch (err) {}
    }

    /* ---------------------------- events ---------------------------- */

    function onRootClick(event) {
        var target = event.target;
        if (!target || !target.closest) return;

        // The × button and a click on the dark backdrop both close the player.
        if (target.closest('[data-mmp-close], [data-mmp-dismiss]')) {
            event.preventDefault();
            close();
            return;
        }
        if (target.closest('[data-mmp-toggle]')) { togglePlay(); return; }
        if (target.closest('[data-mmp-back]')) { skip(-1); showControls(); return; }
        if (target.closest('[data-mmp-forward]')) { skip(1); showControls(); return; }
        if (target.closest('[data-mmp-mute]')) { toggleMute(); return; }
        if (target.closest('[data-mmp-fullscreen]')) { toggleFullscreen(); return; }
        if (target.closest('[data-mmp-retry]')) { if (current) load(current); return; }

        if (target.closest('[data-mmp-shield]')) {
            if (lastPointerType === 'mouse') {
                togglePlay();
            } else if (!isPlaying()) {
                togglePlay();
            } else if (st.controls) {
                window.clearTimeout(hideTimer);
                hideControls();
            } else {
                showControls();
            }
        }
    }

    function isTypingTarget(node) {
        if (!node || !node.tagName) return false;
        var tag = node.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
    }

    function focusables() {
        var nodes = el.root.querySelectorAll('button, a[href], [tabindex="0"]');
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.disabled || node.hidden) continue;
            if (node.getClientRects().length === 0) continue;
            if (window.getComputedStyle(node).visibility === 'hidden') continue;
            out.push(node);
        }
        return out;
    }

    function onKeydown(event) {
        if (!st.open || event.defaultPrevented) return;
        var key = event.key;
        pressFocus = false;

        if (key === 'Escape' || key === 'Esc') {
            event.preventDefault();
            if (pseudoFullscreen) exitFullscreen();
            else close();
            return;
        }

        if (key === 'Tab') {
            var list = focusables();
            if (!list.length) {
                event.preventDefault();
                return;
            }
            var first = list[0];
            var last = list[list.length - 1];
            var active = document.activeElement;
            var inside = el.root.contains(active) && active !== el.stage;
            if (event.shiftKey && (!inside || active === first)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (!inside || active === last)) {
                event.preventDefault();
                first.focus();
            }
            showControls();
            return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (isTypingTarget(event.target)) return;
        if (st.error) return;

        var onControl = event.target && event.target.closest && event.target.closest('button, a[href]');
        var lower = key.length === 1 ? key.toLowerCase() : key;
        var handled = true;

        if (st.mode === 'provider') {
            // The embed has its own shortcuts; only the 10s steps are ours.
            if (!st.skips) return;
            if (key === 'ArrowLeft' || lower === 'j') skip(-1);
            else if (key === 'ArrowRight' || lower === 'l') skip(1);
            else return;
            event.preventDefault();
            showControls();
            return;
        }
        if (st.mode !== 'custom' || !st.interactive) return;

        if (lower === ' ' || key === 'Spacebar') {
            // Space on a focused button keeps its normal "press the button" meaning.
            if (onControl) return;
            togglePlay();
        } else if (lower === 'k') {
            togglePlay();
        } else if (key === 'ArrowLeft' || lower === 'j') {
            skip(-1);
        } else if (key === 'ArrowRight' || lower === 'l') {
            skip(1);
        } else if (key === 'ArrowUp') {
            setVolume(effectiveVolume() + 0.05);
        } else if (key === 'ArrowDown') {
            setVolume(effectiveVolume() - 0.05);
        } else if (lower === 'm') {
            toggleMute();
        } else if (lower === 'f') {
            toggleFullscreen();
        } else if (key === 'Home') {
            seekTo(0);
        } else if (key === 'End') {
            seekTo(st.duration);
        } else if (/^[0-9]$/.test(key)) {
            seekTo(st.duration * Number(key) / 10);
        } else {
            handled = false;
        }

        if (handled) {
            event.preventDefault();
            showControls();
        }
    }

    /* ---------------------------- adapters --------------------------- */

    function setRatio(ratio) {
        if (!el || !isNum(ratio) || ratio <= 0) return;
        ratio = clamp(ratio, 0.4, 2.6);
        el.frame.style.setProperty('--mmp-ratio', ratio.toFixed(4));
        toggleClass(el.frame, 'mmp-frame--portrait', ratio < 0.9);
        toggleClass(el.frame, 'mmp-frame--landscape', ratio > 1.1);
        measure();
    }

    function showPanel(message, options) {
        var o = options || {};
        st.error = !o.info;
        st.waiting = false;
        el.panelText.textContent = message || '';
        el.panelText.hidden = !message;
        el.retry.hidden = !o.retry;
        if (o.link) {
            el.external.href = o.link;
            el.external.hidden = false;
            el.externalLabel.textContent = o.linkLabel || 'Open in a new tab';
        } else {
            el.external.hidden = true;
            el.external.removeAttribute('href');
        }
        el.panel.hidden = false;
        toggleClass(el.root, 'has-panel', true);
        if (message && !o.info) announce(message);
        render();
    }

    function hidePanel() {
        if (!el) return;
        st.error = false;
        el.panel.hidden = true;
        toggleClass(el.root, 'has-panel', false);
    }

    function absoluteUrl(url) {
        try {
            return new URL(url, document.baseURI).href;
        } catch (err) {
            return url;
        }
    }

    function makeFrame(src, title) {
        var frame = document.createElement('iframe');
        frame.className = 'mmp-embed';
        frame.title = title || 'Video player';
        frame.setAttribute('allow', FRAME_ALLOW);
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        frame.setAttribute('frameborder', '0');
        frame.src = src;
        return frame;
    }

    function removeFrame(frame) {
        try { frame.src = 'about:blank'; } catch (err) {}
        if (frame.parentNode) frame.parentNode.removeChild(frame);
    }

    /** Uploaded / direct video file: full custom controls on a native <video>. */
    function createFileAdapter(source) {
        var video = document.createElement('video');
        var alive = true;
        var pendingSeek = null;
        var resumeAfterScrub = false;

        video.className = 'mmp-video';
        video.controls = false;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'metadata';
        video.setAttribute('aria-label', source.title || 'Video');
        if (source.poster) video.poster = source.poster;
        if (prefs.touched) {
            if (canSetVolume) video.volume = prefs.volume;
            video.muted = prefs.muted;
        }

        function sync() {
            if (!alive) return;
            st.paused = video.paused;
            st.ended = video.ended;
            st.volume = video.volume;
            st.muted = video.muted;
            if (isNum(video.duration) && video.duration > 0) st.duration = video.duration;
            var buffered = 0;
            try {
                for (var i = 0; i < video.buffered.length; i++) {
                    if (video.buffered.start(i) <= video.currentTime + 0.5) buffered = Math.max(buffered, video.buffered.end(i));
                }
            } catch (err) {}
            st.buffered = buffered;
            render();
        }

        function on(name, handler) {
            video.addEventListener(name, function (event) {
                if (alive) handler(event);
            });
        }

        on('loadedmetadata', function () {
            if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight);
            sync();
        });
        on('durationchange', sync);
        on('progress', sync);
        on('timeupdate', sync);
        on('volumechange', sync);
        on('play', function () { st.waiting = video.readyState < 3; sync(); scheduleHide(); });
        on('playing', function () { st.waiting = false; sync(); scheduleHide(); });
        on('canplay', function () { st.waiting = false; sync(); });
        on('waiting', function () { st.waiting = true; sync(); });
        on('pause', function () { st.waiting = false; sync(); showControls(); });
        on('ended', function () { st.waiting = false; sync(); showControls(); });
        on('seeking', function () { sync(); });
        on('seeked', function () {
            if (pendingSeek != null) {
                var target = pendingSeek;
                pendingSeek = null;
                video.currentTime = target;
            }
            sync();
        });
        on('error', function () {
            if (!video.error && video.networkState !== 3) return;
            showPanel('This video can\u2019t be played right now.', { retry: true, link: absoluteUrl(source.url) });
        });
        on('webkitendfullscreen', sync);

        st.mode = 'custom';
        st.interactive = true;
        st.waiting = true;
        video.src = source.url;

        return {
            node: video,
            start: function () {
                var attempt;
                try { attempt = video.play(); } catch (err) {}
                // Autoplay may be refused: the big Play button stays on screen.
                if (attempt && attempt.catch) attempt.catch(function () { if (alive) { st.waiting = false; sync(); } });
            },
            time: function () { return video.currentTime || 0; },
            playing: function () { return !video.paused && !video.ended; },
            play: function () {
                var attempt;
                try { attempt = video.play(); } catch (err) {}
                if (attempt && attempt.catch) attempt.catch(function () { sync(); });
            },
            pause: function () { try { video.pause(); } catch (err) {} },
            seek: function (time) {
                pendingSeek = null;
                try { video.currentTime = time; } catch (err) {}
            },
            setVolume: function (level) { if (canSetVolume) video.volume = level; },
            setMuted: function (muted) { video.muted = muted; },
            scrubStart: function () {
                resumeAfterScrub = !video.paused && !video.ended;
                if (resumeAfterScrub) video.pause();
            },
            scrubMove: function (time) {
                if (video.seeking) pendingSeek = time;
                else { try { video.currentTime = time; } catch (err) {} }
            },
            scrubEnd: function () {
                if (resumeAfterScrub && video.currentTime < (video.duration || 0) - 0.25) this.play();
                resumeAfterScrub = false;
            },
            nativeFullscreen: function () {
                if (!video.webkitEnterFullscreen) return false;
                try { video.webkitEnterFullscreen(); return true; } catch (err) { return false; }
            },
            destroy: function () {
                alive = false;
                try { video.pause(); } catch (err) {}
                video.removeAttribute('src');
                try { video.load(); } catch (err) {}
                if (video.parentNode) video.parentNode.removeChild(video);
            }
        };
    }

    /**
     * YouTube: our control bar drives the embed through the IFrame Player API
     * (postMessage). Until the video has actually started — or if the API never
     * answers — the embed stays fully interactive, so playback can always be
     * started and the video is never left without controls.
     */
    function createYouTubeAdapter(source) {
        var origin = window.location && /^https?:/.test(window.location.protocol) ? window.location.origin : '';
        var frame = makeFrame(youtubeEmbedUrl(source.id, { api: true, origin: origin, start: source.start }), source.title);
        var alive = true;
        var connected = false;
        var started = false;
        var listenTimer = 0;
        var giveUpTimer = 0;
        var queue = [];
        var info = { time: source.start || 0, stamp: 0, rate: 1, state: -1, loaded: 0 };

        function post(message) {
            if (!alive || !frame.contentWindow) return;
            message.id = YT_WIDGET_ID;
            message.channel = 'widget';
            try { frame.contentWindow.postMessage(JSON.stringify(message), YT_ORIGIN); } catch (err) {}
        }

        function command(func, args) {
            var message = { event: 'command', func: func, args: args || [] };
            if (connected) post(message);
            else queue.push(message);
        }

        function time() {
            var value = info.time;
            if (info.state === 1 && info.stamp) value += Math.min((now() - info.stamp) / 1000, 2) * info.rate;
            return st.duration > 0 ? Math.min(value, st.duration) : value;
        }

        function stopTimers() {
            window.clearInterval(listenTimer);
            window.clearTimeout(giveUpTimer);
        }

        function applyState(state) {
            info.time = time();
            info.stamp = now();
            info.state = state;
            if (state === 1) {
                started = true;
                st.paused = false;
                st.ended = false;
                st.waiting = false;
            } else if (state === 2) {
                st.paused = true;
                st.waiting = false;
            } else if (state === 3) {
                st.waiting = started;
            } else if (state === 0) {
                st.paused = true;
                st.ended = true;
                st.waiting = false;
                if (st.duration > 0) info.time = st.duration;
            } else {
                st.paused = true;
                st.waiting = false;
            }
            // Take over only once the video really plays; before that (autoplay
            // blocked, unavailable video…) YouTube's own screen stays clickable.
            var live = started && (state === 0 || state === 1 || state === 2 || state === 3);
            if (live && !st.interactive) {
                st.interactive = true;
                if (document.activeElement === frame) {
                    try { el.stage.focus({ preventScroll: true }); } catch (err) { el.stage.focus(); }
                }
            } else if (!live && st.interactive) {
                st.interactive = false;
            }
        }

        function applyInfo(data) {
            if (isNum(data.duration) && data.duration > 0) st.duration = data.duration;
            if (isNum(data.currentTime)) {
                info.time = data.currentTime;
                info.stamp = now();
            }
            if (isNum(data.playbackRate) && data.playbackRate > 0) info.rate = data.playbackRate;
            if (isNum(data.videoLoadedFraction)) info.loaded = clamp(data.videoLoadedFraction, 0, 1);
            if (isNum(data.volume)) st.volume = clamp(data.volume / 100, 0, 1);
            if (typeof data.muted === 'boolean') st.muted = data.muted;
            if (isNum(data.playerState)) applyState(data.playerState);
            st.buffered = info.loaded * st.duration;
        }

        function onConnected() {
            connected = true;
            stopTimers();
            post({ event: 'command', func: 'addEventListener', args: ['onStateChange'] });
            post({ event: 'command', func: 'addEventListener', args: ['onError'] });
            // Carry the visitor's own volume choice over from the previous video.
            if (prefs.touched) {
                post({ event: 'command', func: 'setVolume', args: [Math.round(prefs.volume * 100)] });
                post({ event: 'command', func: prefs.muted ? 'mute' : 'unMute', args: [] });
            }
            for (var i = 0; i < queue.length; i++) post(queue[i]);
            queue = [];
        }

        frame.addEventListener('load', function () {
            if (!alive || connected) return;
            st.waiting = false;
            render();
            stopTimers();
            post({ event: 'listening' });
            listenTimer = window.setInterval(function () { post({ event: 'listening' }); }, 250);
            giveUpTimer = window.setTimeout(function () {
                if (!alive || connected) return;
                // No answer from the player API: keep YouTube's own controls.
                stopTimers();
                swapAdapter(createEmbedAdapter(youtubeEmbedUrl(source.id, { start: source.start }), source));
            }, YT_HANDSHAKE_TIMEOUT);
        });

        st.mode = 'custom';
        st.interactive = false;
        st.waiting = true;

        return {
            node: frame,
            time: time,
            play: function () { command('playVideo'); },
            pause: function () { command('pauseVideo'); },
            seek: function (target) {
                info.time = target;
                info.stamp = now();
                command('seekTo', [target, true]);
            },
            setVolume: function (level) { command('setVolume', [Math.round(level * 100)]); },
            setMuted: function (muted) { command(muted ? 'mute' : 'unMute'); },
            onMessage: function (event) {
                if (!alive || event.source !== frame.contentWindow || event.origin !== YT_ORIGIN) return;
                var data = event.data;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (err) { return; }
                }
                if (!data || typeof data !== 'object' || typeof data.event !== 'string') return;
                if (data.id != null && String(data.id) !== String(YT_WIDGET_ID)) return;
                if (!connected) onConnected();

                if (data.event === 'onStateChange' && isNum(data.info)) {
                    applyState(data.info);
                } else if (data.event === 'onError') {
                    // YouTube shows its own explanation inside the embed.
                    started = false;
                    st.interactive = false;
                    st.waiting = false;
                } else if (data.info && typeof data.info === 'object') {
                    applyInfo(data.info);
                }
                render();
                if (isPlaying()) scheduleHide();
                else showControls();
            },
            destroy: function () {
                alive = false;
                stopTimers();
                removeFrame(frame);
            }
        };
    }

    /**
     * Vimeo keeps its own control bar (it cannot be switched off for every
     * account). Once its player API answers we add the 10s back / forward
     * buttons; they hide while the video plays and return on pause or when the
     * pointer enters the frame.
     */
    function createVimeoAdapter(source) {
        var frame = makeFrame(vimeoEmbedUrl(source), source.title);
        var alive = true;
        var ready = false;
        var pingTimer = 0;
        var pings = 0;
        var position = 0;
        var duration = 0;

        function post(method, value) {
            if (!alive || !frame.contentWindow) return;
            var message = { method: method };
            if (value !== undefined) message.value = value;
            try { frame.contentWindow.postMessage(message, VIMEO_ORIGIN); } catch (err) {}
        }

        frame.addEventListener('load', function () {
            if (!alive) return;
            st.waiting = false;
            render();
            window.clearInterval(pingTimer);
            post('ping');
            pingTimer = window.setInterval(function () {
                if (ready || ++pings > 20) window.clearInterval(pingTimer);
                else post('ping');
            }, 500);
        });

        st.mode = 'provider';
        st.interactive = false;
        st.waiting = true;

        return {
            node: frame,
            skip: function (delta) {
                if (!ready) return;
                var target = Math.max(0, position + delta);
                if (duration > 0) target = Math.min(target, Math.max(0, duration - 0.25));
                position = target;
                post('setCurrentTime', target);
            },
            onMessage: function (event) {
                if (!alive || event.source !== frame.contentWindow || event.origin !== VIMEO_ORIGIN) return;
                var data = event.data;
                if (typeof data === 'string') {
                    try { data = JSON.parse(data); } catch (err) { return; }
                }
                if (!data || typeof data !== 'object') return;
                if (!ready && (data.event === 'ready' || data.method === 'ping')) {
                    ready = true;
                    window.clearInterval(pingTimer);
                    post('addEventListener', 'timeupdate');
                    post('addEventListener', 'play');
                    post('addEventListener', 'pause');
                    post('addEventListener', 'ended');
                    post('getDuration');
                    post('getPaused');
                    st.skips = true;
                    render();
                    showControls();
                }
                if (data.event === 'timeupdate' && data.data) {
                    if (isNum(Number(data.data.seconds))) position = Number(data.data.seconds);
                    if (Number(data.data.duration) > 0) duration = Number(data.data.duration);
                } else if (data.method === 'getDuration' && Number(data.value) > 0) {
                    duration = Number(data.value);
                } else if (data.event === 'play' || (data.method === 'getPaused' && data.value === false)) {
                    // Playing: the 10s buttons fade out like the rest of the controls.
                    st.paused = false;
                    render();
                    scheduleHide();
                } else if (data.event === 'pause' || data.event === 'ended' || (data.method === 'getPaused' && data.value === true)) {
                    st.paused = true;
                    render();
                    showControls();
                }
            },
            destroy: function () {
                alive = false;
                window.clearInterval(pingTimer);
                removeFrame(frame);
            }
        };
    }

    /** Any other embed (Facebook, generic iframe, YouTube fallback): provider controls. */
    function createEmbedAdapter(src, source) {
        var frame = makeFrame(src, source.title);
        var alive = true;
        var veil = window.setTimeout(function () {
            if (!alive) return;
            st.waiting = false;
            render();
        }, 4500);

        frame.addEventListener('load', function () {
            if (!alive) return;
            window.clearTimeout(veil);
            st.waiting = false;
            render();
        });

        st.mode = 'provider';
        st.interactive = false;
        st.skips = false;
        st.waiting = true;

        return {
            node: frame,
            destroy: function () {
                alive = false;
                window.clearTimeout(veil);
                removeFrame(frame);
            }
        };
    }

    /** Image-only items open as a still preview: the frame and × only. */
    function createImageAdapter(source) {
        var img = document.createElement('img');
        var alive = true;
        img.className = 'mmp-image';
        img.alt = source.title || 'Preview';
        img.decoding = 'async';
        img.addEventListener('load', function () {
            if (!alive) return;
            if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
            st.waiting = false;
            render();
        });
        img.addEventListener('error', function () {
            if (!alive) return;
            showPanel('This preview image could not be loaded.', { link: absoluteUrl(source.url) });
        });

        st.mode = 'static';
        st.waiting = true;
        img.src = source.url;

        return {
            node: img,
            destroy: function () {
                alive = false;
                if (img.parentNode) img.parentNode.removeChild(img);
            }
        };
    }

    /* --------------------------- lifecycle --------------------------- */

    function destroyAdapter() {
        if (adapter) {
            try { adapter.destroy(); } catch (err) {}
            adapter = null;
        }
        if (el) el.media.textContent = '';
    }

    function swapAdapter(next) {
        destroyAdapter();
        adapter = next;
        if (next.node) el.media.appendChild(next.node);
        if (next.start) next.start();
        render();
    }

    function resetState() {
        var keepOpen = st.open;
        var keepFullscreen = st.fullscreen;
        st = freshState();
        st.open = keepOpen;
        st.fullscreen = keepFullscreen;
        intent = null;
        window.clearTimeout(hideTimer);
        if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
        }
    }

    function load(options) {
        var source = resolveSource(options);

        destroyAdapter();
        resetState();
        hidePanel();
        current = options;

        setRatio(source.vertical ? 9 / 16 : 16 / 9);
        el.root.setAttribute('aria-label', source.title ? 'Video player: ' + source.title : 'Video player');

        if (source.provider === 'file') {
            swapAdapter(createFileAdapter(source));
        } else if (source.provider === 'youtube') {
            swapAdapter(createYouTubeAdapter(source));
        } else if (source.provider === 'vimeo') {
            swapAdapter(createVimeoAdapter(source));
        } else if (source.provider === 'facebook') {
            swapAdapter(createEmbedAdapter(facebookEmbedUrl(source.url), source));
        } else if (source.provider === 'iframe') {
            swapAdapter(createEmbedAdapter(withParams(source.url, { autoplay: 1 }), source));
        } else if (source.provider === 'image') {
            swapAdapter(createImageAdapter(source));
        } else if (source.provider === 'link') {
            st.mode = 'static';
            showPanel('', {
                info: true,
                link: absoluteUrl(source.url),
                linkLabel: 'Open video on ' + (source.label || 'the video host')
            });
        } else {
            st.mode = 'static';
            showPanel('No playable media is attached to this item yet.', {});
        }

        render();
        measure();
        showControls();
    }

    function pauseOtherMedia() {
        resumeList = [];
        var nodes = document.querySelectorAll('video, audio');
        for (var i = 0; i < nodes.length; i++) {
            var media = nodes[i];
            if (el.root.contains(media) || media.paused) continue;
            try {
                media.pause();
                // Silent decorative loops may continue once the player is closed.
                if (media.muted && media.loop) resumeList.push(media);
            } catch (err) {}
        }
    }

    function resumeOtherMedia() {
        for (var i = 0; i < resumeList.length; i++) {
            try {
                var attempt = resumeList[i].play();
                if (attempt && attempt.catch) attempt.catch(function () {});
            } catch (err) {}
        }
        resumeList = [];
    }

    function open(options) {
        options = options || {};
        build();

        if (!st.open) {
            trigger = options.trigger || document.activeElement;
            st.open = true;
            el.root.hidden = false;
            document.documentElement.classList.add('mmp-lock');
            pauseOtherMedia();
        } else if (options.trigger) {
            trigger = options.trigger;
        }

        load(options);

        try { el.stage.focus({ preventScroll: true }); } catch (err) { el.stage.focus(); }
        return true;
    }

    function close() {
        if (!el || !st.open) return;

        exitFullscreen();
        pseudoFullscreen = false;
        destroyAdapter();
        resetState();
        hidePanel();
        current = null;

        st.open = false;
        st.fullscreen = false;
        el.root.hidden = true;
        el.root.className = 'mmp' + (canSetVolume ? '' : ' mmp--novolume');
        document.documentElement.classList.remove('mmp-lock');
        announce('');
        resumeOtherMedia();

        var back = trigger;
        trigger = null;
        if (back && typeof back.focus === 'function' && document.contains(back)) {
            try { back.focus({ preventScroll: true }); } catch (err) { back.focus(); }
        }
    }

    window.MMPlayer = {
        __mmPlayer: true,
        open: open,
        close: close,
        isOpen: function () { return st.open; },
        resolve: resolveSource
    };
})(typeof window !== 'undefined' ? window : null);
