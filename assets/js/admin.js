(function () {
    'use strict';

    var csrfMeta = document.querySelector('meta[name="csrf-token"]');
    var csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';
    var toastEl = document.getElementById('adm-toast');
    var toastTimer = null;

    function toast(msg, isErr) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.toggle('is-err', !!isErr);
        toastEl.hidden = false;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toastEl.hidden = true;
        }, 3200);
    }

    function postApi(url, formData) {
        if (!formData.has('_csrf')) {
            formData.append('_csrf', csrfToken);
        }
        return fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: formData
        }).then(function (r) {
            return r.json().then(function (d) {
                return { ok: r.ok && d && d.ok, data: d };
            });
        });
    }

    document.addEventListener('submit', function (e) {
        var form = e.target;
        if (!form || !form.hasAttribute('data-adm-api')) return;
        e.preventDefault();
        var endpoint = form.getAttribute('data-adm-api');
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        var fd = new FormData(form);
        postApi(endpoint, fd)
            .then(function (res) {
                if (!res.ok) {
                    toast((res.data && res.data.error) || 'Operation failed.', true);
                    if (btn) btn.disabled = false;
                    return;
                }
                toast('Saved! Reloading...');
                setTimeout(function () { window.location.reload(); }, 450);
            })
            .catch(function () {
                toast('Network error. Please retry.', true);
                if (btn) btn.disabled = false;
            });
    });

    document.addEventListener('click', function (e) {
        var openBtn = e.target.closest('[data-modal-open]');
        if (openBtn) {
            var m = document.getElementById(openBtn.getAttribute('data-modal-open'));
            if (m) {
                var form = m.querySelector('form');
                var payload = openBtn.getAttribute('data-row');
                if (form) {
                    form.reset();
                    if (payload) {
                        try {
                            var row = JSON.parse(payload);
                            Object.keys(row).forEach(function (k) {
                                var field = form.elements.namedItem(k);
                                if (!field) return;
                                if (field.type === 'checkbox') {
                                    field.checked = Number(row[k]) === 1 || row[k] === true;
                                } else if (Array.isArray(row[k])) {
                                    field.value = row[k].join('\n');
                                } else {
                                    field.value = row[k] == null ? '' : String(row[k]);
                                }
                            });
                            var act = form.elements.namedItem('action');
                            if (act) act.value = 'update';
                        } catch (err) {}
                    } else {
                        var actNew = form.elements.namedItem('action');
                        if (actNew) actNew.value = 'create';
                        var idField = form.elements.namedItem('id');
                        if (idField) idField.value = '0';
                    }
                }
                var titleEl = m.querySelector('[data-modal-title]');
                if (titleEl && openBtn.getAttribute('data-title')) {
                    titleEl.textContent = openBtn.getAttribute('data-title');
                }
                m.hidden = false;
            }
            return;
        }

        var closeBtn = e.target.closest('[data-modal-close]');
        if (closeBtn) {
            var modal = closeBtn.closest('.adm-modal');
            if (modal) modal.hidden = true;
            return;
        }

        var actBtn = e.target.closest('[data-quick-api]');
        if (actBtn) {
            var confirmMsg = actBtn.getAttribute('data-confirm');
            if (confirmMsg && !window.confirm(confirmMsg)) return;
            var fd = new FormData();
            fd.append('action', actBtn.getAttribute('data-action') || '');
            fd.append('id', actBtn.getAttribute('data-id') || '0');
            if (actBtn.hasAttribute('data-status')) {
                fd.append('status', actBtn.getAttribute('data-status'));
            }
            actBtn.disabled = true;
            postApi(actBtn.getAttribute('data-quick-api'), fd)
                .then(function (res) {
                    if (!res.ok) {
                        toast((res.data && res.data.error) || 'Request failed.', true);
                        actBtn.disabled = false;
                        return;
                    }
                    toast('Updated!');
                    setTimeout(function () { window.location.reload(); }, 350);
                })
                .catch(function () {
                    toast('Network error.', true);
                    actBtn.disabled = false;
                });
            return;
        }

        var tabBtn = e.target.closest('[data-tab-target]');
        if (tabBtn) {
            var target = tabBtn.getAttribute('data-tab-target');
            document.querySelectorAll('[data-tab-target]').forEach(function (b) {
                b.classList.toggle('is-active', b === tabBtn);
            });
            document.querySelectorAll('[data-tab-pane]').forEach(function (p) {
                p.hidden = p.getAttribute('data-tab-pane') !== target;
            });
        }
    });
})();
