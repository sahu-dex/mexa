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
    function digits(v) { return String(v || '').replace(/[^\d]/g, ''); }
    function params() {
        try { return new URLSearchParams(window.location.search); } catch (e) { return { get: function () { return null; } }; }
    }

    var qp = params();
    var state = {
        serviceId: qp.get('service') || '',
        quality: qp.get('quality') || 'high',
        message: ''
    };
    S.catalog.ensure(SNAP);
    var services = S.catalog.services();
    if (!state.serviceId || !S.catalog.service(state.serviceId)) {
        state.serviceId = services.length ? String(services[0].id) : '';
    }
    if (!/^(premium|high|normal)$/.test(state.quality)) state.quality = 'high';

    function currentService() { return S.catalog.service(state.serviceId); }
    function currentPackage() { return S.catalog.package(state.serviceId, state.quality); }

    function renderSum() {
        var svc = currentService(), pk = currentPackage();
        var box = el('tk-sum');
        if (!box || !svc || !pk) return;
        box.innerHTML =
            '<div class="tk-sum-top">' +
                '<div>' +
                    '<span class="tk-sum-kicker">Your selected package</span>' +
                    '<h2 class="tk-sum-name">' + esc(svc.name) + '</h2>' +
                    '<span class="tk-sum-quality"><i class="fa-solid fa-layer-group"></i>' + esc(pk.name) + '</span>' +
                '</div>' +
                '<div class="tk-sum-price"><b>' + esc(money(pk.price, pk.currency)) + '</b><span>per project</span></div>' +
            '</div>' +
            (pk.description ? '<p class="tk-sum-desc">' + esc(pk.description) + '</p>' : '') +
            '<ul class="tk-sum-feats">' + (pk.features || []).map(function (f) {
                return '<li><i class="fa-solid fa-check"></i><span>' + esc(f) + '</span></li>';
            }).join('') + '</ul>';
    }

    function renderForm() {
        var sel = el('tk-service');
        if (sel) {
            sel.innerHTML = services.map(function (s) {
                return '<option value="' + esc(s.id) + '"' + (String(s.id) === String(state.serviceId) ? ' selected' : '') + '>' + esc(s.name) + '</option>';
            }).join('');
        }
        renderQuality();
    }

    function renderQuality() {
        var grid = el('tk-quality');
        if (!grid) return;
        var pkgs = S.catalog.packagesFor(state.serviceId);
        grid.innerHTML = pkgs.map(function (p) {
            var on = p.quality === state.quality;
            return '<label class="tk-q' + (on ? ' is-on' : '') + '" data-quality="' + esc(p.quality) + '">' +
                '<input type="radio" name="tk-quality" value="' + esc(p.quality) + '"' + (on ? ' checked' : '') + '>' +
                '<b>' + esc(p.name) + '</b>' +
                '<small>' + esc(p.revisions || '') + (p.delivery ? ' · ' + esc(p.delivery) : '') + '</small>' +
                '<span class="tk-q-price">' + esc(money(p.price, p.currency)) + '</span>' +
                '</label>';
        }).join('');
    }

    function renderPreview() {
        var box = el('tk-prev-rows');
        var msgBox = el('tk-prev-msg');
        var svc = currentService(), pk = currentPackage();
        if (box) {
            box.innerHTML =
                '<div class="tk-prev-row"><span>Service</span><b>' + esc(svc ? svc.name : '—') + '</b></div>' +
                '<div class="tk-prev-row"><span>Package</span><b>' + esc(pk ? pk.name : '—') + '</b></div>' +
                '<div class="tk-prev-row"><span>Price</span><b>' + esc(pk ? money(pk.price, pk.currency) : '—') + '</b></div>' +
                '<div class="tk-prev-row"><span>Delivery</span><b>' + esc(pk && pk.delivery ? pk.delivery : '—') + '</b></div>';
        }
        if (msgBox) {
            var msg = String(state.message || '').trim();
            msgBox.textContent = msg || 'Your project message will appear here…';
            msgBox.classList.toggle('is-empty', !msg);
        }
    }

    function refreshAll() {
        renderSum();
        renderQuality();
        renderPreview();
    }

    function showError(text) {
        var box = el('tk-err');
        if (!box) return;
        if (!text) { box.hidden = true; box.textContent = ''; return; }
        box.hidden = false; box.textContent = text;
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function submit(e) {
        if (e) e.preventDefault();
        var svc = currentService(), pk = currentPackage();
        var msg = String(state.message || '').trim();
        var nameEl = el('tk-name'), emailEl = el('tk-email'), phoneEl = el('tk-phone');
        var clientName = nameEl ? nameEl.value.trim() : '';
        var clientEmail = emailEl ? emailEl.value.trim() : '';
        var clientPhone = phoneEl ? phoneEl.value.trim() : '';

        if (!svc || !pk) return showError('Please choose a service and a package.');
        if (!state.quality) return showError('Please choose a package quality.');
        if (emailEl && clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clientEmail)) {
            return showError('Please enter a valid email address.');
        }
        if (msg.length < 20) return showError('Please describe your project in at least 20 characters so we can quote it properly.');

        var form = el('tk-form');
        var csrf = form ? form.querySelector('input[name="_csrf"]') : null;
        var hp = form ? form.querySelector('input[name="website_url"]') : null;

        var btn = el('tk-submit');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending your ticket…'; }
        showError('');

        var fd = new FormData();
        fd.append('service_id', String(svc.id));
        fd.append('quality', String(pk.quality));
        fd.append('message', msg);
        if (clientName) fd.append('name', clientName);
        if (clientEmail) fd.append('email', clientEmail);
        if (clientPhone) fd.append('phone', clientPhone);
        if (csrf) fd.append('_csrf', csrf.value);
        if (hp) fd.append('website_url', hp.value);

        try {
            var resp = await fetch('api/submit-booking.php', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            });
            var data = await resp.json().catch(function () { return {}; });
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Ticket'; }
            if (!resp.ok || !data.ok) {
                return showError(data.error || 'Could not submit your ticket right now. Please try again.');
            }
            state.message = '';
            if (el('tk-message')) el('tk-message').value = '';
            if (el('tk-count')) el('tk-count').textContent = '0 / 4000';
            if (nameEl) nameEl.value = '';
            if (emailEl) emailEl.value = '';
            if (phoneEl) phoneEl.value = '';
            renderPreview();

            var done = el('tk-done');
            if (done) {
                var ref = el('tk-done-ref');
                if (ref) ref.textContent = data.ticket_ref || 'PENDING';
                done.hidden = false;
                document.body.classList.add('sv2-locked');
            }
        } catch (err) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Ticket'; }
            showError('Network error while submitting your ticket. Please try again.');
        }
    }

    function renderFounder() {
        var mount = el('tk-founder');
        if (!mount) return;
        var founder = null;
        (SNAP['team'] && SNAP['team'].members || []).forEach(function (m) {
            if (m && (m.is_founder || /founder/i.test(m.role || ''))) founder = founder || m;
        });
        var contact = SNAP['contact'] || {};
        var name = (founder && founder.name) || contact.founder_name || 'Founder';
        var role = (founder && founder.role) || contact.founder_role || 'Mexa Motion';
        var bio = contact.founder_bio || (founder && founder.bio) || '';
        var photo = (founder && (founder.file_path || founder.photo_url)) || '';
        var wa = digits((founder && founder.whatsapp) || contact.whatsapp_number || '');
        var tg = (founder && founder.telegram) || contact.telegram_url || '';
        var mail = (founder && founder.email) || contact.email || '';
        var fb = contact.facebook_url || '';

        var links = [];
        if (wa) links.push('<a class="tk-link is-wa" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>');
        if (tg) links.push('<a class="tk-link is-tg" href="' + esc(tg) + '" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> Telegram</a>');
        if (fb) links.push('<a class="tk-link" href="' + esc(fb) + '" target="_blank" rel="noopener"><i class="fa-brands fa-facebook-f"></i> Facebook</a>');
        if (mail && mail.indexOf('your-domain.com') === -1 && mail.indexOf('example.com') === -1) {
            links.push('<a class="tk-link is-mail" href="mailto:' + esc(mail) + '"><i class="fa-solid fa-envelope"></i> Email</a>');
        }

        mount.innerHTML =
            '<div class="tk-founder-photo">' +
                (photo ? '<img src="' + esc(photo) + '" alt="' + esc(name) + '" loading="lazy" decoding="async">' : '<i class="fa-solid fa-user-tie"></i>') +
            '</div>' +
            '<div>' +
                '<h2 class="tk-founder-name">' + esc(name) + '</h2>' +
                '<p class="tk-founder-role">' + esc(role) + '</p>' +
                (bio ? '<p class="tk-founder-bio">' + esc(bio) + '</p>' : '') +
                '<div class="tk-links">' + (links.join('') || '<span class="tk-founder-bio">Contact details will appear here once they are added.</span>') + '</div>' +
            '</div>';
    }

    document.addEventListener('change', function (e) {
        if (!e.target) return;
        if (e.target.id === 'tk-service') {
            state.serviceId = e.target.value;
            renderSum(); renderQuality(); renderPreview();
            try { history.replaceState({}, '', 'book.php?service=' + encodeURIComponent(state.serviceId) + '&quality=' + encodeURIComponent(state.quality)); } catch (err) {}
            return;
        }
        if (e.target.name === 'tk-quality') {
            state.quality = e.target.value;
            renderSum(); renderQuality(); renderPreview();
            try { history.replaceState({}, '', 'book.php?service=' + encodeURIComponent(state.serviceId) + '&quality=' + encodeURIComponent(state.quality)); } catch (err) {}
        }
    });

    document.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'tk-message') {
            state.message = e.target.value;
            var c = el('tk-count');
            if (c) c.textContent = state.message.length + ' / 4000';
            renderPreview();
            if (state.message.trim().length >= 20) showError('');
        }
    });

    document.addEventListener('click', function (e) {
        var q = e.target.closest('.tk-q');
        if (q && !e.target.matches('input')) {
            state.quality = q.getAttribute('data-quality');
            renderSum(); renderQuality(); renderPreview();
            try { history.replaceState({}, '', 'book.php?service=' + encodeURIComponent(state.serviceId) + '&quality=' + encodeURIComponent(state.quality)); } catch (err) {}
            return;
        }
        if (e.target.closest('[data-tk-close-done]')) {
            var done = el('tk-done');
            if (done) done.hidden = true;
            document.body.classList.remove('sv2-locked');
            showError('');
        }
    });

    document.addEventListener('submit', function (e) {
        if (e.target && e.target.id === 'tk-form') submit(e);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var done = el('tk-done');
            if (done && !done.hidden) { done.hidden = true; document.body.classList.remove('sv2-locked'); }
        }
    });

    function boot() {
        services = S.catalog.services();
        if (!state.serviceId || !S.catalog.service(state.serviceId)) {
            state.serviceId = services.length ? String(services[0].id) : '';
        }
        renderForm();
        refreshAll();
        renderFounder();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
