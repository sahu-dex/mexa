/**
 * MEXA MOTION — Homepage Work / Shorts preview player.
 *
 * Opens a single accessible modal for any Work card that has a real media
 * source attached. Videos are played in place (native <video> or provider
 * iframe), Shorts use a 9:16 stage, and every close path stops playback.
 */
(function () {
    'use strict';

    var modal = document.getElementById('mm-work-modal');
    if (!modal) return;

    var player = modal.querySelector('[data-mm-player]');
    var loading = modal.querySelector('[data-mm-loading]');
    var errorBox = modal.querySelector('[data-mm-error]');
    var errorText = modal.querySelector('[data-mm-error-text]');
    var externalLink = modal.querySelector('[data-mm-external]');
    var retryBtn = modal.querySelector('[data-mm-retry]');
    var statusEl = modal.querySelector('[data-mm-status]');
    var closeBtn = modal.querySelector('[data-mm-close]');

    if (!player || !loading || !errorBox || !closeBtn) return;

    var lastFocused = null;
    var activeCard = null;
    var readyTimer = 0;
    var fallbackTimer = 0;

    function youtubeId(url) {
        var m = String(url || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
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

    function setLoading(visible) {
        if (!loading) return;
        loading.hidden = !visible;
    }

    function clearTimers() {
        window.clearTimeout(readyTimer);
        window.clearTimeout(fallbackTimer);
    }

    function showError(message, link) {
        clearTimers();
        setLoading(false);
        errorText.textContent = message;
        if (externalLink) {
            if (link) {
                externalLink.href = link;
                externalLink.hidden = false;
            } else {
                externalLink.hidden = true;
            }
        }
        errorBox.hidden = false;
    }

    function hideError() {
        errorBox.hidden = true;
    }

    function markReady() {
        clearTimers();
        setLoading(false);
    }

    function buildVideo(src, poster, title) {
        var video = document.createElement('video');
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.preload = 'metadata';
        video.setAttribute('aria-label', title || 'Video player');
        if (poster) video.poster = poster;

        video.addEventListener('loadeddata', markReady, { once: true });
        video.addEventListener('playing', markReady, { once: true });
        video.addEventListener('error', function () {
            showError('This video could not be played. Please check the file or try another video.', src);
        }, { once: true });

        video.src = src;
        return video;
    }

    function buildFrame(src) {
        var frame = document.createElement('iframe');
        frame.title = 'Video player';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        frame.setAttribute('allowfullscreen', '');
        frame.addEventListener('load', markReady, { once: true });
        frame.src = src;
        return frame;
    }

    function buildImage(src, title) {
        var img = document.createElement('img');
        img.className = 'mmvp-image';
        img.alt = title || 'Work preview';
        img.addEventListener('load', markReady, { once: true });
        img.addEventListener('error', function () {
            showError('This preview image could not be loaded.', src);
        }, { once: true });
        img.src = src;
        return img;
    }

    function stopPlayback() {
        clearTimers();
        var videos = player.querySelectorAll('video');
        Array.prototype.forEach.call(videos, function (video) {
            try {
                video.pause();
            } catch (err) {}
            video.removeAttribute('src');
            try {
                video.load();
            } catch (err) {}
        });
        var frames = player.querySelectorAll('iframe');
        Array.prototype.forEach.call(frames, function (frame) {
            frame.removeAttribute('src');
        });
        player.innerHTML = '';
    }

    function openCard(card) {
        if (!card) return;

        activeCard = card;
        lastFocused = document.activeElement;

        var vertical = card.getAttribute('data-mm-vertical') === '1';
        var kind = card.getAttribute('data-mm-kind') || 'video';
        var src = card.getAttribute('data-mm-src') || '';
        var embed = card.getAttribute('data-mm-embed') || '';
        var type = (card.getAttribute('data-mm-type') || '').toLowerCase();
        var poster = card.getAttribute('data-mm-poster') || '';
        var title = card.getAttribute('data-mm-title') || 'Video preview';

        modal.classList.toggle('is-vertical', vertical);
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('mmvp-locked');

        statusEl.textContent = 'Opening ' + title;
        hideError();
        setLoading(true);
        stopPlayback();

        var media;
        var isFrame = false;

        if (kind === 'image') {
            media = buildImage(src || poster, title);
        } else if (embed && (type === 'iframe' || youtubeId(embed) || vimeoId(embed) || isFacebook(embed))) {
            media = buildFrame(embedUrl(embed));
            isFrame = true;
        } else if (youtubeId(src) || vimeoId(src) || isFacebook(src)) {
            media = buildFrame(embedUrl(src));
            isFrame = true;
        } else if (src) {
            media = buildVideo(src, poster, title);
        } else if (embed) {
            media = buildFrame(embedUrl(embed));
            isFrame = true;
        } else {
            showError('No playable media is attached to this card yet.', '');
            return;
        }

        player.appendChild(media);

        if (media.tagName === 'VIDEO') {
            // Autoplay may be blocked; native controls keep the player usable.
            var playAttempt = media.play();
            if (playAttempt && typeof playAttempt.catch === 'function') {
                playAttempt.catch(function () {});
            }
        }

        // Never leave the loading veil on screen if a provider stays silent.
        fallbackTimer = window.setTimeout(function () {
            if (modal.hidden) return;
            markReady();
        }, isFrame ? 4500 : 8000);

        statusEl.textContent = 'Playing ' + title;

        window.requestAnimationFrame(function () {
            if (closeBtn) closeBtn.focus();
        });
    }

    function closeModal() {
        if (modal.hidden) return;

        stopPlayback();
        hideError();
        setLoading(false);

        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-vertical');
        document.body.classList.remove('mmvp-locked');

        statusEl.textContent = 'Video preview closed';
        activeCard = null;

        if (lastFocused && typeof lastFocused.focus === 'function') {
            try {
                lastFocused.focus({ preventScroll: true });
            } catch (err) {
                lastFocused.focus();
            }
        }
        lastFocused = null;
    }

    document.addEventListener('click', function (event) {
        var closeTarget = event.target.closest ? event.target.closest('[data-mm-close]') : null;
        if (closeTarget) {
            event.preventDefault();
            closeModal();
            return;
        }

        var card = event.target.closest ? event.target.closest('.pf-card') : null;
        if (!card || !card.hasAttribute('data-mm-media')) return;

        // Keep normal browser link behaviour for new-tab / download gestures.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

        event.preventDefault();
        openCard(card);
    });

    modal.addEventListener('click', function (event) {
        // Clicking the dark backdrop (outside the dialog) closes the preview.
        if (event.target === modal) closeModal();
    });

    if (retryBtn) {
        retryBtn.addEventListener('click', function () {
            if (activeCard) openCard(activeCard);
        });
    }

    document.addEventListener('keydown', function (event) {
        if (modal.hidden) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
            return;
        }

        if (event.key === 'Tab') {
            var focusables = Array.prototype.filter.call(
                modal.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'),
                function (el) {
                    return !el.hidden && el.offsetParent !== null;
                }
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
        }
    });
})();
