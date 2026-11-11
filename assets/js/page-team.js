(function () {
    'use strict';
    var SNAP = (window.__MM_DEMO_DATA__ && window.__MM_DEMO_DATA__.team) || null;

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    function initials(n) {
        return String(n || '?').trim().split(/\s+/).slice(0, 2)
            .map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
    }
    function list(v) {
        if (Array.isArray(v)) return v.filter(Boolean);
        return String(v || '').split(/[\r\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }

    function photoBlock(m) {
        var ini = esc(initials(m.name));
        var src = m.file_path || m.photo_url || '';
        if (!src) return '<span class="t3-initials" aria-hidden="true">' + ini + '</span>';
        return '<img src="' + esc(src) + '" alt="' + esc(m.name) + ' — ' +
            esc(m.designation || m.role || 'team member') + '" loading="lazy" decoding="async" ' +
            'onerror="this.outerHTML=&quot;<span class=\'t3-initials\' aria-hidden=\'true\'>' + ini + '</span>&quot;">';
    }

    function renderFounder(m, intro) {
        var wrap = document.getElementById('t3-founder');
        if (!wrap) return;
        var introEl = document.getElementById('t3-intro');
        if (introEl && intro) introEl.textContent = intro;
        if (!m) { wrap.hidden = true; return; }
        wrap.hidden = false;

        var src = m.file_path || m.photo_url || '';
        var skills = list(m.skills);
        var bioText = m.bio || m.description || '';
        wrap.innerHTML =
            '<div class="tm-founder-photo">' +
                (src ? '<img src="' + esc(src) + '" alt="' + esc(m.name) + ' portrait" loading="lazy" decoding="async">' : '<span class="t3-initials">' + esc(initials(m.name)) + '</span>') +
            '</div>' +
            '<div class="t3-founder-info">' +
                '<h2 class="tm-founder-name">' + esc(m.name) + '</h2>' +
                '<p class="tm-founder-role">' + esc(m.role || 'Founder') + '</p>' +
                (bioText ? '<p class="tm-founder-bio">' + esc(bioText) + '</p>' : '') +
                (skills.length ? '<div class="t3-block t3-founder-keywords"><span class="t3-block-label">Skill keywords</span><ul class="t3-chips">' +
                    skills.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
                    '</ul></div>' : '') +
                '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">' +
                    '<div class="tm-perk"><span class="tm-perk-ic"><i class="fa-regular fa-user"></i></span><div><p class="tm-perk-title">6+ Years Exp.</p><p class="tm-perk-text">Industry Veteran</p></div></div>' +
                    '<div class="tm-perk"><span class="tm-perk-ic"><i class="fa-solid fa-shield-halved"></i></span><div><p class="tm-perk-title">Certified Pro</p><p class="tm-perk-text">Adobe Workflow Expert</p></div></div>' +
                '</div>' +
            '</div>';
    }

    function memberCard(m) {
        var skills = list(m.skills);
        var desc = String(m.description || m.bio || '').trim();

        return '<article class="t3-card" data-member-id="' + esc(m.id) + '">' +
            '<div class="t3-media">' + photoBlock(m) + '</div>' +
            '<div class="t3-body">' +
                '<h3 class="t3-name">' + esc(m.name) + '</h3>' +
                '<p class="t3-role">' + esc(m.designation || m.role || 'Team member') + '</p>' +
                (desc ? '<p class="t3-desc">' + esc(desc) + '</p>' : '') +
                (skills.length
                    ? '<div class="t3-block t3-skills"><span class="t3-block-label">Skills &amp; expertise</span>' +
                      '<ul class="t3-chips">' +
                        skills.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') +
                      '</ul></div>'
                    : '') +
            '</div>' +
            '</article>';
    }

    function renderTeam(data) {
        data = data || {};
        var members = (data.members || []).filter(function (m) {
            return m && m.is_active !== 0 && m.is_active !== false && m.is_active !== '0';
        }).slice().sort(function (a, b) {
            return num(a.sort_order, 0) - num(b.sort_order, 0);
        });

        var founder = members.filter(function (m) { return Number(m.is_founder) === 1; })[0] ||
            members.filter(function (m) { return /founder/i.test(m.role || ''); })[0] || null;
        var others = members.filter(function (m) { return m !== founder; });

        renderFounder(founder, data.intro);

        var grid = document.getElementById('t3-grid');
        var count = document.getElementById('t3-count');
        if (!grid) return;
        grid.innerHTML = others.length
            ? others.map(memberCard).join('')
            : '<div class="t3-empty">Team members will appear here as soon as they are added in the Admin Panel.</div>';
        if (count) {
            count.textContent = members.length
                ? members.length + ' people · founder + ' + others.length + ' specialists'
                : '';
        }
    }

    if (SNAP) renderTeam(SNAP);
})();
