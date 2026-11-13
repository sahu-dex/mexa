(function () {
    'use strict';

    // One set of listeners, even if the script is ever included twice.
    if (window.__mmServicePage) return;
    window.__mmServicePage = true;

    var SNAP = window.__MM_DEMO_DATA__ || {};
    var S = window.MMStore;

    function el(id) { return document.getElementById(id); }
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function youtubeId(url) {
        var m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
        return m ? m[1] : null;
    }

    var content = {};
    S.catalog.ensure(SNAP);

    function renderHero() {
        var tag = el('sv2-tagline');
        if (tag && content.services_tagline) tag.textContent = content.services_tagline;
        var desc = el('sv2-hero-desc');
        if (desc && content.services_intro) desc.textContent = content.services_intro;
        var mount = el('sv2-hero-video');
        if (!mount) return;
        if (content.show_overview === '0') { mount.hidden = true; return; }
        var url = content.overview_video_url || '';
        var yt = youtubeId(url);
        var poster = content.overview_poster_url || (yt ? 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg' : '');
        if (!url) {
            if (poster) {
                mount.innerHTML = '<img src="' + esc(poster) + '" alt="Services overview" loading="lazy" decoding="async">';
            } else {
                mount.hidden = true;
            }
            return;
        }
        mount.innerHTML =
            (poster ? '<img src="' + esc(poster) + '" alt="Our services showreel" loading="lazy" decoding="async">' : '') +
            '<span class="sv2-veil"></span>' +
            '<button type="button" class="sv2-video-btn" data-sv2-video="' + esc(url) + '" data-mm-video-url="' + esc(url) + '" data-mm-video-type="' + esc(content.overview_video_embed_type || '') + '" data-mm-video-embed-url="' + esc(content.overview_video_embed_url || '') + '" data-mm-video-provider="' + esc(content.overview_video_provider || '') + '" data-mm-video-poster="' + esc(poster) + '" aria-label="Play our services showreel">' +
            '<span class="sv2-play"><i class="fa-solid fa-play"></i></span></button>';
    }

    function mediaMarkup(svc) {
        var media = svc.media || {};
        var type = media.type || 'none';
        var imgsrc = media.imageUrl || media.thumbnail || '';
        if (type === 'image' && media.imageUrl) {
            return '<div class="sv2-media">' +
                '<button type="button" data-sv2-image="' + esc(media.imageUrl) + '" data-sv2-alt="' + esc(svc.name) + '" aria-label="Preview ' + esc(svc.name) + ' image">' +
                '<img src="' + esc(media.imageUrl) + '" alt="' + esc(svc.name) + '" loading="lazy" decoding="async">' +
                '<span class="sv2-zoom"><i class="fa-solid fa-image"></i> View image</span>' +
                '</button></div>';
        }
        if (type === 'video' && media.videoUrl) {
            var yt = youtubeId(media.videoUrl);
            var poster = media.thumbnail || (yt ? 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg' : '');
            return '<div class="sv2-media">' +
                '<button type="button" data-sv2-video="' + esc(media.videoUrl) + '" data-mm-video-url="' + esc(media.videoUrl) + '" data-mm-video-type="' + esc(media.embedType || '') + '" data-mm-video-embed-url="' + esc(media.embedUrl || '') + '" data-mm-video-provider="' + esc(media.provider || '') + '" data-mm-video-poster="' + esc(poster) + '" data-mm-video-title="' + esc(svc.name) + ' demo" aria-label="Play ' + esc(svc.name) + ' demo">' +
                (poster ? '<img src="' + esc(poster) + '" alt="' + esc(svc.name) + ' demo thumbnail" loading="lazy" decoding="async">' : '') +
                '<span class="sv2-veil"></span>' +
                '<span class="sv2-play"><i class="fa-solid fa-play"></i></span>' +
                '</button></div>';
        }
        if (imgsrc) {
            return '<div class="sv2-media"><button type="button" data-sv2-image="' + esc(imgsrc) + '" data-sv2-alt="' + esc(svc.name) + '">' +
                '<img src="' + esc(imgsrc) + '" alt="' + esc(svc.name) + '" loading="lazy" decoding="async">' +
                '<span class="sv2-zoom"><i class="fa-solid fa-image"></i> View image</span></button></div>';
        }
        return '<div class="sv2-media"><div class="sv2-media-empty"><span><i class="fa-solid fa-clapperboard"></i>' +
            'Media coming soon</span></div></div>';
    }

    function serviceCard(svc) {
        var feats = (svc.features || []).map(function (f) {
            return '<li><i class="fa-solid fa-check"></i><span>' + esc(f) + '</span></li>';
        }).join('');
        return '<article class="sv2-card" id="svc-' + esc(svc.id) + '">' +
            '<span class="sv2-label"><i class="fa-solid fa-layer-group"></i>' + esc(svc.label) + '</span>' +
            '<h2 class="sv2-title">' + esc(svc.name) + '</h2>' +
            (svc.subtitle ? '<p class="sv2-sub">' + esc(svc.subtitle) + '</p>' : '') +
            mediaMarkup(svc) +
            '<div class="sv2-grow">' +
            (svc.description ? '<p class="sv2-body">' + esc(svc.description).replace(/\n/g, '<br>') + '</p>' : '') +
            (feats ? '<ul class="sv2-feats">' + feats + '</ul>' : '') +
            (svc.deliverables ? '<p class="sv2-deliv"><b>Deliverables</b>' +
                esc(String(svc.deliverables).replace(/\n/g, ' · ')) + '</p>' : '') +
            '</div></article>';
    }

    function renderServices() {
        var grid = el('sv2-services');
        if (!grid) return;
        if (content.show_services === '0') {
            var sec = el('services');
            if (sec) sec.hidden = true;
            return;
        }
        var list = S.catalog.services();
        grid.innerHTML = list.length ? list.map(serviceCard).join('')
            : '<p class="sp-empty">No services are published right now. Please check back soon.</p>';
    }

    // Videos and image previews open in the shared site player
    // (assets/js/mm-video-player.js): one frame and one Close button everywhere.
    document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest || !window.MMPlayer) return;

        var vid = e.target.closest('[data-sv2-video]');
        if (vid) {
            e.preventDefault();
            window.MMPlayer.open({
                src: vid.getAttribute('data-sv2-video') || '',
                poster: vid.getAttribute('data-mm-video-poster') || '',
                title: vid.getAttribute('data-mm-video-title') || vid.getAttribute('aria-label') || 'Service video',
                trigger: vid
            });
            return;
        }

        var img = e.target.closest('[data-sv2-image]');
        if (img) {
            e.preventDefault();
            window.MMPlayer.open({
                kind: 'image',
                src: img.getAttribute('data-sv2-image') || '',
                title: img.getAttribute('data-sv2-alt') || 'Service image',
                trigger: img
            });
        }
    });

    function boot() {
        content = (window.__MM_DEMO_DATA__ || {}).content || {};
        renderHero();
        renderServices();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
