/**
 * MEXA MOTION — shared video player.
 *
 * One reusable, YouTube-style player for every video on the site
 * (Home "Our Work" gallery, Work page videos + Shorts, Service page videos
 * and the showreel). The player builds a single modal once, keeps a single
 * close control, and owns the only set of listeners, so duplicate × buttons
 * or duplicated handlers can never appear again.
 *
 * YouTube clips run through the YouTube IFrame Player API with controls=0
 * and modestbranding, so the player shows no YouTube logo, channel name,
 * title, share/watch-later buttons, settings or "More videos" screen — our
 * own control bar drives playback instead. Every other provider (Vimeo,
 * Facebook, custom iframes) keeps using a plain iframe.
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
 */
(function () {
    'use strict';

    if (window.MexaVideoPlayer && window.MexaVideoPlayer.isReady) return;

    var MODAL_ID = 'mexa-video-player';
    var CLOSE_ATTR = 'data-mxvp-close';
    var BACKDROP_ATTR = 'data-mxvp-backdrop';
    var SEEK_MAX = 1000;
    var SKIP_SECONDS = 10;
    var YT_API_SRC = 'https://www.youtube.com/iframe_api';
    // The IFrame API is the only path that keeps YouTube's own chrome off the
    // player, but it is a third-party script: ad blockers, in-app browsers and
    // flaky networks can block it or swallow its callback. Each of these timers
    // is the point where we give up on the API and switch the same clip to the
    // standard embed, so a video never sits behind a dead poster.
    var YT_API_TIMEOUT = 3000;
    var YT_READY_TIMEOUT = 4500;
    var YT_START_TIMEOUT = 4000;

    // YouTube player states.
    var YT_ENDED = 0;
    var YT_PLAYING = 1;
    var YT_PAUSED = 2;
    var YT_BUFFERING = 3;
    var YT_CUED = 5;

    var ICON = {
        close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.3 6.3 17.7 17.7M17.7 6.3 6.3 17.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
        play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.4 5.2a.9.9 0 0 1 1.4-.77l9 6.8a.9.9 0 0 1 0 1.54l-9 6.8a.9.9 0 0 1-1.4-.77z" fill="currentColor"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5.2h3.5v13.6H7zM13.5 5.2H17v13.6h-3.5z" fill="currentColor"/></svg>',
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
                '<button type="button" class="mxvp__center" data-mxvp-center aria-label="Play video">' + ICON.play + '</button>' +
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
    var ytPlayer = null;
    var ytTick = 0;
    var ytStarted = false;
    var ytApiPromise = null;
    var ytReady = false;
    var ytWatchdog = 0;
    var ytStartWatchdog = 0;
    var ytRequest = null;
    var requestToken = 0;

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
        refs.center = modal.querySelector('[data-mxvp-center]');
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
        refs.center.addEventListener('click', togglePlay);
        refs.back.addEventListener('click', function () { skip(-SKIP_SECONDS); });
        refs.forward.addEventListener('click', function () { skip(SKIP_SECONDS); });
        refs.mute.addEventListener('click', toggleMute);
        refs.volume.addEventListener('input', function () {
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

        // Clicking the picture toggles playback; a double click goes fullscreen.
        refs.media.addEventListener('click', function () {
            if (hasTransport()) togglePlay();
        });
        refs.media.addEventListener('dblclick', function () {
            if (hasTransport()) toggleFullscreen();
        });

        ['pointermove', 'pointerdown', 'touchstart', 'focusin'].forEach(function (type) {
            refs.stage.addEventListener(type, wake, { passive: true });
        });

        modal.addEventListener('mousemove', wake, { passive: true });

        document.addEventListener('keydown', onKeydown);
        document.addEventListener('fullscreenchange', syncFullscreenButton);
        document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
    }

    /* ---------------------------------------------------- playback primitives */

    function currentVideo() {
        return mediaEl && mediaEl.tagName === 'VIDEO' ? mediaEl : null;
    }

    function youtubeReady() {
        return mode === 'youtube' && ytPlayer && typeof ytPlayer.getPlayerState === 'function';
    }

    function hasTransport() {
        return mode === 'video' ? !!currentVideo() : youtubeReady();
    }

    function ytState() {
        if (!youtubeReady()) return -1;
        try {
            return ytPlayer.getPlayerState();
        } catch (err) {
            return -1;
        }
    }

    function isPlaying() {
        if (youtubeReady()) return ytState() === YT_PLAYING;
        var video = currentVideo();
        return !!video && !video.paused && !video.ended;
    }

    function getTime() {
        if (youtubeReady()) {
            try {
                return ytPlayer.getCurrentTime() || 0;
            } catch (err) {
                return 0;
            }
        }
        var video = currentVideo();
        return video ? video.currentTime || 0 : 0;
    }

    function getDuration() {
        if (youtubeReady()) {
            try {
                return ytPlayer.getDuration() || 0;
            } catch (err) {
                return 0;
            }
        }
        var video = currentVideo();
        return video && isFinite(video.duration) ? video.duration : 0;
    }

    function seekToTime(seconds) {
        if (youtubeReady()) {
            try {
                ytPlayer.seekTo(seconds, true);
            } catch (err) {}
            return;
        }
        var video = currentVideo();
        if (video) video.currentTime = seconds;
    }

    function playMedia() {
        if (youtubeReady()) {
            try {
                ytPlayer.playVideo();
            } catch (err) {
                if (ytReady) degradeYoutube('play command failed');
                return;
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
        if (youtubeReady()) {
            try {
                ytPlayer.pauseVideo();
            } catch (err) {}
            return;
        }
        var video = currentVideo();
        if (video) video.pause();
    }

    function getVolume() {
        if (youtubeReady()) {
            try {
                return (ytPlayer.getVolume ? ytPlayer.getVolume() : 100) / 100;
            } catch (err) {
                return 1;
            }
        }
        var video = currentVideo();
        return video ? video.volume : 1;
    }

    function isMuted() {
        if (youtubeReady()) {
            try {
                return !!(ytPlayer.isMuted && ytPlayer.isMuted());
            } catch (err) {
                return false;
            }
        }
        var video = currentVideo();
        return !video || video.muted || video.volume === 0;
    }

    function applyVolume(value) {
        var volume = Math.max(0, Math.min(1, isFinite(value) ? value : 1));
        if (youtubeReady()) {
            try {
                if (ytPlayer.setVolume) ytPlayer.setVolume(Math.round(volume * 100));
                if (volume === 0) {
                    if (ytPlayer.mute) ytPlayer.mute();
                } else if (ytPlayer.isMuted && ytPlayer.isMuted() && ytPlayer.unMute) {
                    ytPlayer.unMute();
                }
            } catch (err) {}
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
        if (youtubeReady()) {
            try {
                if (isMuted()) {
                    if (ytPlayer.unMute) ytPlayer.unMute();
                    if ((ytPlayer.getVolume ? ytPlayer.getVolume() : 0) === 0 && ytPlayer.setVolume) {
                        ytPlayer.setVolume(Math.round((rememberVolume || 1) * 100));
                    }
                } else if (ytPlayer.mute) {
                    ytPlayer.mute();
                }
            } catch (err) {}
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

    function syncCenter() {
        if (mode !== 'video' && mode !== 'youtube') {
            refs.center.hidden = true;
            return;
        }
        if (mode === 'youtube' && !youtubeReady()) {
            refs.center.hidden = true;
            return;
        }

        var show;
        if (isEnded()) {
            show = true;
        } else if (mode === 'youtube') {
            var state = ytState();
            show = state === YT_PAUSED || state === YT_ENDED || state === YT_CUED;
        } else {
            var video = currentVideo();
            if (!video) {
                refs.center.hidden = true;
                return;
            }
            // Wait for the first frame so a normal autoplay start has no flash.
            show = (video.paused || video.ended) && (video.readyState >= 1 || video.currentTime > 0 || video.ended);
        }

        refs.center.hidden = !show;
        refs.center.innerHTML = isEnded() ? ICON.replay : ICON.play;
        if (show) setControlsVisible(true);
    }

    function syncPlayButton() {
        var playing = isPlaying();
        refs.play.innerHTML = playing ? ICON.pause : ICON.play;
        refs.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        if (!playing && isOpen) {
            window.clearTimeout(hideTimer);
            setControlsVisible(true);
        }
        syncCenter();
    }

    function syncVolume() {
        var muted = isMuted();
        var volume = getVolume();
        refs.mute.innerHTML = muted ? ICON.muted : ICON.volume;
        refs.mute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
        refs.volume.value = muted ? 0 : volume;
        refs.volume.style.setProperty('--mxvp-volume', (muted ? 0 : volume) * 100 + '%');
    }

    function syncFullscreenButton() {
        var active = !!(document.fullscreenElement || document.webkitFullscreenElement);
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

    function loadYoutubeApi() {
        if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
        if (ytApiPromise) return ytApiPromise;

        var attempt = new Promise(function (resolve, reject) {
            var settled = false;
            var previous = window.onYouTubeIframeAPIReady;

            window.onYouTubeIframeAPIReady = function () {
                if (typeof previous === 'function') {
                    try { previous(); } catch (err) {}
                }
                if (settled) return;
                settled = true;
                resolve(window.YT);
            };

            var script = document.createElement('script');
            script.src = YT_API_SRC;
            script.async = true;
            script.onerror = function () {
                if (settled) return;
                settled = true;
                reject(new Error('YouTube API could not be loaded'));
            };
            (document.head || document.documentElement || document.body).appendChild(script);

            window.setTimeout(function () {
                if (settled) return;
                if (window.YT && window.YT.Player) {
                    settled = true;
                    resolve(window.YT);
                    return;
                }
                settled = true;
                reject(new Error('YouTube API timed out'));
            }, YT_API_TIMEOUT);
        });

        ytApiPromise = attempt.catch(function (err) {
            // Allow a later open to try again instead of caching the failure.
            ytApiPromise = null;
            throw err;
        });

        return ytApiPromise;
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

    function destroyYoutube() {
        stopYtTick();
        window.clearTimeout(ytWatchdog);
        window.clearTimeout(ytStartWatchdog);
        ytWatchdog = 0;
        ytStartWatchdog = 0;
        ytReady = false;
        ytStarted = false;
        if (ytPlayer) {
            try { if (ytPlayer.stopVideo) ytPlayer.stopVideo(); } catch (err) {}
            try { if (ytPlayer.destroy) ytPlayer.destroy(); } catch (err) {}
        }
        ytPlayer = null;
    }

    function onYoutubeState(event) {
        var state = event && typeof event.data === 'number' ? event.data : -1;

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
            if (ytStarted) showEndPlate(true);
        }

        syncPlayButton();
        syncProgress();
    }

    /**
     * The API needs a real http(s) origin; "null" (file://, some sandboxes)
     * makes YouTube reject the player outright, so only send a valid one.
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

    /**
     * Play a YouTube video with the IFrame Player API and controls disabled so
     * YouTube shows no logo, title, channel, share buttons or "More videos"
     * screen. Our own control bar drives the player instead.
     */
    function mountYoutube(request) {
        var token = ++requestToken;
        ytRequest = request;
        ytReady = false;
        window.clearTimeout(ytWatchdog);
        window.clearTimeout(ytStartWatchdog);
        var host = document.createElement('div');
        host.className = 'mxvp__yt';
        refs.media.appendChild(host);
        mediaEl = host;
        showSpinner(true);
        syncCenter();

        loadYoutubeApi().then(function (YT) {
            if (token !== requestToken || !isOpen || mode !== 'youtube') return;

            // If the player object never becomes ready the iframe was blocked
            // or never loaded, so fall back instead of showing a dead poster.
            window.clearTimeout(ytWatchdog);
            ytWatchdog = window.setTimeout(function () {
                if (token !== requestToken || !isOpen) return;
                if (ytReady) return;
                degradeYoutube('player never became ready');
            }, YT_READY_TIMEOUT);

            try {
                ytPlayer = new YT.Player(host, {
                    videoId: request.videoId,
                    playerVars: {
                        autoplay: 1,
                        cc_load_policy: 0,
                        color: 'white',
                        controls: 0,
                        disablekb: 1,
                        enablejsapi: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        modestbranding: 1,
                        origin: youtubeOrigin(),
                        playsinline: 1,
                        rel: 0,
                        showinfo: 0
                    },
                    events: {
                        onReady: function (event) {
                            if (token !== requestToken || !isOpen) return;
                            ytReady = true;
                            window.clearTimeout(ytWatchdog);
                            showSpinner(false);
                            try {
                                if (event.target.setVolume) {
                                    event.target.setVolume(Math.round(Math.max(0, Math.min(1, rememberVolume)) * 100));
                                }
                            } catch (err) {}
                            try { event.target.playVideo(); } catch (err) {}
                            syncVolume();
                            syncPlayButton();
                            syncProgress();
                            startYtTick();
                            // Some mobile browsers refuse autoplay; offer the big
                            // play button instead of an apparently frozen picture.
                            window.setTimeout(function () {
                                if (token !== requestToken || !isOpen) return;
                                var state = ytState();
                                if (state === YT_PLAYING || state === YT_BUFFERING || isEnded()) return;
                                refs.center.hidden = false;
                                refs.center.innerHTML = ICON.play;
                                setControlsVisible(true);
                            }, 1500);
                        },
                        onStateChange: function (event) {
                            if (token !== requestToken || !isOpen) return;
                            onYoutubeState(event);
                        },
                        onError: function () {
                            if (token !== requestToken || !isOpen) return;
                            // Errors 2/5/100/101/150 mean the API player could
                            // not load this clip; the plain embed often still
                            // can (and can at least tell the viewer why not).
                            degradeYoutube('player error');
                        }
                    }
                });
            } catch (err) {
                degradeYoutube('player could not be created');
            }
        }).catch(function () {
            if (token !== requestToken || !isOpen) return;
            degradeYoutube('api script could not be loaded');
        });
    }

    /** If the API is unavailable, fall back to a normal YouTube embed so the clip still plays. */
    /**
     * Give up on the IFrame API for this clip and use the standard embed.
     * The video still plays; keeping the site usable matters more than hiding
     * YouTube's own controls in a browser that refuses the API.
     */
    function degradeYoutube(reason) {
        if (!isOpen || mode !== 'youtube' || !ytRequest) return;
        if (modal.classList.contains('is-embed')) return;
        window.clearTimeout(ytWatchdog);
        window.clearTimeout(ytStartWatchdog);
        if (window.console && console.warn) {
            console.warn('[mexa video] YouTube IFrame API unavailable (' + reason + '); falling back to the standard embed.');
        }
        var request = ytRequest;
        // Leave the player's own event callback before replacing it.
        window.setTimeout(function () {
            if (!isOpen || mode !== 'youtube') return;
            fallbackYoutubeFrame(request);
        }, 0);
    }

    /** After an explicit play command, make sure the API actually started. */
    function watchYtStart() {
        if (!ytReady) return;
        window.clearTimeout(ytStartWatchdog);
        ytStartWatchdog = window.setTimeout(function () {
            if (!isOpen || mode !== 'youtube' || ytStarted) return;
            if (modal.classList.contains('is-embed')) return;
            var state = ytState();
            if (state === YT_PLAYING || state === YT_BUFFERING ||
                state === YT_PAUSED || state === YT_ENDED) return;
            degradeYoutube('playback did not start');
        }, YT_START_TIMEOUT);
    }

    function fallbackYoutubeFrame(request) {
        if (!isOpen || mode !== 'youtube' || !request.videoId) return;

        destroyYoutube();
        refs.media.innerHTML = '';
        modal.classList.add('is-embed');

        var frame = document.createElement('iframe');
        frame.className = 'mxvp__frame';
        frame.title = request.title;
        frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('frameborder', '0');
        frame.addEventListener('load', function () { showSpinner(false); });
        mediaEl = frame;
        refs.media.appendChild(frame);
        frame.src = 'https://www.youtube-nocookie.com/embed/' + request.videoId +
            '?autoplay=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&playsinline=1&cc_load_policy=0';
        showSpinner(false);
        syncPlayButton();
    }

    /* -------------------------------------------------------------- mounting */

    function mountVideo(request) {
        var video = document.createElement('video');
        video.className = 'mxvp__video';
        video.preload = 'metadata';
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
        video.addEventListener('ended', syncPlayButton);
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
        destroyYoutube();

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
        modal.classList.remove('is-fullscreen', 'is-idle', 'is-ended');
        refs.dialog.setAttribute('aria-label', request.title + ' — video player');
        refs.stage.style.backgroundImage = request.poster ? cssUrl(request.poster) : '';

        refs.seek.value = '0';
        paintProgress(0);
        refs.time.textContent = '0:00 / 0:00';
        refs.center.hidden = true;
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
            if (mode === 'youtube' && request.videoId) fallbackYoutubeFrame(request);
            else showError(true);
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

        if (document.fullscreenElement || document.webkitFullscreenElement) {
            var exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) {
                try { exit.call(document); } catch (err) {}
            }
        }

        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-vertical', 'is-embed', 'is-youtube', 'is-image', 'is-fullscreen', 'is-idle', 'is-ended');
        refs.stage.style.backgroundImage = '';

        refs.seek.value = '0';
        paintProgress(0);
        refs.time.textContent = '0:00 / 0:00';

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

    function toggleFullscreen() {
        var active = document.fullscreenElement || document.webkitFullscreenElement;
        if (active) {
            var exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) {
                var leaving = exit.call(document);
                if (leaving && typeof leaving.catch === 'function') leaving.catch(function () {});
            }
            return;
        }
        var stage = refs.stage;
        var request = stage.requestFullscreen || stage.webkitRequestFullscreen || stage.msRequestFullscreen;
        if (request) {
            var entering = request.call(stage);
            if (entering && typeof entering.catch === 'function') entering.catch(function () {});
        } else if (currentVideo() && currentVideo().webkitEnterFullscreen) {
            currentVideo().webkitEnterFullscreen();
        }
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

    window.MexaVideoPlayer = {
        isReady: true,
        open: function (raw) { return open(raw); },
        openFrom: openFrom,
        close: close,
        isOpen: function () { return isOpen; },
        getModal: function () { return build(), modal; }
    };
})();
