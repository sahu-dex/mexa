(function () {
    'use strict';
    var SNAP = window.__MM_DEMO_DATA__ || {};
    var workData = SNAP.work || {};
    var state = {
        items: workData.items || [],
        demos: workData.demos || [],
        shorts: workData.shorts || [],
        recent: workData.recent || [],
        previewVideos: (workData.videos || SNAP.videos || []).map(function (v) {
            return Object.assign({}, v, { url: v.url || v.video_url || v.file_path || '' });
        }),
        videoCategories: workData.categories || []
    };

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
    function vimeoId(u) { var m = String(u || '').match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? m[1] : null; }
    function isFb(u) { return /facebook\.com|fb\.watch|fb\.me/i.test(String(u || '')); }
    function thumbOf(item) {
        if (item.thumbnail_url || item.thumbnail_path) return item.thumbnail_url || item.thumbnail_path;
        var id = ytId(item.url || item.file_path);
        return id ? 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg' : '';
    }
    function posterFallback(item, index) {
        var colors = [['082b69','1669e8'],['071f54','518eff'],['073d83','08a4d5'],['111b56','5968ff'],['073653','08a4b9'],['1b2863','687bff']];
        var h = String.fromCharCode(35);
        var pair = colors[index % colors.length];
        var c0 = h + pair[0], c1 = h + pair[1];
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + c0 + '"/><stop offset="1" stop-color="' + c1 + '"/></linearGradient></defs><rect width="800" height="450" fill="url(%23g)"/><circle cx="660" cy="90" r="180" fill="white" opacity=".07"/><circle cx="100" cy="420" r="210" fill="white" opacity=".06"/><circle cx="400" cy="178" r="35" fill="white" opacity=".93"/><path d="M393 160v36l30-18z" fill="' + c0 + '"/></svg>';
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg).replace(/'/g, '%27');
    }
    function posterMarkup(item, index, alt) {
        var src = thumbOf(item) || posterFallback(item, index);
        var fallback = posterFallback(item, index);
        return '<img src="' + esc(src) + '" data-fallback="' + esc(fallback) + '" alt="' + esc(alt || ((item && item.title) || 'Video preview')) + '" loading="lazy" decoding="async">';
    }
    function ordered(list) {
        return (list || []).slice().sort(function (a, b) {
            return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
        });
    }
    function getRecentSix() {
        var list = ordered(state.recent.filter(function (i) { return i.status !== 'draft'; }));
        if (list.length >= 6) return list.slice(0, 6);
        var out = list.slice();
        state.previewVideos.forEach(function (v) {
            if (out.length >= 6) return;
            if (!out.some(function (x) { return String(x.id) === String(v.id); })) out.push(v);
        });
        return out.slice(0, 6);
    }
    function previewUrl(item, index, offset) {
        var u = item && (item.url || item.file_path);
        if (item && item.kind !== 'image' && u) return '';
        var pool = state.previewVideos;
        if (!pool.length) return '';
        return pool[(index + (offset || 0)) % pool.length].url || '';
    }
    function card(item, index, section, vertical, fallback) {
        var thumb = thumbOf(item);
        var title = esc(item.title || 'Video preview');
        var rawUrl = item.url || item.file_path || '';
        var videoUrl = item.kind === 'image' ? (fallback || '') : (rawUrl || item.video_url || fallback || '');
        // Image cards with a playable fallback open as video; without one they
        // open as a still preview — exactly like before the shared player.
        var playerKind = item.kind === 'image' && !videoUrl ? 'image' : 'video';
        var playerAttrs = videoUrl ? ' data-mm-video-url="' + esc(videoUrl) + '" data-mm-kind="' + esc(playerKind) + '" data-mm-video-type="' + esc(item.embed_type || '') + '" data-mm-video-embed-url="' + esc(item.embed_url || '') + '" data-mm-video-provider="' + esc(item.embed_provider || item.platform || '') + '" data-mm-video-poster="' + esc(thumb) + '" data-mm-video-title="' + title + '"' : '';
        if (section === 'recent') {
            return '<button type="button" class="wk-rc" data-section="recent" data-index="' + index + '" data-preview-src="' + esc(fallback || '') + '"' + playerAttrs + ' aria-label="Play ' + title + '">' +
                '<span class="th">' + posterMarkup(item, index, (item.title || 'Video') + ' thumbnail') + '<span class="wk-rc-play"><i class="fa-solid fa-play"></i></span></span>' +
                '</button>';
        }
        if (section === 'demo') {
            return '<button type="button" class="wk-demo" data-section="demo" data-index="' + index + '" data-preview-src="' + esc(fallback || '') + '"' + playerAttrs + ' aria-label="Play ' + title + '">' +
                '<span class="shot">' + posterMarkup(item, index, (item.title || 'Video') + ' thumbnail') + '</span>' +
                '<span class="ply"><i class="fa-solid fa-play"></i></span></button>';
        }
        return '<button type="button" class="wk-short" data-section="short" data-index="' + index + '" data-mm-vertical="1" data-preview-src="' + esc(fallback || '') + '"' + playerAttrs + ' aria-label="Play ' + title + '">' +
            posterMarkup(item, index, (item.title || 'Short') + ' thumbnail') +
            '<i class="wk-short-play fa-solid fa-play" aria-hidden="true"></i></button>';
    }
    function renderRecent() {
        var box = $('wk-recent-grid');
        var list = getRecentSix();
        if (!box) return;
        box.innerHTML = list.length ? list.map(function (item, i) {
            return card(item, i, 'recent', false, previewUrl(item, i, 0));
        }).join('') : '<div class="wk-empty"><b>Video previews are unavailable right now.</b></div>';
    }
    function renderProjects() {
        var box = $('wk-demo-grid');
        if (!box) return;
        var entries = ordered(state.demos);
        box.innerHTML = entries.length ? entries.map(function (item, i) {
            return card(item, i, 'demo', false, previewUrl(item, i, 1));
        }).join('') : '<div class="wk-empty"><b>No videos have been published yet.</b></div>';
    }
    function renderShorts() {
        var box = $('wk-shorts-grid');
        if (!box) return;
        var list = ordered(state.shorts);
        box.innerHTML = list.length ? list.map(function (item, i) {
            return card(item, i, 'short', true, previewUrl(item, i, 3));
        }).join('') : '<div class="wk-empty"><b>No Shorts have been published yet.</b></div>';
    }

    function boot() {
        renderRecent();
        renderProjects();
        renderShorts();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
