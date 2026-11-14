/**
 * MEXA MOTION — shared video player.
 *
 * One reusable, YouTube-style player for every video on the site
 * (Home "Our Work" gallery, Work page videos + Shorts, Service page videos
 * and the showreel). The player builds a single modal once, keeps a single
 * close control, and owns the only set of listeners, so duplicate × buttons
 * or duplicated handlers can never appear again.
 *
 * YouTube clips run in a plain iframe with every piece of YouTube chrome
 * switched off (controls=0, modestbranding, rel=0, showinfo=0) and are driven
 * over postMessage (enablejsapi=1), so no third-party script — and therefore
 * no ad blocker or WebView — can stop them from working. Our own control bar
 * drives playback; if a frame never answers, the clip is rebuilt with
 * YouTube's own controls so it always stays watchable. Every other provider
 * (Vimeo, Facebook, custom iframes) keeps using a plain iframe.
 *
 * Public API:
 *   MexaVideoPlayer.open({ src, embed, type, poster, title, vertical, kind })
 *   MexaVideoPlayer.openFrom(element)   // reads data-mm-* attributes
 *   MexaVideoPlayer.close()
 *   MexaVideoPlayer.isOpen()
 *
 * Markup is created from scratch (inline SVG icons only). No pseudo-element
 * "×", no Font Awesome fallback icon, no <video controls> — so exactly one
 * close button and one set of controls exist per player.
 *
 * Control layout (the same for uploaded files and YouTube clips):
 *   • the middle of the picture is empty — no play/pause disc, no skip
 *     buttons, nothing permanently parked over the video;
 *   • a double tap / double click on the picture plays or pauses, and a short
 *     badge confirms it before fading away;
 *   • every control lives in the bottom bar: play/pause, -10s, +10s, volume,
 *     progress, current/total time and fullscreen at the far right;
 *   • the timeline turns YouTube red for YouTube clips and Shorts, and keeps
 *     its blue for uploaded videos;
 *   • the bar is laid out from the player's width (CSS container queries), so
 *     a 9:16 Short never pushes the fullscreen control out of its box.
 */
