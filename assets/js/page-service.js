(function () {
    'use strict';

    var SNAP = window.__MM_DEMO_DATA__ || {};
    var S = window.MMStore;
    var money = S.money;

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
    function vimeoId(url) {
        var m = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/i);
        return m ? m[1] : null;
    }
    function playerMarkup(url) {
        var yt = youtubeId(url), vm = vimeoId(url);
        if (yt) return '<iframe src="https://www.youtube.com/embed/' + yt + '?rel=0&autoplay=1" title="Service video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
        if (vm) return '<iframe src="https://player.vimeo.com/video/' + vm + '?autoplay=1" title="Service video" allow="autoplay; fullscreen" allowfullscreen></iframe>';
        return '<video src="' + esc(url) + '" controls autoplay playsinline preload="metadata"></video>';
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

    function packageCard(p, serviceName) {
        var feats = (p.features || []).map(function (f) {
            return '<li><i class="fa-solid fa-check"></i><span>' + esc(f) + '</span></li>';
        }).join('');
        // The legacy "Best Value" badge was retired from the package cards.
        var badgeLabel = String(p.badge || '').trim();
        if (badgeLabel.toLowerCase() === 'best value') badgeLabel = '';
        return '<article class="sp-pkg sv-pkg' + (p.highlight ? ' is-hi' : '') + '" data-quality="' + esc(p.quality) + '">' +
            (badgeLabel ? '<span class="sv-pkg-badge">' + esc(badgeLabel) + '</span>' : '') +
            '<h3>' + esc(p.name) + '</h3>' +
            (p.description ? '<p class="sp-pkg-desc">' + esc(p.description) + '</p>' : '') +
            '<div class="sv-pkg-price"><b>' + esc(money(p.price, p.currency)) + '</b><span>/ project</span></div>' +
            '<div class="sv-pkg-meta">' +
            (p.delivery ? '<span><i class="fa-regular fa-clock"></i>' + esc(p.delivery) + '</span>' : '') +
            (p.revisions ? '<span><i class="fa-solid fa-rotate"></i>' + esc(p.revisions) + '</span>' : '') +
            '</div>' +
            '<ul class="sv-feats">' + feats + '</ul>' +
            '<button type="button" class="sv-btn sv-btn-primary sp-buy" data-buy-service="' + esc(p.serviceId) +
            '" data-buy-quality="' + esc(p.quality) + '" aria-label="Buy ' + esc(serviceName + ' — ' + p.name) + '">' +
            'Buy This Package <i class="fa-solid fa-arrow-right text-xs"></i></button>' +
            '</article>';
    }

    function renderPackages(serviceId) {
        var wrap = el('sv-pkg-cards');
        if (!wrap) return;
        var svc = S.catalog.service(serviceId);
        if (!svc) { wrap.innerHTML = ''; return; }
        var pkgs = S.catalog.packagesFor(svc.id);
        wrap.innerHTML = pkgs.map(function (p) { return packageCard(p, svc.name); }).join('');
        var picker = el('sv-svc-pick');
        if (picker && String(picker.value) !== String(svc.id)) picker.value = String(svc.id);
        var note = el('sv2-pkg-service');
        if (note) note.textContent = svc.name;
    }

    function renderPackageSection() {
        if (content.show_packages === '0') {
            var sec = el('packages');
            if (sec) sec.hidden = true;
            return;
        }
        var picker = el('sv-svc-pick');
        if (picker) {
            picker.innerHTML = S.catalog.services().map(function (s) {
                return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
            }).join('');
        }
        var first = S.catalog.services()[0];
        renderPackages(first ? first.id : null);
    }

    var locked = false;
    function lock(on) {
        document.body.classList.toggle('sv2-locked', !!on);
        locked = !!on;
    }
    function openVideo(url) {
        var m = el('sv2-video');
        if (!m) return;
        el('sv2-video-stage').innerHTML = playerMarkup(url);
        m.hidden = false; lock(true);
        var x = m.querySelector('.sv2-modal-x'); if (x) x.focus({ preventScroll: true });
    }
    function openImage(url, alt) {
        var m = el('sv2-image');
        if (!m) return;
        var img = el('sv2-image-img');
        img.src = url; img.alt = alt || 'Service image';
        m.hidden = false; lock(true);
        var x = m.querySelector('.sv2-modal-x'); if (x) x.focus({ preventScroll: true });
    }
    function closeModals() {
        var v = el('sv2-video'), i = el('sv2-image');
        if (v && !v.hidden) { v.hidden = true; el('sv2-video-stage').innerHTML = ''; }
        if (i && !i.hidden) { i.hidden = true; el('sv2-image-img').removeAttribute('src'); }
        if (!locked) return;
        lock(false);
    }

    document.addEventListener('click', function (e) {
        var vid = e.target.closest('[data-sv2-video]');
        if (vid) { e.preventDefault(); openVideo(vid.getAttribute('data-sv2-video')); return; }

        var img = e.target.closest('[data-sv2-image]');
        if (img) {
            e.preventDefault();
            openImage(img.getAttribute('data-sv2-image'), img.getAttribute('data-sv2-alt'));
            return;
        }

        if (e.target.closest('[data-sv2-close]')) { closeModals(); return; }
        if (e.target.classList && e.target.classList.contains('sv2-modal')) { closeModals(); return; }

        var buy = e.target.closest('[data-buy-service]');
        if (buy) {
            e.preventDefault();
            var sid = buy.getAttribute('data-buy-service');
            var q = buy.getAttribute('data-buy-quality') || 'high';
            window.location.href = 'book.php?service=' + encodeURIComponent(sid) + '&quality=' + encodeURIComponent(q);
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModals();
    });

    document.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'sv-svc-pick') {
            renderPackages(e.target.value);
        }
    });

    function boot() {
        content = (window.__MM_DEMO_DATA__ || {}).content || {};
        renderHero();
        renderServices();
        renderPackageSection();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
