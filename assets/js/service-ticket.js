(function () {
    'use strict';

    var form = document.getElementById('ticket-form');
    if (!form) return;

    var msg = document.getElementById('tk-msg');
    var btn = document.getElementById('tk-submit');
    var label = btn ? btn.querySelector('span') : null;
    var fields = {
        name: document.getElementById('tk-name'),
        whatsapp: document.getElementById('tk-whatsapp'),
        message: document.getElementById('tk-message')
    };
    var busy = false;

    function show(text, ok) {
        if (!msg) return;
        msg.textContent = text;
        msg.hidden = false;
        msg.className = 'svc-ticket-msg ' + (ok ? 'is-ok' : 'is-err');
    }
    function clearInvalid() {
        Object.keys(fields).forEach(function (k) { if (fields[k]) fields[k].classList.remove('is-invalid'); });
    }
    function fail(key, text) {
        clearInvalid();
        if (fields[key]) { fields[key].classList.add('is-invalid'); fields[key].focus(); }
        show(text, false);
        return false;
    }

    // Mirrors api/submit-ticket.php so most mistakes are caught before sending.
    function validate() {
        var name = fields.name.value.trim();
        var wa = fields.whatsapp.value.replace(/[\s().-]+/g, '');
        var details = fields.message.value.trim();
        if (name.length < 2) return fail('name', 'Please enter your name.');
        if (!/^\+?\d{8,15}$/.test(wa)) return fail('whatsapp', 'Please enter a valid WhatsApp number, with country code if outside Bangladesh.');
        if (details.length < 10) return fail('message', 'Please describe what you need in at least 10 characters.');
        return true;
    }

    Object.keys(fields).forEach(function (k) {
        if (fields[k]) fields[k].addEventListener('input', function () { this.classList.remove('is-invalid'); });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (busy || !validate()) return;
        clearInvalid();
        busy = true;
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Sending…';

        fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form), credentials: 'same-origin' })
            .then(function (resp) {
                return resp.json().catch(function () { return {}; }).then(function (data) { return { ok: resp.ok, data: data }; });
            })
            .then(function (res) {
                if (res.ok && res.data.ok) {
                    form.reset();
                    show('Ticket submitted' + (res.data.ticket ? ' — your reference is ' + res.data.ticket : '') + '. We will contact you on WhatsApp.', true);
                } else if (res.data.field && fields[res.data.field]) {
                    fail(res.data.field, res.data.error || 'Please check this field.');
                } else {
                    show(res.data.error || 'We could not send your ticket. Please try again.', false);
                }
            })
            .catch(function () {
                show('Network problem — your ticket was not sent. Please try again.', false);
            })
            .then(function () {
                busy = false;
                if (btn) btn.disabled = false;
                if (label) label.textContent = 'Submit Ticket';
            });
    });
})();