(function () {
    'use strict';

    if (window.MexaVideoPlayer && window.MexaVideoPlayer.isReady) return;

    var MODAL_ID = 'mexa-video-player';
    var CLOSE_ATTR = 'data-mxvp-close';
    var BACKDROP_ATTR = 'data-mxvp-backdrop';
    var SEEK_MAX = 1000;
    var SKIP_SECONDS = 10;
    // YouTube clips are driven by postMessage (enablejsapi=1), which needs no
    // third-party script. These timers are where we stop trusting that bridge
    // and hand the clip over to YouTube's own controls instead of showing a
    // video the viewer cannot start, pause or seek.
    var YT_HANDSHAKE_TIMEOUT = 4000;
    var YT_START_TIMEOUT = 4000;
    // A second tap on the picture within this window is a double tap.
    var TAP_WINDOW = 300;
    // How long the tap confirmation (play/pause/replay badge) stays up.
    var HINT_TIME = 650;

    // YouTube player states.
    var YT_ENDED = 0;
    var YT_PLAYING = 1;
    var YT_PAUSED = 2;
    var YT_BUFFERING = 3;
    var YT_CUED = 5;

    var ICON = {
        close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.3 6.3 17.7 17.7M17.7 6.3 6.3 17.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
        play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.4 5.2a.9.9 0 0 1 1.4-.77l9 6.8a.9.9 0 0 1 0 1.54l-9 6.8a.9.9 0 0 1-1.4-.77z" fill="currentColor"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.2 5.3h3.1v13.4H7.2zM13.7 5.3h3.1v13.4h-3.1z" fill="currentColor"/></svg>',
        replay: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5.4a6.6 6.6 0 1 1-6.2 4.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 2.6 8.6 5.4 12 8.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        back: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 6.4a6.2 6.2 0 1 1-5.85 4.45" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3.7 8.5 6.4 12 9.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text x="12.2" y="16.4" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="7.2" font-weight="700" fill="currentColor">10</text></svg>',
        forward: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 6.4a6.2 6.2 0 1 0 5.85 4.45" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3.7 15.5 6.4 12 9.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text x="11.8" y="16.4" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="7.2" font-weight="700" fill="currentColor">10</text></svg>',
        volume: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.2 9.3h3.1l4.6-3.9v13.2l-4.6-3.9H4.2z" fill="currentColor"/><path d="M15 8.7a4.7 4.7 0 0 1 0 6.6M17.6 6.1a8.3 8.3 0 0 1 0 11.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
        muted: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.2 9.3h3.1l4.6-3.9v13.2l-4.6-3.9H4.2z" fill="currentColor"/><path d="m15.2 9.4 4.6 5.2M19.8 9.4l-4.6 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
        fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.2V4h5.2M20 9.2V4h-5.2M4 14.8V20h5.2M20 14.8V20h-5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        exitFullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.2 4v5.2H4M14.8 4v5.2H20M9.2 20v-5.2H4M14.8 20v-5.2H20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    var TEMPLATE =
        '<div class="mxvp__backdrop" ' + BACKDROP_ATTR + '="1"></div>' +
        '<div class="mxvp__dialog" role="dialog" aria-modal="true" aria-label="Video player">' +
            '<div class="mxvp__stage" data-mxvp-stage>' +
                '<div class="mxvp__media" data-mxvp-media></div>' +
                // The middle of the picture is deliberately empty: no play/pause
                // disc, no skip buttons. A short-lived badge is the only thing
                // that ever appears there, and only to confirm a double tap.
                '<div class="mxvp__sink" data-mxvp-sink aria-hidden="true"></div>' +
                '<div class="mxvp__hint" data-mxvp-hint aria-hidden="true"></div>' +
                '<div class="mxvp__spinner" data-mxvp-spinner aria-hidden="true" hidden></div>' +
                '<p class="mxvp__error" data-mxvp-error role="status" hidden>This video could not be played.</p>' +
                '<button type="button" class="mxvp__close" ' + CLOSE_ATTR + '="1" aria-label="Close video">' + ICON.close + '</button>' +
                '<div class="mxvp__bar" data-mxvp-bar>' +
                    '<div class="mxvp__scrub">' +
                        '<input class="mxvp__seek" data-mxvp-seek type="range" min="0" max="' + SEEK_MAX + '" step="1" value="0" aria-label="Video progress">' +
                    '</div>' +
                    '<div class="mxvp__row">' +
                        '<button type="button" class="mxvp__btn" data-mxvp-play aria-label="Play">' + ICON.play + '</button>' +
                        '<button type="button" class="mxvp__btn" data-mxvp-back aria-label="Rewind 10 seconds">' + ICON.back + '</button>' +
                        '<button type="button" class="mxvp__btn" data-mxvp-forward aria-label="Forward 10 seconds">' + ICON.forward + '</button>' +
                        '<div class="mxvp__vol">' +
                            '<button type="button" class="mxvp__btn" data-mxvp-mute aria-label="Mute">' + ICON.volume + '</button>' +
                            '<input class="mxvp__volume" data-mxvp-volume type="range" min="0" max="1" step="0.02" value="1" aria-label="Volume">' +
                        '</div>' +
                        '<span class="mxvp__time" data-mxvp-time>0:00 / 0:00</span>' +
                        '<button type="button" class="mxvp__btn mxvp__btn--fs" data-mxvp-fullscreen aria-label="Fullscreen">' + ICON.fullscreen + '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';

    var refs = {};
    var modal = null;
    var mediaEl = null;
    var mode = 'video';
    var isOpen = false;
    var lastFocus = null;
    var hideTimer = 0;
    var seeking = false;
    var rememberVolume = 1;
    var prevOverflow = '';
    var built = false;

    // YouTube specifics.
    var ytFrame = null;
    var ytTick = 0;
    var ytStarted = false;
    var ytReady = false;        // the frame answered a postMessage
    var ytNativeUi = false;     // this browser never answered: use YouTube's UI
    var ytRetry = 0;            // one clean re-mount before giving up
    var ytAutoplayBlocked = false;  // remember: this browser wants muted autoplay
    var ytAutoMuted = false;    // we muted on purpose so the clip starts by itself
    var primed = false;         // connection warm-up for YouTube
    var ytPlayerState = -1;
    var ytTime = 0;
    var ytDuration = 0;
    var ytVolume = 100;
    var ytMuted = false;
    var ytWatchdog = 0;
    var ytStartWatchdog = 0;
    var ytRequest = null;
    var requestToken = 0;

    // Double-tap bookkeeping (per pointer type).
    var lastTapAt = 0;
    var lastTouchAt = 0;
    var hintTimer = 0;
    var draggingVolume = false;
    var volumePointerDown = false;

    /* ---------------------------------------------------------------- media */

    function youtubeId(url) {
        var m = String(url || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{6,})/i);
        return m ? m[1] : '';
    }

    function vimeoId(url) {
        var m = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/i);
        return m ? m[1] : '';
    }

    function isFacebook(url) {
        return /facebook\.com|fb\.watch|fb\.me/i.test(String(url || ''));
    }

    function withParam(url, key, value) {
        if (!url) return url;
        var hash = '';
        var hashAt = url.indexOf('#');
        if (hashAt !== -1) {
            hash = url.slice(hashAt);
            url = url.slice(0, hashAt);
        }
        var re = new RegExp('([?&])' + key + '=[^&]*');
        if (re.test(url)) return url.replace(re, '$1' + key + '=' + value) + hash;
        return url + (url.indexOf('?') === -1 ? '?' : '&') + key + '=' + value + hash;
    }

    function embedUrl(url) {
        var yt = youtubeId(url);
        if (yt) {
            return 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
        }
        var vm = vimeoId(url);
        if (vm) {
            return 'https://player.vimeo.com/video/' + vm + '?autoplay=1';
        }
        if (isFacebook(url)) {
            // Already a plugin URL (stored by the admin panel): just autoplay it.
            if (/facebook\.com\/plugins\/video\.php/i.test(url)) return withParam(url, 'autoplay', 'true');
            return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url) + '&show_text=false&autoplay=true';
        }
        return withParam(url, 'autoplay', '1');
    }

    function cssUrl(url) {
        return 'url("' + String(url).replace(/["\\\n\r]/g, function (ch) {
            return encodeURIComponent(ch);
        }) + '")';
    }

    function attr(node, names) {
        for (var i = 0; i < names.length; i++) {
            var value = node.getAttribute(names[i]);
            if (value !== null && String(value).trim() !== '') return String(value).trim();
        }
        return '';
    }

    /** Decide how a request should be played: video file, YouTube, iframe or image. */
    function resolveTarget(raw) {
        var src = String(raw.src || '').trim();
        var embed = String(raw.embed || '').trim();
        var type = String(raw.type || '').toLowerCase();
        var kind = String(raw.kind || '').toLowerCase();

        if (kind === 'image') {
            var imageUrl = src || String(raw.poster || '').trim();
            return imageUrl ? { mode: 'image', src: imageUrl, videoId: '', provider: '' } : null;
        }

        var embedTarget = '';
        if (embed && (type === 'iframe' || youtubeId(embed) || vimeoId(embed) || isFacebook(embed))) {
            embedTarget = embed;
        } else if (youtubeId(src) || vimeoId(src) || isFacebook(src)) {
            embedTarget = src;
        } else if (!src && embed) {
            embedTarget = embed;
        }

        if (embedTarget) {
            var yt = youtubeId(embedTarget);
            if (yt) return { mode: 'youtube', src: embedTarget, videoId: yt, provider: 'youtube' };
            if (vimeoId(embedTarget)) return { mode: 'embed', src: embedUrl(embedTarget), videoId: '', provider: 'vimeo' };
            return {
                mode: 'embed',
                src: embedUrl(embedTarget),
                videoId: '',
                provider: isFacebook(embedTarget) ? 'facebook' : 'iframe'
            };
        }

        if (src) return { mode: 'video', src: src, videoId: '', provider: '' };
        return null;
    }

    /** Turn raw options into a normalized player request. */
    function normalize(raw) {
        if (!raw) return null;
        if (String(raw.type || '').toLowerCase() === 'link') return null;

        var target = resolveTarget(raw);
        if (!target) return null;

        return {
            mode: target.mode,
            src: target.src,
            videoId: target.videoId,
            provider: target.provider,
            poster: String(raw.poster || '').trim(),
            title: String(raw.title || '').trim() || 'Video',
            vertical: !!raw.vertical
        };
    }

    /** Raw (not yet normalized) play request read from a card's data attributes. */
    function rawFromElement(node) {
        if (!node || !node.getAttribute) return null;

        var src = attr(node, ['data-mm-video-url', 'data-mm-src', 'data-sv2-video']);
        if (!src && node.tagName === 'A') src = attr(node, ['href']);
        if (!src && node.tagName === 'VIDEO') src = attr(node, ['src']);

        var embed = attr(node, ['data-mm-video-embed-url', 'data-mm-embed']);
        var poster = attr(node, ['data-mm-video-poster', 'data-mm-poster']);
        if (!src && !embed && !poster) return null;

        var vertical = node.getAttribute('data-mm-vertical') === '1' ||
            !!(node.classList && (node.classList.contains('wk-short') || node.classList.contains('pf-card-short')));

        return {
            src: src,
            embed: embed,
            type: attr(node, ['data-mm-video-type', 'data-mm-type']),
            kind: attr(node, ['data-mm-kind']),
            poster: poster,
            title: attr(node, ['data-mm-video-title', 'data-mm-title']) || node.getAttribute('aria-label') || '',
            vertical: vertical
        };
    }

    function optionsFromElement(node) {
        return normalize(rawFromElement(node));
    }

    /* -------------------------------------------------------------- elements */

    function build() {
        if (built) return;
        built = true;

        modal = document.createElement('div');
        modal.className = 'mxvp';
        modal.id = MODAL_ID;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = TEMPLATE;

        refs.dialog = modal.querySelector('.mxvp__dialog');
        refs.stage = modal.querySelector('[data-mxvp-stage]');
        refs.media = modal.querySelector('[data-mxvp-media]');
        refs.sink = modal.querySelector('[data-mxvp-sink]');
        refs.hint = modal.querySelector('[data-mxvp-hint]');
        refs.spinner = modal.querySelector('[data-mxvp-spinner]');
        refs.error = modal.querySelector('[data-mxvp-error]');
        refs.bar = modal.querySelector('[data-mxvp-bar]');
        refs.seek = modal.querySelector('[data-mxvp-seek]');
        refs.play = modal.querySelector('[data-mxvp-play]');
        refs.back = modal.querySelector('[data-mxvp-back]');
        refs.forward = modal.querySelector('[data-mxvp-forward]');
        refs.mute = modal.querySelector('[data-mxvp-mute]');
        refs.volume = modal.querySelector('[data-mxvp-volume]');
        refs.time = modal.querySelector('[data-mxvp-time]');
        refs.fullscreen = modal.querySelector('[data-mxvp-fullscreen]');

        document.body.appendChild(modal);
        bindEvents();
    }

    function bindEvents() {
        // Close controls: the backdrop and the single close button.
        modal.querySelector('[' + CLOSE_ATTR + ']').addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            close();
        });
        modal.querySelector('[' + BACKDROP_ATTR + ']').addEventListener('click', function () {
            close();
        });

        refs.play.addEventListener('click', togglePlay);
        refs.back.addEventListener('click', function () { skip(-SKIP_SECONDS); });
        refs.forward.addEventListener('click', function () { skip(SKIP_SECONDS); });
        refs.mute.addEventListener('click', toggleMute);
        // While the slider is under a finger/pointer it must not be moved by
        // provider events, so the thumb stays where the user put it.
        refs.volume.addEventListener('pointerdown', function () {
            draggingVolume = true;
            volumePointerDown = true;
        });
        ['pointerup', 'pointercancel', 'change', 'blur'].forEach(function (type) {
            refs.volume.addEventListener(type, function () {
                draggingVolume = false;
                volumePointerDown = false;
            });
        });
        // A pointer released outside the player never fires pointerup on the
        // slider, so the flag is also cleared on any release anywhere.
        ['pointerup', 'pointercancel'].forEach(function (type) {
            document.addEventListener(type, function () {
                draggingVolume = false;
                volumePointerDown = false;
            }, true);
        });
        refs.volume.addEventListener('input', function () {
            draggingVolume = true;
            setVolume(parseFloat(refs.volume.value));
            wake();
        });
        refs.fullscreen.addEventListener('click', toggleFullscreen);

        refs.seek.addEventListener('pointerdown', function () { seeking = true; });
        refs.seek.addEventListener('input', function () {
            seeking = true;
            var ratio = parseInt(refs.seek.value, 10) / SEEK_MAX;
            paintProgress(ratio);
            var duration = getDuration();
            if (duration > 0) refs.time.textContent = formatTime(ratio * duration) + ' / ' + formatTime(duration);
            wake();
        });
        var commitSeek = function () {
            var duration = getDuration();
            if (duration > 0) seekToTime((parseInt(refs.seek.value, 10) / SEEK_MAX) * duration);
            seeking = false;
            wake();
        };
        refs.seek.addEventListener('change', commitSeek);
        refs.seek.addEventListener('pointerup', commitSeek);
        refs.seek.addEventListener('pointercancel', function () { seeking = false; });

        // The picture is a plain surface: a single tap/click shows the bottom
        // bar and a double tap/click plays or pauses. Nothing is ever parked in
        // the middle of the video.
        // The sink sits above the media so this also works over a YouTube frame,
        // which would otherwise swallow the click.
        [refs.media, refs.sink].forEach(function (layer) {
            if (!layer) return;
            layer.addEventListener('click', function (event) {
                handleStageTap(event, 'pointer');
            });
        });

        // Touch is handled from the same surface: `touchstart` never fires a
        // double click on a phone, so the tap count is ours to keep.
        refs.stage.addEventListener('touchstart', function (event) {
            handleStageTap(event, 'touch');
        }, { passive: true });

        ['pointermove', 'pointerdown', 'touchstart', 'focusin'].forEach(function (type) {
            refs.stage.addEventListener(type, wake, { passive: true });
        });

        modal.addEventListener('mousemove', wake, { passive: true });

        // YouTube posts its player events to this window.
        window.addEventListener('message', onYtMessage);

        document.addEventListener('keydown', onKeydown);
        document.addEventListener('fullscreenchange', syncFullscreenButton);
        document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
    }

    /* ---------------------------------------------------- playback primitives */

    function currentVideo() {
        return mediaEl && mediaEl.tagName === 'VIDEO' ? mediaEl : null;
    }

    function youtubeReady() {
        return mode === 'youtube' && !!ytFrame && ytReady;
    }

    function hasTransport() {
        return mode === 'video' ? !!currentVideo() : youtubeReady();
    }

    function ytState() {
        return mode === 'youtube' ? ytPlayerState : -1;
    }

    function isPlaying() {
        if (mode === 'youtube') return ytPlayerState === YT_PLAYING;
        var video = currentVideo();
        return !!video && !video.paused && !video.ended;
    }

    function getTime() {
        if (mode === 'youtube') return ytTime;
        var video = currentVideo();
        return video ? video.currentTime || 0 : 0;
    }

    function getDuration() {
        if (mode === 'youtube') return ytDuration;
        var video = currentVideo();
        return video && isFinite(video.duration) ? video.duration : 0;
    }

    function seekToTime(seconds) {
        if (mode === 'youtube') {
            ytTime = seconds;
            ytSend('seekTo', [seconds, true]);
            return;
        }
        var video = currentVideo();
        if (video) video.currentTime = seconds;
    }

    function playMedia() {
        if (mode === 'youtube') {
            ytSend('playVideo');
            if (ytAutoMuted) {
                // The tap that started playback also allows sound again.
                ytAutoMuted = false;
                ytMuted = false;
                ytSend('setVolume', [ytVolume || 100]);
                ytSend('unMute');
                syncVolume();
            }
            watchYtStart();
            return;
        }
        var video = currentVideo();
        if (!video) return;
        if (video.ended) video.currentTime = 0;
        var attempt = video.play();
        if (attempt && typeof attempt.catch === 'function') attempt.catch(function () {});
    }

    function pauseMedia() {
        if (mode === 'youtube') {
            ytSend('pauseVideo');
            return;
        }
        var video = currentVideo();
        if (video) video.pause();
    }

    /**
     * Both providers expose level and mute separately, so the bar follows them
     * separately too: muting must never look like a volume of zero, otherwise
     * moving the slider afterwards is not obvious.
     */
    function getVolume() {
        if (mode === 'youtube') return ytVolume / 100;
        var video = currentVideo();
        return video ? video.volume : 1;
    }

    function isMuted() {
        if (mode === 'youtube') return ytMuted || ytVolume === 0;
        var video = currentVideo();
        return !video || video.muted || video.volume === 0;
    }

    function applyVolume(value) {
        var volume = Math.max(0, Math.min(1, isFinite(value) ? value : 1));
        if (mode === 'youtube') {
            ytVolume = Math.round(volume * 100);
            ytMuted = volume === 0;
            ytSend('setVolume', [ytVolume]);
            ytSend(volume === 0 ? 'mute' : 'unMute');
        } else {
            var video = currentVideo();
            if (video) {
                video.volume = volume;
                video.muted = volume === 0;
            }
        }
        if (volume > 0) rememberVolume = volume;
        syncVolume();
    }

    function applyMuteToggle() {
        if (mode === 'youtube') {
            var muted = isMuted();
            ytAutoMuted = false;
            ytMuted = !muted;
            if (muted) {
                if (ytVolume === 0) {
                    ytVolume = Math.round((rememberVolume || 1) * 100);
                    ytSend('setVolume', [ytVolume]);
                }
                ytSend('unMute');
            } else {
                ytSend('mute');
            }
        } else {
            var video = currentVideo();
            if (video) {
                if (video.muted || video.volume === 0) {
                    video.muted = false;
                    if (video.volume === 0) video.volume = rememberVolume || 1;
                } else {
                    video.muted = true;
                }
            }
        }
        syncVolume();
        wake();
    }

    /* --------------------------------------------------------------- helpers */

    function formatTime(seconds) {
        var total = Math.max(0, Math.floor(isFinite(seconds) ? seconds : 0));
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        var mm = h > 0 ? (m < 10 ? '0' + m : String(m)) : String(m);
        var ss = s < 10 ? '0' + s : String(s);
        return (h > 0 ? h + ':' : '') + mm + ':' + ss;
    }

    function paintProgress(ratio) {
        var pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
        refs.seek.style.setProperty('--mxvp-played', pct.toFixed(2) + '%');
    }

    function setControlsVisible(visible) {
        modal.classList.toggle('is-idle', !visible);
    }

    function wake() {
        if (!isOpen) return;
        setControlsVisible(true);
        window.clearTimeout(hideTimer);
        if (!isPlaying()) return;
        hideTimer = window.setTimeout(function () {
            if (!isOpen || seeking) return;
            // Keep the bar up while a control is focused (keyboard use).
            if (document.activeElement && document.activeElement.closest &&
                document.activeElement.closest('.mxvp__bar')) return;
            setControlsVisible(false);
        }, 2800);
    }

    function isEnded() {
        return modal.classList.contains('is-ended');
    }

    function showEndPlate(show) {
        modal.classList.toggle('is-ended', !!show);
        if (!show) return;
        window.clearTimeout(hideTimer);
        setControlsVisible(true);
    }

    /* ------------------------------------------------------ double tap / click */

    /**
     * The picture itself is the only tap target. A double tap plays or pauses;
     * a single tap just brings the bottom bar back. No control ever sits in the
     * middle of the video, so the badge below appears only for a moment as
     * confirmation of the action and then leaves again.
     */
    function isTapSurface(target) {
        if (!target || !target.closest) return false;
        // Buttons, the seek/volume sliders and links keep their own behaviour.
        if (target.closest('button, a, input, select, textarea, [role="button"]')) return false;
        return !!target.closest('.mxvp__stage');
    }

    function showHint(icon, label) {
        if (!refs.hint) return;
        window.clearTimeout(hintTimer);
        refs.hint.innerHTML = icon + '<span>' + label + '</span>';
        refs.hint.classList.add('is-visible');
        hintTimer = window.setTimeout(function () {
            if (refs.hint) refs.hint.classList.remove('is-visible');
        }, HINT_TIME);
    }

    function clearHint() {
        window.clearTimeout(hintTimer);
        if (refs.hint) refs.hint.classList.remove('is-visible');
    }

    /** Play/pause with a short confirmation badge in the middle of the picture. */
    function doubleTapPlayback() {
        if (!hasTransport()) return;
        // The new state is the opposite of the old one, and it is known before
        // either provider has reported back, so the badge is always accurate.
        var nowPlaying = !isPlaying();
        clearHint();
        togglePlay();
        // The badge states what is true now: same icon as the bar's play/pause
        // button, so the two can never tell different stories.
        showHint(nowPlaying ? ICON.pause : ICON.play, nowPlaying ? 'Playing' : 'Paused');
        wake();
    }

    /**
     * @param {Event}  event
     * @param {string} source 'touch' for a real touch, 'pointer' for a mouse.
     */
    function handleStageTap(event, source) {
        if (mode === 'image') return;
        if (!isTapSurface(event.target)) return;

        var now = Date.now();
        // A touch generates a click a moment later; the touch itself was the
        // tap, so the synthetic click must not count as a second one.
        if (source === 'pointer') {
            if (now - lastTouchAt < 900) return;
        } else {
            lastTouchAt = now;
        }

        if (lastTapAt && (now - lastTapAt) <= TAP_WINDOW) {
            // Reset, so a third rapid tap starts a new pair instead of pausing
            // and then immediately resuming again.
            lastTapAt = 0;
            doubleTapPlayback();
            return;
        }

        lastTapAt = now;
        // A single tap never changes playback: it only reveals the controls.
        wake();
    }

    function resetTapState() {
        lastTapAt = 0;
        lastTouchAt = 0;
        clearHint();
    }

    function syncPlayButton() {
        var playing = isPlaying();
        // Once a clip has finished, the bar's play button turns into a replay
        // button: the middle of the picture stays empty as always.
        var ended = isEnded() && !playing;
        refs.play.innerHTML = ended ? ICON.replay : (playing ? ICON.pause : ICON.play);
        refs.play.setAttribute('aria-label', ended ? 'Replay' : (playing ? 'Pause' : 'Play'));
        if (!playing && isOpen) {
            window.clearTimeout(hideTimer);
            setControlsVisible(true);
        }
    }

    function syncVolume() {
        var muted = isMuted();
        var volume = Math.max(0, Math.min(1, getVolume()));
        refs.mute.innerHTML = muted ? ICON.muted : ICON.volume;
        refs.mute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
        // The slider shows the real level; only the icon says "muted".
        // While a pointer is really held down it stays under the finger.
        if (!draggingVolume || !volumePointerDown) refs.volume.value = String(volume);
        refs.volume.style.setProperty('--mxvp-volume', volume * 100 + '%');
    }

    function syncFullscreenButton() {
        var active = isFullscreen();
        if (refs.fullscreen) {
            refs.fullscreen.innerHTML = active ? ICON.exitFullscreen : ICON.fullscreen;
            refs.fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Fullscreen');
        }
        if (modal) modal.classList.toggle('is-fullscreen', active);
    }

    function syncProgress() {
        if (!hasTransport()) return;

        var duration = getDuration();
        var time = getTime();
        var ratio = duration ? time / duration : 0;

        if (!seeking) {
            refs.seek.value = String(Math.round(Math.max(0, Math.min(1, ratio)) * SEEK_MAX));
            paintProgress(ratio);
            refs.time.textContent = formatTime(time) + ' / ' + formatTime(duration);
        }
    }

    function showSpinner(show) {
        if (refs.spinner) refs.spinner.hidden = !show;
    }

    function showError(show) {
        if (refs.error) refs.error.hidden = !show;
        if (show) showSpinner(false);
    }

    function lockScroll(lock) {
        if (lock) {
            prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            document.body.classList.add('mxvp-open');
        } else {
            document.body.style.overflow = prevOverflow || '';
            document.body.classList.remove('mxvp-open');
        }
    }

    /* -------------------------------------------------------------- YouTube */

    /*
     * YouTube clips play in a plain iframe — no `iframe_api` script, so no ad
     * blocker, WebView or network policy can stop them from being controllable.
     *
     * `controls=0` removes every piece of YouTube chrome (logo, channel name,
     * title, share/watch-later/settings buttons, related rail); `allowfullscreen`
     * is set for our own fullscreen. The frame is driven with postMessage
     * (`enablejsapi=1`): we send `{"event":"command","func":…}` and YouTube
     * pushes `onReady` / `onStateChange` / `infoDelivery` back, which is how the
     * bar knows the position, duration and whether the clip ended.
     *
     * If a browser never answers the bridge, `degradeYoutube()` rebuilds the
     * same clip with YouTube's own controls, so it is always watchable.
     */

    function youtubeOrigin() {
        var origin = '';
        try {
            origin = String(window.location.origin || '');
        } catch (err) {
            origin = '';
        }
        return /^https?:\/\//i.test(origin) ? origin : '';
    }

    function youtubeFrameUrl(videoId, nativeUi, muted) {
        var params = [
            'autoplay=1',
            'cc_load_policy=0',
            'controls=' + (nativeUi ? '1' : '0'),
            'disablekb=1',
            'enablejsapi=1',
            'fs=' + (nativeUi ? '1' : '0'),
            'iv_load_policy=3',
            'modestbranding=1',
            'playsinline=1',
            'rel=0',
            'showinfo=0'
        ];
        // `nativeUi` (the frame never answered the postMessage bridge) is the
        // only case where YouTube's own bar and branding come back, because a
        // video nobody can control is worse than a branded one.
        if (muted) params.push('mute=1');
        var origin = youtubeOrigin();
        if (origin) params.push('origin=' + encodeURIComponent(origin));
        // The no-cookie host is the same player and answers the same messages;
        // it is also the host that keeps working when a blocker targets
        // www.youtube.com.
        return 'https://www.youtube-nocookie.com/embed/' + videoId + '?' + params.join('&');
    }

    /**
     * Warm up the YouTube hosts before the first click so the player boots
     * immediately instead of paying DNS + TLS at the moment of the request.
     */
    function primeYoutube() {
        if (primed || !document.head) return;
        primed = true;
        ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://i.ytimg.com'].forEach(function (href) {
            var preconnect = document.createElement('link');
            preconnect.rel = 'preconnect';
            preconnect.href = href;
            document.head.appendChild(preconnect);
            var dns = document.createElement('link');
            dns.rel = 'dns-prefetch';
            dns.href = href;
            document.head.appendChild(dns);
        });
    }

    function ytPost(payload) {
        if (!ytFrame || !ytFrame.contentWindow) return;
        try {
            ytFrame.contentWindow.postMessage(JSON.stringify(payload), '*');
        } catch (err) {}
    }

    /** Ask the frame for player events (required before it posts any). */
    function ytListen() {
        ytPost({ event: 'listening', id: 'mxvp-yt', channel: 'widget' });
    }

    function ytSend(func, args) {
        ytPost({ event: 'command', func: func, args: args || [] });
    }

    function ytOriginAllowed(origin) {
        return !origin || /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)$/i.test(origin);
    }

    /** Merge the position/duration/volume payload YouTube streams back at us. */
    function mergeYtInfo(info) {
        if (!info || typeof info !== 'object') return;

        if (typeof info.currentTime === 'number' && isFinite(info.currentTime)) ytTime = info.currentTime;
        if (typeof info.duration === 'number' && info.duration > 0) ytDuration = info.duration;
        // YouTube reports level and mute independently; adopt both so the
        // slider and the speaker icon never disagree with what is audible.
        if (typeof info.volume === 'number' && isFinite(info.volume)) ytVolume = Math.max(0, Math.min(100, info.volume));
        if (typeof info.muted === 'boolean') {
            if (info.muted && ytVolume > 0) rememberVolume = ytVolume / 100;
            ytMuted = info.muted;
        }

        if (typeof info.playerState === 'number') {
            applyYtState(info.playerState);
        } else {
            syncVolume();
            syncProgress();
        }
    }

    /**
     * Reveal the YouTube picture once the clip has actually started, and keep it
     * visible afterwards.
     *
     * `controls=0` removes YouTube's control bar, but YouTube still paints its
     * own round grey play badge over a clip that has never run. Nothing inside
     * a cross-origin frame can be styled, so before the first playback the frame
     * is kept invisible behind the poster — that is what removes the badge from
     * the middle of the picture. After that the frame stays visible (pausing a
     * clip to a black screen would be worse than the badge), exactly like the
     * real YouTube player.
     */
    function revealYtFrame() {
        if (!isOpen || mode !== 'youtube') return;
        if (ytNativeUi) {
            // The native-controls fallback has to show the frame: its UI is the
            // only way to control the clip then.
            modal.classList.add('is-yt-live');
            return;
        }
        // Sticky: a state change only ever turns the picture on, never off.
        if (ytPlayerState === YT_PLAYING || ytPlayerState === YT_BUFFERING) {
            modal.classList.add('is-yt-live');
        }
    }

    function applyYtState(state) {
        ytPlayerState = state;

        if (state === YT_PLAYING) {
            ytStarted = true;
            showError(false);
            showSpinner(false);
            startYtTick();
            if (isEnded()) showEndPlate(false);
        } else if (state === YT_BUFFERING) {
            showSpinner(true);
            startYtTick();
        } else if (state === YT_PAUSED) {
            showSpinner(false);
            stopYtTick();
            if (isEnded()) showEndPlate(false);
        } else if (state === YT_ENDED) {
            showSpinner(false);
            stopYtTick();
            // The end screen ("More videos") must never be shown.
            modal.classList.remove('is-yt-live');
            if (ytStarted) showEndPlate(true);
        }

        revealYtFrame();
        syncVolume();
        syncPlayButton();
        syncProgress();
    }

    function onYtMessage(event) {
        if (!isOpen || mode !== 'youtube' || !ytFrame) return;

        var frameWindow = null;
        try {
            frameWindow = ytFrame.contentWindow;
        } catch (err) {
            frameWindow = null;
        }
        if (!frameWindow || event.source !== frameWindow) return;
        if (!ytOriginAllowed(event.origin)) return;

        var data = event.data;
        if (typeof data === 'string') {
            if (data.charAt(0) !== '{') return;
            try {
                data = JSON.parse(data);
            } catch (err) {
                return;
            }
        }
        if (!data || typeof data !== 'object' || !data.event) return;

        if (!ytReady) {
            // The first well-formed message proves the bridge works: keep the
            // clean controls instead of degrading.
            ytReady = true;
            window.clearTimeout(ytWatchdog);
            ytWatchdog = 0;
            // The bridge answered — but that alone must not reveal the frame:
            // YouTube draws its own grey play badge on an unstarted clip, which
            // is the overlay that showed up in the middle of the picture.
            // revealYtFrame() waits for real playback instead.
            revealYtFrame();
            showSpinner(false);
            syncPlayButton();
            syncProgress();
            // A browser that blocks audible autoplay needs a visible way in.
            window.setTimeout(function () {
                if (!isOpen || mode !== 'youtube') return;
                if (ytPlayerState === YT_PLAYING || ytPlayerState === YT_BUFFERING || isEnded()) return;
                ytAutoplayBlocked = true;
                // The bar carries the play button, so bring it back instead of
                // parking a play control in the middle of the picture.
                setControlsVisible(true);
            }, 1500);
        }

        var info = data.info;

        if (data.event === 'onError') {
            var code = typeof info === 'number' ? info : 0;
            // 2/5/153 are transient or configuration hiccups: one clean retry
            // fixes them far more often than YouTube's own UI does.
            if ((code === 2 || code === 5 || code === 153) && ytRetry < 1) {
                retryYoutube('player error ' + code);
                return;
            }
            degradeYoutube('player error ' + code);
            return;
        }

        if (data.event === 'onReady') {
            ytListen();
            showSpinner(false);
            syncVolume();
            syncPlayButton();
            syncProgress();
            startYtTick();
            return;
        }

        if (data.event === 'onStateChange') {
            var state = typeof info === 'number'
                ? info
                : (info && typeof info.playerState === 'number' ? info.playerState : null);
            if (state !== null) applyYtState(state);
            return;
        }

        if (data.event === 'infoDelivery' || data.event === 'initialDelivery' || data.event === 'apiInfoDelivery') {
            mergeYtInfo(info);
        }
    }

    /** One clean re-mount of the same clip before falling back. */
    function retryYoutube(reason) {
        ytRetry += 1;
        if (ytRetry > 1) {
            degradeYoutube(reason);
            return;
        }
        var request = ytRequest;
        if (!request) {
            degradeYoutube(reason);
            return;
        }
        if (window.console && console.warn) {
            console.warn('[mexa video] retrying the YouTube frame (' + reason + ').');
        }
        window.setTimeout(function () {
            if (!isOpen || mode !== 'youtube' || ytRequest !== request) return;
            clearMedia();
            mountYoutube(request);
        }, 0);
    }

    function stopYtTick() {
        window.clearInterval(ytTick);
        ytTick = 0;
    }

    function startYtTick() {
        if (ytTick) return;
        ytTick = window.setInterval(function () {
            if (!isOpen || mode !== 'youtube') {
                stopYtTick();
                return;
            }
            syncProgress();
        }, 250);
    }

    function resetYoutube() {
        stopYtTick();
        window.clearTimeout(ytWatchdog);
        window.clearTimeout(ytStartWatchdog);
        ytWatchdog = 0;
        ytStartWatchdog = 0;
        ytReady = false;
        ytStarted = false;
        ytPlayerState = -1;
        ytTime = 0;
        ytDuration = 0;
        ytFrame = null;
        ytRequest = null;
    }

    /** After an explicit play command, make sure the frame actually started. */
    function watchYtStart() {
        if (!ytReady) return;
        window.clearTimeout(ytStartWatchdog);
        ytStartWatchdog = window.setTimeout(function () {
            if (!isOpen || mode !== 'youtube' || ytStarted) return;
            if (ytPlayerState === YT_PLAYING || ytPlayerState === YT_BUFFERING ||
                ytPlayerState === YT_PAUSED || ytPlayerState === YT_ENDED) return;
            degradeYoutube('playback did not start');
        }, YT_START_TIMEOUT);
    }

    /**
     * Clean YouTube playback: an iframe with every piece of YouTube chrome
     * switched off, controlled through postMessage.
     */
    function mountYoutube(request) {
        var token = ++requestToken;
        ytRequest = request;
        ytReady = false;
        ytStarted = false;
        ytPlayerState = -1;
        ytTime = 0;
        ytDuration = 0;
        ytVolume = Math.round(Math.max(0, Math.min(1, rememberVolume)) * 100);
        // Some browsers only autoplay muted. Once that happened, start the next
        // clip muted as well so it plays instantly; a real tap restores sound.
        ytAutoMuted = ytAutoplayBlocked;
        ytMuted = ytAutoMuted;
        window.clearTimeout(ytWatchdog);
        window.clearTimeout(ytStartWatchdog);

        modal.classList.remove('is-yt-live');
        showSpinner(true);
        syncVolume();

        var nativeUi = ytNativeUi;
        var frame = document.createElement('iframe');
        frame.className = 'mxvp__frame';
        frame.id = 'mxvp-yt';
        frame.title = request.title;
        frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('frameborder', '0');
        frame.addEventListener('load', function () {
            if (token !== requestToken || !isOpen) return;
            ytListen();
            if (nativeUi) {
                showSpinner(false);
                return;
            }
            ytSend('setVolume', [ytVolume]);
            if (ytAutoMuted) ytSend('mute');
            ytSend('playVideo');
            // The player sometimes subscribes a moment after `load`, so repeat
            // the handshake instead of waiting for the watchdog to fire.
            window.setTimeout(function () {
                if (token !== requestToken || !isOpen) return;
                ytListen();
                ytSend('playVideo');
            }, 400);
        });

        frame.src = youtubeFrameUrl(request.videoId, nativeUi, ytAutoMuted);
        mediaEl = frame;
        ytFrame = frame;
        refs.media.appendChild(frame);

        if (nativeUi) {
            modal.classList.add('is-embed');
            showSpinner(false);
            return;
        }

        // No answer means our commands never reach the frame: hand the clip to
        // YouTube's own controls rather than showing a video nobody can start.
        ytWatchdog = window.setTimeout(function () {
            if (token !== requestToken || !isOpen || mode !== 'youtube') return;
            if (ytReady) return;
            degradeYoutube('no answer from the frame');
        }, YT_HANDSHAKE_TIMEOUT);
    }

    /**
     * Rebuild the current clip with YouTube's own controls. Used when the frame
     * cannot be scripted (blocked messaging, exotic WebView, player error).
     * The choice is remembered for the rest of the page so later clips open
     * straight into the working mode.
     */
    function degradeYoutube(reason) {
        if (!isOpen || mode !== 'youtube' || !ytRequest || ytNativeUi) return;

        window.clearTimeout(ytWatchdog);
        window.clearTimeout(ytStartWatchdog);
        ytNativeUi = true;

        if (window.console && console.warn) {
            console.warn('[mexa video] YouTube frame could not be controlled (' + reason + '); using the standard embed.');
        }

        var request = ytRequest;
        window.setTimeout(function () {
            if (!isOpen || mode !== 'youtube' || ytRequest !== request) return;
            clearMedia();
            mountYoutube(request);
        }, 0);
    }

    /* -------------------------------------------------------------- mounting */

    function mountVideo(request) {
        var video = document.createElement('video');
        video.className = 'mxvp__video';
        video.preload = 'auto';
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('aria-label', request.title);
        if (request.poster) video.poster = request.poster;

        video.addEventListener('loadedmetadata', function () {
            showSpinner(false);
            syncProgress();
            syncPlayButton();
        });
        video.addEventListener('durationchange', syncProgress);
        video.addEventListener('timeupdate', syncProgress);
        video.addEventListener('progress', syncProgress);
        video.addEventListener('playing', function () {
            showSpinner(false);
            showError(false);
            syncPlayButton();
            wake();
        });
        video.addEventListener('play', syncPlayButton);
        video.addEventListener('pause', syncPlayButton);
        video.addEventListener('ended', function () {
            if (video !== currentVideo()) return;
            // Keep the last frame, bring the bar back and turn its play button
            // into a replay button — no end plate in the middle of the picture.
            showEndPlate(true);
            syncPlayButton();
            wake();
        });
        video.addEventListener('waiting', function () { showSpinner(true); });
        video.addEventListener('canplay', function () { showSpinner(false); });
        video.addEventListener('volumechange', syncVolume);
        video.addEventListener('loadeddata', function () { showSpinner(false); });
        video.addEventListener('error', function () {
            showError(true);
            showSpinner(false);
            syncPlayButton();
        });

        mediaEl = video;
        refs.media.appendChild(video);

        video.src = request.src;

        try {
            video.volume = Math.max(0, Math.min(1, rememberVolume));
        } catch (err) {}
        syncVolume();
        syncPlayButton();

        var attempt = video.play();
        if (attempt && typeof attempt.catch === 'function') {
            attempt.catch(function () {
                // Autoplay was blocked — keep the picture and show the big play button.
                showSpinner(false);
                syncPlayButton();
            });
        }
    }

    function mountEmbed(request) {
        var frame = document.createElement('iframe');
        frame.className = 'mxvp__frame';
        frame.title = request.title;
        frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('frameborder', '0');
        frame.addEventListener('load', function () { showSpinner(false); });
        mediaEl = frame;
        refs.media.appendChild(frame);
        frame.src = request.src;
        syncPlayButton();
        window.setTimeout(function () { if (mediaEl === frame) showSpinner(false); }, 4000);
    }

    function mountImage(request) {
        var img = document.createElement('img');
        img.className = 'mxvp__image';
        img.alt = request.title;
        img.decoding = 'async';
        img.addEventListener('load', function () { showSpinner(false); });
        img.addEventListener('error', function () { showError(true); });
        mediaEl = img;
        refs.media.appendChild(img);
        img.src = request.src;
        syncPlayButton();
    }

    function clearMedia() {
        // Invalidate any in-flight YouTube API work.
        requestToken++;
        stopYtTick();
        resetYoutube();

        if (!refs.media) {
            mediaEl = null;
            return;
        }

        Array.prototype.forEach.call(refs.media.querySelectorAll('video'), function (video) {
            try { video.pause(); } catch (err) {}
            try { video.muted = true; } catch (err) {}
            video.removeAttribute('src');
            try { video.load(); } catch (err) {}
            video.innerHTML = '';
        });
        Array.prototype.forEach.call(refs.media.querySelectorAll('iframe'), function (frame) {
            frame.removeAttribute('src');
            frame.remove();
        });
        refs.media.innerHTML = '';
        mediaEl = null;
    }

    function pauseEverythingElse(keep) {
        Array.prototype.forEach.call(document.querySelectorAll('video'), function (video) {
            if (video === keep) return;
            try { video.pause(); } catch (err) {}
        });
    }

    /* ----------------------------------------------------------- public API */

    function open(raw, opener) {
        var request = normalize(raw);
        if (!request) return false;

        build();
        // Never leave a previous clip playing (or audible) behind.
        pauseEverythingElse(null);
        clearMedia();

        lastFocus = opener || document.activeElement;
        mode = request.mode;

        modal.classList.toggle('is-vertical', !!request.vertical);
        modal.classList.toggle('is-embed', mode === 'embed');
        modal.classList.toggle('is-youtube', mode === 'youtube');
        modal.classList.toggle('is-image', mode === 'image');
        modal.classList.remove('is-fullscreen', 'is-pseudo-fullscreen', 'is-idle', 'is-ended', 'is-yt-live');
        if (mode === 'youtube') ytRetry = 0;
        refs.dialog.setAttribute('aria-label', request.title + ' — video player');
        refs.stage.style.backgroundImage = request.poster ? cssUrl(request.poster) : '';

        refs.seek.value = '0';
        paintProgress(0);
        refs.time.textContent = '0:00 / 0:00';
        resetTapState();
        showError(false);
        showSpinner(mode !== 'image');

        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        isOpen = true;
        lockScroll(true);
        setControlsVisible(true);

        try {
            if (mode === 'video') {
                mountVideo(request);
            } else if (mode === 'youtube') {
                mountYoutube(request);
            } else if (mode === 'embed') {
                mountEmbed(request);
            } else {
                mountImage(request);
            }
        } catch (err) {
            // Never leave the viewer with an empty player and no explanation.
            if (mode === 'youtube' && request.videoId) {
                ytNativeUi = true;
                try {
                    mountYoutube(request);
                } catch (err2) {
                    showError(true);
                }
            } else {
                showError(true);
            }
        }

        try {
            modal.querySelector('[' + CLOSE_ATTR + ']').focus({ preventScroll: true });
        } catch (err) {
            modal.querySelector('[' + CLOSE_ATTR + ']').focus();
        }
        return true;
    }

    function openFrom(node) {
        var raw = rawFromElement(node);
        if (!raw) return false;
        // open() normalizes exactly once, so the media kind is never lost.
        return open(raw, node);
    }

    function close() {
        if (!isOpen) return;

        isOpen = false;
        ytRequest = null;
        window.clearTimeout(hideTimer);
        clearMedia();
        showSpinner(false);
        showError(false);

        exitFullscreen();

        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-vertical', 'is-embed', 'is-youtube', 'is-image', 'is-fullscreen', 'is-pseudo-fullscreen', 'is-idle', 'is-ended', 'is-yt-live');
        refs.stage.style.backgroundImage = '';

        refs.seek.value = '0';
        paintProgress(0);
        refs.time.textContent = '0:00 / 0:00';
        resetTapState();

        lockScroll(false);
        syncFullscreenButton();

        if (lastFocus && typeof lastFocus.focus === 'function') {
            try {
                lastFocus.focus({ preventScroll: true });
            } catch (err) {
                try { lastFocus.focus(); } catch (err2) {}
            }
        }
        lastFocus = null;
    }

    /* ------------------------------------------------------------ transport */

    function togglePlay() {
        if (!hasTransport()) return;

        if (isEnded()) {
            showEndPlate(false);
            seekToTime(0);
            playMedia();
            syncPlayButton();
            return;
        }

        if (isPlaying()) pauseMedia();
        else playMedia();
        wake();
    }

    function skip(seconds) {
        if (!hasTransport()) return;
        var duration = getDuration();
        var limit = duration > 0 ? duration : getTime() + Math.abs(seconds);
        seekToTime(Math.max(0, Math.min(limit, getTime() + seconds)));
        syncProgress();
        wake();
    }

    function setVolume(value) {
        applyVolume(value);
    }

    function toggleMute() {
        if (!hasTransport()) return;
        applyMuteToggle();
    }

    /** True for a 9:16 Short rather than a regular 16:9 video. */
    function isVertical() {
        return !!modal && modal.classList.contains('is-vertical');
    }

    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            (modal && modal.classList.contains('is-pseudo-fullscreen')));
    }

    /**
     * Phones without the Fullscreen API (iOS Safari) still get a real
     * fullscreen picture: the stage expands to the viewport with CSS.
     */
    function pseudoFullscreen(on) {
        if (!modal) return;
        modal.classList.toggle('is-pseudo-fullscreen', !!on);
        syncFullscreenButton();
    }

    function exitFullscreen() {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            var exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) {
                try {
                    var leaving = exit.call(document);
                    if (leaving && typeof leaving.catch === 'function') leaving.catch(function () {});
                } catch (err) {}
            }
        }
        if (modal && modal.classList.contains('is-pseudo-fullscreen')) pseudoFullscreen(false);
    }

    function toggleFullscreen() {
        if (isFullscreen()) {
            exitFullscreen();
            return;
        }

        var stage = refs.stage;
        var request = stage.requestFullscreen || stage.webkitRequestFullscreen || stage.msRequestFullscreen;
        if (request) {
            try {
                var entering = request.call(stage);
                if (entering && typeof entering.catch === 'function') {
                    entering.catch(function () { if (isOpen) pseudoFullscreen(true); });
                }
                // Browsers that silently ignore the request (iPhone Safari)
                // fall through to the CSS fullscreen instead of doing nothing.
                window.setTimeout(function () {
                    if (!isOpen) return;
                    if (document.fullscreenElement || document.webkitFullscreenElement) return;
                    if (modal.classList.contains('is-pseudo-fullscreen')) return;
                    pseudoFullscreen(true);
                }, 500);
                return;
            } catch (err) {}
        }
        // Desktop Safari: only uploaded files have this path, and only a real
        // 16:9 video element should use it. A Short keeps its 9:16 box through
        // the CSS fullscreen below, so the picture is never stretched.
        if (!isVertical() && currentVideo() && currentVideo().webkitEnterFullscreen) {
            currentVideo().webkitEnterFullscreen();
            return;
        }
        pseudoFullscreen(true);
    }

    function onKeydown(event) {
        if (!isOpen) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            close();
            return;
        }

        if (event.key === 'Tab') {
            var focusables = Array.prototype.filter.call(
                modal.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])'),
                function (el) { return !el.hidden && el.offsetParent !== null; }
            );
            if (!focusables.length) return;
            var first = focusables[0];
            var last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
            return;
        }

        var tag = (event.target && event.target.tagName) || '';
        var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        var onRange = event.target === refs.seek || event.target === refs.volume;
        if (!hasTransport()) return;

        switch (event.key) {
            case ' ':
            case 'Spacebar':
            case 'k':
            case 'K':
                if (typing) return;
                event.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                if (onRange) return;
                event.preventDefault();
                skip(-SKIP_SECONDS);
                break;
            case 'ArrowRight':
                if (onRange) return;
                event.preventDefault();
                skip(SKIP_SECONDS);
                break;
            case 'ArrowUp':
                if (onRange) return;
                event.preventDefault();
                applyVolume(getVolume() + 0.1);
                wake();
                break;
            case 'ArrowDown':
                if (onRange) return;
                event.preventDefault();
                applyVolume(getVolume() - 0.1);
                wake();
                break;
            case 'm':
            case 'M':
                if (typing) return;
                toggleMute();
                break;
            case 'f':
            case 'F':
                if (typing) return;
                toggleFullscreen();
                break;
            default:
                break;
        }
    }

    /* ------------------------------------------------------------- delegation */

    var CARD_SELECTOR = '[data-mm-video-url], [data-sv2-video], .pf-card[data-mm-media]';

    document.addEventListener('click', function (event) {
        if (!event.target || !event.target.closest) return;

        // The player's own controls are handled by their own listeners.
        if (event.target.closest('.mxvp')) return;

        var card = event.target.closest(CARD_SELECTOR);
        if (!card) return;

        // Hovering or touching a card warms up the YouTube connection so the
        // first frame arrives as soon as the player opens.
        primeYoutube();

        // Respect new-tab / download gestures on real links.
        if (card.tagName === 'A' && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;

        // Cards that only carry a host link open it in a new tab, as before.
        if (attr(card, ['data-mm-video-type', 'data-mm-type']).toLowerCase() === 'link') {
            var hostUrl = attr(card, ['data-mm-video-url', 'data-mm-src', 'data-sv2-video']);
            if (hostUrl) {
                event.preventDefault();
                window.open(hostUrl, '_blank', 'noopener');
            }
            return;
        }

        if (!optionsFromElement(card)) return;

        event.preventDefault();
        openFrom(card);
    });

    // Warm the YouTube hosts as soon as a video card is hovered or touched.
    ['pointerover', 'touchstart', 'focusin'].forEach(function (type) {
        document.addEventListener(type, function (event) {
            if (!event.target || !event.target.closest) return;
            if (event.target.closest(CARD_SELECTOR)) primeYoutube();
        }, { passive: true });
    });

    primeYoutube();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', primeYoutube);
    }

    window.MexaVideoPlayer = {
        isReady: true,
        open: function (raw) { return open(raw); },
        openFrom: openFrom,
        close: close,
        isOpen: function () { return isOpen; },
        getModal: function () { return build(), modal; }
    };
})();
