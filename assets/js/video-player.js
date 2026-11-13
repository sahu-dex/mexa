/*!
 * Mexa Motion — common, reusable video player controls.
 *
 * Provides a single, standard control layer for every video modal on the
 * site (Home, Work, Service and anywhere else a video preview opens):
 *
 *   - Play / Pause
 *   - Close (×) — one per modal, handled by the page's close handler
 *   - 10 seconds backward / 10 seconds forward
 *   - Progress bar (click to jump to a time)
 *   - Volume (mute/unmute + level slider)
 *   - Fullscreen
 *
 * Only ONE set of event listeners is attached per page (on the persistent
 * control bar), so there are no duplicate listeners. Playback is bound to
 * the current <video> when a video opens and released when it closes, so
 * only one video is ever active at a time.
 */
(function () {
    'use strict';

    var SKIP_SECONDS = 10;

    function find(ctx, sel) { return ctx.querySelector(sel); }
    function hidden(el) { return el === null; }

    var ctrls = null;        // persistent .vp-controls bar (one per page)
    var playBtn = null;
    var backBtn = null;
    var fwdBtn = null;
    var progress = null;
    var volumeBtn = null;
    var volumeRange = null;
    var fsBtn = null;

    var currentVideo = null; // <video> bound right now

    // Named handlers so they can be removed when the video changes.
    var onTimeUpdate = null;
    var onPlay = null;
    var onPause = null;
    var onEnded = null;
    var onVolumeChange = null;
    var onLoaded = null;

    function releaseCurrent() {
        if (!currentVideo) return;
        if (onTimeUpdate) currentVideo.removeEventListener('timeupdate', onTimeUpdate);
        if (onPlay) currentVideo.removeEventListener('play', onPlay);
        if (onPause) currentVideo.removeEventListener('pause', onPause);
        if (onEnded) currentVideo.removeEventListener('ended', onEnded);
        if (onVolumeChange) currentVideo.removeEventListener('volumechange', onVolumeChange);
        if (onLoaded) currentVideo.removeEventListener('loadedmetadata', onLoaded);
        currentVideo = null;
        onTimeUpdate = onPlay = onPause = onEnded = onVolumeChange = onLoaded = null;
    }

    function setPlayIcon(playing) {
        if (!playBtn) return;
        var icPlay = find(playBtn, '.vp-ic-play');
        var icPause = find(playBtn, '.vp-ic-pause');
        if (icPlay) icPlay.style.display = playing ? 'none' : '';
        if (icPause) icPause.style.display = playing ? '' : 'none';
        playBtn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    }

    function setVolumeIcon() {
        if (!volumeBtn || !currentVideo) return;
        var icUp = find(volumeBtn, '.vp-ic-volume-up');
        var icOff = find(volumeBtn, '.vp-ic-volume-off');
        if (!icUp || !icOff) return;
        if (currentVideo.muted || currentVideo.volume === 0) {
            icUp.style.display = 'none';
            icOff.style.display = '';
        } else {
            icUp.style.display = '';
            icOff.style.display = 'none';
        }
        if (volumeRange) volumeRange.value = currentVideo.volume;
    }

    function updateProgress() {
        if (!currentVideo || !progress) return;
        var pct = currentVideo.duration && currentVideo.duration > 0
            ? (currentVideo.currentTime / currentVideo.duration) * 100
            : 0;
        progress.value = pct;
        progress.style.background =
            'linear-gradient(to right, #1669e8 ' + pct + '%, rgba(255, 255, 255, .42) ' + pct + '%)';
    }

    function showControls() {
        if (ctrls) ctrls.hidden = false;
    }
    function hideControls() {
        if (ctrls) ctrls.hidden = true;
    }

    function bindVideo(video) {
        releaseCurrent();
        if (!video) { hideControls(); return; }
        currentVideo = video;
        showControls();
        setPlayIcon(!video.paused && !video.ended);
        setVolumeIcon();
        updateProgress();

        onLoaded = function () { updateProgress(); };
        onTimeUpdate = function () { updateProgress(); };
        onPlay = function () { setPlayIcon(true); };
        onPause = function () { setPlayIcon(false); };
        onEnded = function () { setPlayIcon(false); };
        onVolumeChange = function () { setVolumeIcon(); updateProgress(); };

        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        video.addEventListener('volumechange', onVolumeChange);
    }

    function togglePlayPause() {
        if (!currentVideo) return;
        if (currentVideo.paused || currentVideo.ended) currentVideo.play();
        else currentVideo.pause();
    }
    function skipBack() { if (!currentVideo) return; currentVideo.currentTime = Math.max(0, currentVideo.currentTime - SKIP_SECONDS); }
    function skipForward() { if (!currentVideo) return; currentVideo.currentTime = Math.min(currentVideo.duration || 0, currentVideo.currentTime + SKIP_SECONDS); }
    function toggleMute() { if (!currentVideo) return; currentVideo.muted = !currentVideo.muted; }
    function setVolume() { if (!currentVideo || !volumeRange) return; currentVideo.muted = false; currentVideo.volume = Number(volumeRange.value); }

    var fsTarget = null;
    var fsIconExpand = null;
    var fsIconCompress = null;
    function toggleFullscreen() {
        if (!currentVideo) return;
        var target = fsTarget || currentVideo;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else if (target.requestFullscreen) {
            target.requestFullscreen();
        }
    }
    function onFullscreenChange() {
        var full = !!document.fullscreenElement;
        if (fsTarget && fsTarget.classList) fsTarget.classList.toggle('vp-is-fullscreen', full);
        if (fsIconExpand && fsIconCompress) {
            fsIconExpand.style.display = full ? 'none' : '';
            fsIconCompress.style.display = full ? '' : 'none';
        }
        fsBtn && fsBtn.setAttribute('aria-label', full ? 'Exit fullscreen' : 'Fullscreen');
        updateProgress();
    }

    function init() {
        var bar = find(document, '.vp-controls');
        if (!bar) return;
        ctrls = bar;

        playBtn = find(ctrls, '[data-vp-play-pause]');
        backBtn = find(ctrls, '[data-vp-skip-back]');
        fwdBtn = find(ctrls, '[data-vp-skip-forward]');
        progress = find(ctrls, '[data-vp-progress]');
        volumeBtn = find(ctrls, '[data-vp-volume]');
        volumeRange = find(ctrls, '[data-vp-volume-range]');
        fsBtn = find(ctrls, '[data-vp-fullscreen]');

        if (playBtn) playBtn.addEventListener('click', togglePlayPause, { passive: true });
        if (backBtn) backBtn.addEventListener('click', skipBack, { passive: true });
        if (fwdBtn) fwdBtn.addEventListener('click', skipForward, { passive: true });
        if (volumeBtn) volumeBtn.addEventListener('click', toggleMute, { passive: true });
        if (volumeRange) volumeRange.addEventListener('input', setVolume, { passive: true });
        if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen, { passive: true });

        if (progress) {
            progress.addEventListener('input', function () {
                if (!currentVideo || !currentVideo.duration) return;
                currentVideo.currentTime = (progress.value / 100) * currentVideo.duration;
            }, { passive: true });
        }

        fsIconExpand = fsBtn ? find(fsBtn, '.vp-ic-expand') : null;
        fsIconCompress = fsBtn ? find(fsBtn, '.vp-ic-compress') : null;

        // Fullscreen the whole modal (backdrop + player), not just the video.
        fsTarget = ctrls.closest ? ctrls.closest('.wk-modal, .mmvp, .sv2-modal') : null;

        document.addEventListener('fullscreenchange', onFullscreenChange);

        // Expose a tiny API for the page scripts.
        window.MXVideoPlayer = {
            bind: bindVideo,
            release: releaseCurrent,
            controls: ctrls
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
