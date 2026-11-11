(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    };
    function ytId(u) {
        var m = String(u || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
        return m ? m[1] : null;
    }
    function vimeoId(u) {
        var m = String(u || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
        return m ? m[1] : null;
    }
    function isFb(u) {
        return /facebook\.com|fb\.watch|fb\.me/i.test(String(u || ''));
    }

    function posterFallback(titleText, categoryText, index) {
        var colors = [['#082b69','#1669e8'],['#071f54','#518eff'],['#073d83','#08a4d5'],['#111b56','#5968ff'],['#073653','#08a4b9'],['#1b2863','#687bff']];
        var pair = colors[(index || 0) % colors.length];
        var title = esc(titleText || 'Studio video preview').slice(0, 48);
        var category = esc(categoryText || 'MEXA MOTION').slice(0, 26);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + pair[0] + '"/><stop offset="1" stop-color="' + pair[1] + '"/></linearGradient></defs><rect width="800" height="450" fill="url(%23g)"/><circle cx="660" cy="90" r="180" fill="white" opacity=".07"/><circle cx="100" cy="420" r="210" fill="white" opacity=".06"/><text x="52" y="310" fill="#9fc8ff" font-family="Arial,sans-serif" font-size="20" font-weight="700" letter-spacing="4">' + category + '</text><text x="52" y="365" fill="white" font-family="Arial,sans-serif" font-size="31" font-weight="700">' + title + '</text><circle cx="400" cy="178" r="35" fill="white" opacity=".93"/><path d="M393 160v36l30-18z" fill="' + pair[0] + '"/></svg>';
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg).replace(/'/g, '%27');
    }

    var modal = $('wk-modal');
    var player = $('wk-modal-player');

    function openItem(item, fallbackUrl) {
        if (!item || !modal || !player) return;
        var url = item.url || '';
        var poster = item.thumbnail_url || '';
        var html = '';
        if (item.embed_type === 'iframe' && item.embed_url) {
            html = '<iframe src="' + esc(item.embed_url) + '" title="' + esc(item.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
        } else if (item.embed_type === 'link') {
            html = '<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">Open video on ' + esc(item.embed_provider || 'the video host') + '</a>';
        } else if (isFb(url)) {
            html = '<iframe title="' + esc(item.title || 'Video') + '" src="https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url) + '&show_text=false&autoplay=true" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
        } else if (ytId(url)) {
            html = '<iframe title="' + esc(item.title || 'Video') + '" src="https://www.youtube.com/embed/' + ytId(url) + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
        } else if (vimeoId(url)) {
            html = '<iframe title="' + esc(item.title || 'Video') + '" src="https://player.vimeo.com/video/' + vimeoId(url) + '?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe>';
        } else {
            html = '<video src="' + esc(url || fallbackUrl) + '" poster="' + esc(poster) + '" controls autoplay playsinline preload="metadata"></video>';
        }
        player.innerHTML = html;
        var tEl = $('wk-modal-title'), dEl = $('wk-modal-desc');
        if (tEl) tEl.textContent = item.title || '';
        if (dEl) dEl.textContent = item.description || '';
        modal.hidden = false;
        if (typeof window.__mmSetScrollLocked === 'function') window.__mmSetScrollLocked(true);
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        if (player) player.innerHTML = '';
        if (typeof window.__mmSetScrollLocked === 'function') window.__mmSetScrollLocked(false);
    }

    function applyFallbackPoster(image) {
        if (!image || image.dataset.fallbackApplied) return;
        image.dataset.fallbackApplied = '1';
        image.dataset.fallbackHandled = '1';
        var cardEl = image.closest ? image.closest('.wk-rc, .wk-demo, .wk-short') : null;
        var idx = cardEl ? Number(cardEl.getAttribute('data-index') || 0) : 0;
        var title = cardEl ? (cardEl.getAttribute('data-mm-video-title') || (cardEl.querySelector('b') && cardEl.querySelector('b').textContent) || '') : '';
        var cat = cardEl && cardEl.querySelector('small') ? cardEl.querySelector('small').textContent : 'MEXA MOTION';
        image.src = posterFallback(title, cat, idx);
    }

    document.addEventListener('error', function (e) {
        var image = e.target;
        if (image && image.tagName === 'IMG' && image.dataset && image.dataset.wkCardImg) {
            applyFallbackPoster(image);
        }
    }, true);

    var wkImgs = document.querySelectorAll('img[data-wk-card-img]');
    for (var i = 0; i < wkImgs.length; i++) {
        if (wkImgs[i].complete && wkImgs[i].naturalWidth === 0) applyFallbackPoster(wkImgs[i]);
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-wk-close]')) {
            closeModal();
            return;
        }
        var cardEl = e.target.closest('.wk-rc, .wk-demo, .wk-short');
        if (!cardEl || !cardEl.getAttribute('data-mm-video-url')) return;
        var description = cardEl.querySelector('.info p');
        openItem({
            url: cardEl.getAttribute('data-mm-video-url'),
            embed_type: cardEl.getAttribute('data-mm-video-type') || '',
            embed_url: cardEl.getAttribute('data-mm-video-embed-url') || '',
            embed_provider: cardEl.getAttribute('data-mm-video-provider') || '',
            thumbnail_url: cardEl.getAttribute('data-mm-video-poster') || '',
            title: cardEl.getAttribute('data-mm-video-title') || '',
            description: description ? description.textContent : ''
        }, cardEl.getAttribute('data-preview-src') || '');
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
    });
})();
