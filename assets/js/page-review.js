(function () {
    'use strict';
    function el(id) { return document.getElementById(id); }
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    function stars(n) {
        var out = '';
        for (var i = 1; i <= 5; i++) out += '<i class="fa-solid fa-star' + (i > n ? ' off' : '') + '"></i>';
        return out;
    }
    function initials(name) {
        return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) {
            return w.charAt(0).toUpperCase();
        }).join('');
    }

    var RVPAGE = 20;
    var SNAP = window.__MM_DEMO_DATA__ || {};
    var rvData = SNAP.reviews || {};

    var rvState = {
        items: (rvData.items || []).slice(),
        stats: rvData.stats || null,
        shown: 0,
        total: 0,
        loading: false,
        rating: 0,
        photoFile: null,
        photoPreview: '',
        photoError: ''
    };

    function rvTrimSkeletons() {
        document.querySelectorAll('.rvx-skel').forEach(function (n) { n.remove(); });
    }

    function rvCardHTML(r, isNew) {
        var photoSrc = r.file_path || r.photo_url || '';
        var photo = photoSrc
            ? '<span class="rvx-avatar"><img src="' + esc(photoSrc) + '" alt="' + esc(r.name || 'Client') + '" loading="lazy"></span>'
            : '<span class="rvx-avatar" aria-hidden="true">' + esc(initials(r.name)) + '</span>';
        return '<article class="rvx-card' + (isNew ? ' is-new' : '') + '">' +
            '<div class="rvx-card-top">' + photo +
                '<div class="rvx-card-id"><b>' + esc(r.name) + '</b>' +
                    (r.role ? '<small>' + esc(r.role) + '</small>' : '') + '</div>' +
                '<span class="rvx-stars" aria-label="' + Number(r.rating || 0) + ' out of 5">' + stars(r.rating) + '</span>' +
            '</div>' +
            '<p class="rvx-card-text">' + esc(r.body) + '</p>' +
            '</article>';
    }

    function rvPaintSummary(items, stats) {
        var total = Number((stats && stats.count) || items.length) || 0;
        var sum = items.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0);
        var five = items.filter(function (r) { return Number(r.rating) === 5; }).length;
        var avg = stats && stats.average ? Number(stats.average) : (items.length ? sum / items.length : 0);
        if (stats && typeof stats.five !== 'undefined') five = Number(stats.five) || five;

        if (el('rvx-avg')) el('rvx-avg').textContent = avg ? avg.toFixed(1) : '—';
        if (el('rvx-hero-stars')) el('rvx-hero-stars').innerHTML = stars(Math.round(avg));
        if (el('rvx-five')) el('rvx-five').textContent = five;
        if (el('rvx-count')) el('rvx-count').textContent = total + ' review' + (total === 1 ? '' : 's');
        if (el('rvx-count-hero')) el('rvx-count-hero').textContent = total;
        if (el('rvx-meta')) el('rvx-meta').textContent = 'Based on ' + total + ' verified review' + (total === 1 ? '' : 's');
    }

    function rvRender(items, append) {
        var grid = el('rvx-grid');
        if (!grid) return;
        rvTrimSkeletons();
        if (!append) { grid.innerHTML = ''; rvState.shown = 0; }
        if (!items.length) {
            if (!append) grid.innerHTML = '<div class="rvx-empty">No reviews published yet — be the first to write one.</div>';
            return;
        }
        grid.insertAdjacentHTML('beforeend', items.map(function (r) {
            return rvCardHTML(r, append);
        }).join(''));
        rvState.shown += items.length;
    }

    function rvUpdateMore() {
        var wrap = el('rvx-more-wrap');
        var btn = el('rvx-more');
        if (!wrap || !btn) return;
        var left = Math.max(0, rvState.total - rvState.shown);
        if (left <= 0) {
            wrap.hidden = true;
        } else {
            wrap.hidden = false;
            btn.disabled = false;
            btn.innerHTML = 'See more reviews <i class="fa-solid fa-chevron-down"></i>';
            if (el('rvx-more-note')) el('rvx-more-note').textContent = rvState.shown + ' of ' + rvState.total + ' shown · ' + left + ' more';
        }
    }

    function rvLoadMore() {
        if (rvState.loading) return;
        var left = rvState.total - rvState.shown;
        if (left <= 0) return;
        var chunk = rvState.items.slice(rvState.shown, rvState.shown + RVPAGE);
        rvRender(chunk, true);
        rvUpdateMore();
    }

    function rvBoot() {
        rvState.total = rvState.items.length;
        rvRender(rvState.items.slice(0, RVPAGE), false);
        rvPaintSummary(rvState.items, rvState.stats);
        rvUpdateMore();
    }

    if (el('rvx-more')) el('rvx-more').addEventListener('click', rvLoadMore);

    var RATE_LABELS = { 0: 'Choose a rating', 1: '1 star', 2: '2 stars', 3: '3 stars', 4: '4 stars', 5: '5 stars' };
    function rvPaintStars(n) {
        n = Math.max(0, Math.min(5, Number(n) || 0));
        rvState.rating = n;
        var rateEl = el('rvx-rate');
        if (!rateEl) return;
        rateEl.querySelectorAll('button').forEach(function (b) {
            var value = Number(b.getAttribute('data-star'));
            b.classList.toggle('on', value <= n);
            b.setAttribute('aria-checked', value === n ? 'true' : 'false');
            b.tabIndex = (value === n || (n === 0 && value === 1)) ? 0 : -1;
        });
        if (el('rvx-rate-label')) el('rvx-rate-label').textContent = RATE_LABELS[n];
    }

    if (el('rvx-rate')) {
        el('rvx-rate').addEventListener('click', function (e) {
            var b = e.target.closest('[data-star]');
            if (b) rvPaintStars(Number(b.getAttribute('data-star')));
        });
        el('rvx-rate').addEventListener('keydown', function (e) {
            var next = rvState.rating || 1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, next + 1);
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, next - 1);
            else if (e.key === 'Home') next = 1;
            else if (e.key === 'End') next = 5;
            else return;
            e.preventDefault();
            rvPaintStars(next);
            el('rvx-rate').querySelector('[data-star="' + next + '"]').focus();
        });
        rvPaintStars(0);
    }

    if (el('rvx-body')) {
        el('rvx-body').addEventListener('input', function () {
            if (el('rvx-body-count')) el('rvx-body-count').textContent = this.value.length + ' / 900';
        });
    }

    var photoInput = el('rvx-photo');
    function rvPhotoResetUI() {
        if (el('rvx-photo-prev')) el('rvx-photo-prev').innerHTML = '<i class="fa-solid fa-user"></i>';
        if (el('rvx-photo-pick')) {
            el('rvx-photo-pick').hidden = false;
            el('rvx-photo-pick').innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> Upload photo';
        }
        if (el('rvx-photo-change')) el('rvx-photo-change').hidden = true;
        if (el('rvx-photo-remove')) el('rvx-photo-remove').hidden = true;
    }
    function rvPhotoShow(dataUrl) {
        if (el('rvx-photo-prev')) el('rvx-photo-prev').innerHTML = '<img src="' + dataUrl + '" alt="Your photo preview" loading="lazy" decoding="async">';
        if (el('rvx-photo-pick')) el('rvx-photo-pick').hidden = true;
        if (el('rvx-photo-change')) el('rvx-photo-change').hidden = false;
        if (el('rvx-photo-remove')) el('rvx-photo-remove').hidden = false;
    }

    if (photoInput) {
        if (el('rvx-photo-pick')) el('rvx-photo-pick').addEventListener('click', function () { photoInput.click(); });
        if (el('rvx-photo-change')) el('rvx-photo-change').addEventListener('click', function () { photoInput.click(); });
        if (el('rvx-photo-remove')) el('rvx-photo-remove').addEventListener('click', function () {
            rvState.photoFile = null;
            rvState.photoPreview = '';
            rvState.photoError = '';
            photoInput.value = '';
            rvPhotoResetUI();
            if (el('rvx-err')) el('rvx-err').hidden = true;
        });
        photoInput.addEventListener('change', function (e) {
            var f = e.target.files && e.target.files[0];
            var err = el('rvx-err');
            rvState.photoFile = null;
            rvState.photoPreview = '';
            rvState.photoError = '';
            if (!f) { rvPhotoResetUI(); return; }
            var allowed = ['image/jpeg', 'image/png', 'image/webp'];
            var ext = String(f.name || '').split('.').pop().toLowerCase();
            var validMime = allowed.indexOf(f.type) !== -1 || (!f.type && ['jpg', 'jpeg', 'png', 'webp'].indexOf(ext) !== -1);
            function fail(message) {
                rvState.photoError = message;
                e.target.value = '';
                rvPhotoResetUI();
                if (err) { err.textContent = message; err.hidden = false; }
            }
            if (!validMime) { fail('Please choose a JPG, PNG, or WebP image.'); return; }
            if (f.size > 5 * 1024 * 1024) { fail('The photo must be 5 MB or smaller.'); return; }
            if (err) err.hidden = true;
            rvState.photoFile = f;
            var reader = new FileReader();
            reader.onload = function () {
                rvState.photoPreview = reader.result;
                rvPhotoShow(reader.result);
            };
            reader.onerror = function () { fail('The photo could not be read. Please choose another file.'); };
            reader.readAsDataURL(f);
        });
    }

    if (el('rvx-form')) {
        el('rvx-form').addEventListener('submit', async function (e) {
            e.preventDefault();
            var form = el('rvx-form');
            var err = el('rvx-err'), btn = el('rvx-send');
            if (err) err.hidden = true;
            var nameVal = el('rvx-name').value.trim();
            var roleVal = el('rvx-role').value.trim();
            var bodyVal = el('rvx-body').value.trim();

            function showError(msg) {
                if (!err) return;
                err.textContent = msg;
                err.hidden = false;
                err.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
            if (!rvState.rating || rvState.rating < 1 || rvState.rating > 5) return showError('Please select a star rating from 1 to 5.');
            if (!nameVal) return showError('Please enter your name.');
            if (bodyVal.length < 15) return showError('Please write at least 15 characters so your review is useful to others.');

            var fd = new FormData();
            fd.append('name', nameVal);
            fd.append('role', roleVal);
            fd.append('rating', String(rvState.rating));
            fd.append('body', bodyVal);
            var csrf = form.querySelector('input[name="_csrf"]');
            var hp = form.querySelector('input[name="website_url"]');
            if (csrf) fd.append('_csrf', csrf.value);
            if (hp) fd.append('website_url', hp.value);
            if (rvState.photoFile) fd.append('photo', rvState.photoFile);

            btn.disabled = true;
            try {
                var resp = await fetch('api/submit-review.php', {
                    method: 'POST',
                    body: fd,
                    credentials: 'same-origin'
                });
                var data = await resp.json().catch(function () { return {}; });
                if (!resp.ok || !data.ok) {
                    btn.disabled = false;
                    return showError(data.error || 'Could not submit your review right now. Please try again.');
                }
                form.reset();
                rvState.photoFile = null;
                rvState.photoPreview = '';
                rvPhotoResetUI();
                rvPaintStars(0);
                if (el('rvx-body-count')) el('rvx-body-count').textContent = '0 / 900';
                btn.disabled = false;

                if (el('rvx-modal-name')) el('rvx-modal-name').textContent = nameVal.split(' ')[0] || 'there';
                if (el('rvx-modal')) {
                    el('rvx-modal').hidden = false;
                    document.body.style.overflow = 'hidden';
                    if (el('rvx-modal-done')) el('rvx-modal-done').focus();
                }
            } catch (ex) {
                btn.disabled = false;
                showError('Network error while sending your review. Please try again.');
            }
        });
    }

    function rvCloseModal() {
        if (el('rvx-modal')) el('rvx-modal').hidden = true;
        document.body.style.overflow = '';
    }
    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-rvx-close]')) rvCloseModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && el('rvx-modal') && !el('rvx-modal').hidden) rvCloseModal();
    });

    rvBoot();
})();
