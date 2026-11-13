/*!
 * Mexa Motion — Universal YouTube-style video player.
 *
 * Single shared player for all video modals (Home, Work, Service).
 *
 * Features:
 *   - Center Play / Pause overlay (shows when paused, hides when playing)
 *   - 5-second skip backward / forward buttons + double-click skip
 *   - Skip indicator animation (⏪ 5s / 5s ⏩)
 *   - Bottom playback bar: progress bar, current time, total duration,
 *     volume, fullscreen
 *   - Auto-hide controls after inactivity; show on mouse move / touch
 *   - Keyboard shortcuts: Space, Left / Right, F, M
 *   - YouTube / Vimeo / Facebook iframe support (provider keeps its own UI)
 *   - Original aspect ratio preserved (portrait / landscape)
 *
 * API exposed on window.MXVideoPlayer:
 *   bind(videoElement, stageElement)   — attach controls to a playing video
 *   release()                          — detach and hide controls
 */

(function () {
    'use strict';

    var SKIP_SECONDS = 5;
    var HIDE_DELAY = 3000;
    var DOUBLE_CLICK_DELAY = 300;

    /* ---------- DOM references ---------- */
    var bar = null;              // .vp-controls
    var centerPlay = null;       // .vp-center-play overlay
    var playBtn = null;
    var skipBackBtn = null;
    var skipFwdBtn = null;
    var skipIndicator = null;    // .vp-skip-indicator
    var progress = null;
    var curTimeEl = null;
    var durTimeEl = null;
    var volumeBtn = null;
    var volumeRange = null;
    var fsBtn = null;

    /* ---------- State ---------- */
    var video = null;            // current <video>
    var stage = null;            // container for double-click detection
    var hideTimer = null;
    var isHovering = false;
    var lastClickTime = 0;
    var lastClickX = 0;

    /* ---------- Helpers ---------- */
    function $find(ctx, sel) {
        return ctx ? ctx.querySelector(sel) : null;
    }

    function formatTime(sec) {
        if (!sec || sec < 0 || isNaN(sec)) return '0:00';
        sec = Math.floor(sec);
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function toggleClass(el, cls, on) {
        if (!el) return;
        if (on) el.classList.add(cls);
        else el.classList.remove(cls);
    }

    /* ---------- Skip indicator ---------- */
    function showSkipIndicator(dir) {
        if (!skipIndicator) return;
        skipIndicator.textContent =
            dir === 'back' ? '⏪ ' + SKIP_SECONDS + 's' : SKIP_SECONDS + 's ⏩';
        skipIndicator.style.display = 'block';
        skipIndicator.style.opacity = '1';
        clearTimeout(skipIndicator._hide);
        skipIndicator._hide = setTimeout(function () {
            skipIndicator.style.opacity = '0';
            setTimeout(function () {
                skipIndicator.style.display = 'none';
            }, 300);
        }, 1000);
    }

    function skip(seconds) {
        if (!video) return;
        if (!video.duration) return;
        video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
        showSkipIndicator(seconds < 0 ? 'back' : 'forward');
    }
    function skipBack() { skip(-SKIP_SECONDS); }
    function skipForward() { skip(SKIP_SECONDS); }

    /* ---------- Play / Pause ---------- */
    function togglePlayPause() {
        if (!video) return;
        if (video.paused || video.ended) video.play();
        else video.pause();
    }

    function updatePlayIcon() {
        if (!playBtn || !video) return;
        var playing = !video.paused && !video.ended;
        playBtn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
        var icPlay = $find(playBtn, '.vp-ic-play');
        var icPause = $find(playBtn, '.vp-ic-pause');
        if (icPlay) icPlay.style.display = playing ? 'none' : '';
        if (icPause) icPause.style.display = playing ? '' : 'none';
        if (centerPlay) centerPlay.style.display = playing ? 'none' : 'flex';
    }

    /* ---------- Progress / time ---------- */
    function updateUI() {
        if (!video) return;
        updatePlayIcon();
        if (curTimeEl) curTimeEl.textContent = formatTime(video.currentTime);
        if (durTimeEl) durTimeEl.textContent = formatTime(video.duration);
        if (progress) {
            var pct = video.duration && video.duration > 0
                ? (video.currentTime / video.duration) * 100
                : 0;
            progress.value = pct;
            progress.style.background =
                'linear-gradient(to right, #1669e8 ' + pct + '%, rgba(255,255,255,.42) ' + pct + '%)';
        }
    }

    function seekByProgress(val) {
        if (!video || !video.duration) return;
        video.currentTime = (val / 100) * video.duration;
    }

    /* ---------- Volume ---------- */
    function toggleMute() {
        if (!video) return;
        video.muted = !video.muted;
    }

    function setVolumeLevel() {
        if (!video || !volumeRange) return;
        video.muted = false;
        video.volume = Number(volumeRange.value);
    }

    function updateVolumeIcon() {
        if (!volumeBtn || !video) return;
        var icUp = $find(volumeBtn, '.vp-ic-volume-up');
        var icOff = $find(volumeBtn, '.vp-ic-volume-off');
        if (!icUp || !icOff) return;
        if (video.muted || video.volume === 0) {
            icUp.style.display = 'none';
            icOff.style.display = '';
        } else {
            icUp.style.display = '';
            icOff.style.display = 'none';
        }
        if (volumeRange) volumeRange.value = video.volume;
    }

    /* ---------- Fullscreen ---------- */
    var fsTarget = null;
    var fsIconExpand = null;
    var fsIconCompress = null;

    function toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else if (fsTarget && fsTarget.requestFullscreen) {
            fsTarget.requestFullscreen();
        }
    }

    function onFullscreenChange() {
        var full = !!document.fullscreenElement;
        toggleClass(fsTarget, 'vp-is-fullscreen', full);
        if (fsIconExpand && fsIconCompress) {
            fsIconExpand.style.display = full ? 'none' : '';
            fsIconCompress.style.display = full ? '' : 'none';
        }
        if (fsBtn) fsBtn.setAttribute('aria-label', full ? 'Exit fullscreen' : 'Fullscreen');
        updateUI();
    }

    /* ---------- Auto-hide controls ---------- */
    function showControls() {
        if (bar) bar.hidden = false;
        if (centerPlay && video && (!video.paused || video.ended)) {
            // center play only shows when paused; keep bar visible
        }
        resetHideTimer();
    }

    function hideControls() {
        if (!bar || isHovering) return;
        if (video && (!video.paused && !video.ended)) {
            bar.hidden = true;
        }
    }

    function startAutoHide() {
        stopAutoHide();
        if (video && !video.paused && !video.ended) {
            hideTimer = setTimeout(hideControls, HIDE_DELAY);
        }
    }

    function stopAutoHide() {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    function resetHideTimer() {
        stopAutoHide();
        if (!isHovering && video && !video.paused && !video.ended) {
            startAutoHide();
        }
    }

    /* ---------- Double-click skip on stage ---------- */
    function onStageClick(e) {
        if (!stage || !video) return;
        var now = Date.now();
        var rect = stage.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var isLeft = x < rect.width / 2;
        if (now - lastClickTime < DOUBLE_CLICK_DELAY) {
            skip(isLeft ? -SKIP_SECONDS : SKIP_SECONDS);
            lastClickTime = 0;
        } else {
            lastClickTime = now;
            lastClickX = x;
        }
    }

    /* ---------- Event handlers ---------- */
    function onTimeUpdate() { updateUI(); }
    function onLoaded() { updateUI(); }
    function onPlay() {
        updateUI();
        startAutoHide();
    }
    function onPause() {
        updateUI();
        stopAutoHide();
        showControls();
    }
    function onEnded() {
        updateUI();
        stopAutoHide();
        showControls();
    }
    function onVolumeChange() {
        updateVolumeIcon();
        updateUI();
    }
    function onVideoClick() {
        togglePlayPause();
    }
    function onVideoDblClick() {
        toggleFullscreen();
    }
    function onMouseMove() {
        showControls();
    }
    function onMouseEnter() {
        isHovering = true;
        showControls();
    }
    function onMouseLeave() {
        isHovering = false;
        resetHideTimer();
    }
    function onProgressInput() {
        seekByProgress(Number(progress.value));
    }
    function onKeydown(e) {
        if (!video) return;
        // Ignore when typing in an input
        var target = document.activeElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            togglePlayPause();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            skip(-SKIP_SECONDS);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            skip(SKIP_SECONDS);
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            toggleMute();
        }
    }

    /* ---------- Attach / detach ---------- */
    function attachControlListeners() {
        if (playBtn) playBtn.addEventListener('click', togglePlayPause, { passive: true });
        if (centerPlay) centerPlay.addEventListener('click', togglePlayPause, { passive: true });
        if (skipBackBtn) skipBackBtn.addEventListener('click', skipBack, { passive: true });
        if (skipFwdBtn) skipFwdBtn.addEventListener('click', skipForward, { passive: true });
        if (volumeBtn) volumeBtn.addEventListener('click', toggleMute, { passive: true });
        if (volumeRange) volumeRange.addEventListener('input', setVolumeLevel, { passive: true });
        if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen, { passive: true });
        if (progress) progress.addEventListener('input', onProgressInput, { passive: true });
    }

    function detachControlListeners() {
        if (playBtn) playBtn.removeEventListener('click', togglePlayPause);
        if (centerPlay) centerPlay.removeEventListener('click', togglePlayPause);
        if (skipBackBtn) skipBackBtn.removeEventListener('click', skipBack);
        if (skipFwdBtn) skipFwdBtn.removeEventListener('click', skipForward);
        if (volumeBtn) volumeBtn.removeEventListener('click', toggleMute);
        if (volumeRange) volumeRange.removeEventListener('input', setVolumeLevel);
        if (fsBtn) fsBtn.removeEventListener('click', toggleFullscreen);
        if (progress) progress.removeEventListener('input', onProgressInput);
    }

    function bindVideo(videoEl, stageEl) {
        releaseVideo();
        video = videoEl;
        stage = stageEl;

        if (!video) {
            if (bar) bar.hidden = true;
            if (centerPlay) centerPlay.style.display = 'none';
            return;
        }

        // Show controls and bind to stage
        if (bar) bar.hidden = false;
        if (centerPlay) centerPlay.style.display = 'none';

        attachControlListeners();

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('click', onVideoClick);
        video.addEventListener('dblclick', onVideoDblClick);

        if (stage) {
            stage.addEventListener('click', onStageClick);
            stage.addEventListener('mousemove', onMouseMove);
            stage.addEventListener('mouseenter', onMouseEnter);
            stage.addEventListener('mouseleave', onMouseLeave);
        }

        document.addEventListener('keydown', onKeydown);
        document.addEventListener('fullscreenchange', onFullscreenChange);

        // Determine fullscreen target (the modal)
        fsTarget = bar && bar.closest
            ? bar.closest('.wk-modal, .mmvp, .sv2-modal, .showreel-modal')
            : null;
        fsIconExpand = fsBtn ? $find(fsBtn, '.vp-ic-expand') : null;
        fsIconCompress = fsBtn ? $find(fsBtn, '.vp-ic-compress') : null;

        updateUI();
        showControls();
    }

    function releaseVideo() {
        stopAutoHide();

        if (video) {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('loadeddata', onLoaded);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('volumechange', onVolumeChange);
            video.removeEventListener('click', onVideoClick);
            video.removeEventListener('dblclick', onVideoDblClick);
        }
        if (stage) {
            stage.removeEventListener('click', onStageClick);
            stage.removeEventListener('mousemove', onMouseMove);
            stage.removeEventListener('mouseenter', onMouseEnter);
            stage.removeEventListener('mouseleave', onMouseLeave);
        }
        document.removeEventListener('keydown', onKeydown);
        document.removeEventListener('fullscreenchange', onFullscreenChange);

        detachControlListeners();

        video = null;
        stage = null;
        fsTarget = null;

        if (bar) bar.hidden = true;
        if (centerPlay) centerPlay.style.display = 'none';
    }

    /* ---------- Init ---------- */
    function init() {
        bar = $find(document, '.vp-controls');
        if (!bar) return;

        centerPlay = $find(document, '.vp-center-play');
        playBtn = $find(bar, '[data-vp-play-pause]');
        skipBackBtn = $find(bar, '[data-vp-skip-back]');
        skipFwdBtn = $find(bar, '[data-vp-skip-forward]');
        skipIndicator = $find(document, '.vp-skip-indicator');
        progress = $find(bar, '[data-vp-progress]');
        curTimeEl = $find(bar, '.vp-time-current');
        durTimeEl = $find(bar, '.vp-time-duration');
        volumeBtn = $find(bar, '[data-vp-volume]');
        volumeRange = $find(bar, '[data-vp-volume-range]');
        fsBtn = $find(bar, '[data-vp-fullscreen]');

        attachControlListeners();
        document.addEventListener('fullscreenchange', onFullscreenChange);

        window.MXVideoPlayer = {
            bind: bindVideo,
            release: releaseVideo,
            controls: bar
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
