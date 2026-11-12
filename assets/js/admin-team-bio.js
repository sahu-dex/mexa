(function () {
    'use strict';

    var fields = document.querySelectorAll('[data-team-profile-limit]');
    // Count Unicode code points, matching PHP's mb_strlen rather than UTF-16 units.
    function count(value) { return Array.from(value).length; }
    function keepCharacters(value, limit) {
        return Array.from(value).slice(0, Math.max(0, limit)).join('');
    }
    function update(field) {
        var length = count(field.value);
        var counter = document.getElementById(field.getAttribute('aria-describedby'));
        if (counter) counter.textContent = length + ' / 300 characters' + (length > 300 ? ' — please shorten before saving' : '');
        field.setCustomValidity(length > 300 ? 'Please shorten this field to 300 characters or fewer.' : '');
    }
    function insert(field, text) {
        var start = field.selectionStart;
        var end = field.selectionEnd;
        var remaining = 300 - count(field.value.slice(0, start) + field.value.slice(end));
        var accepted = keepCharacters(text.replace(/\r\n?/g, '\n'), remaining);
        field.setRangeText(accepted, start, end, 'end');
        update(field);
    }

    fields.forEach(function (field) {
        var previous = field.value;
        field.addEventListener('beforeinput', function (event) {
            if (event.isComposing) return;
            previous = field.value;
            if (!event.inputType.startsWith('insert') || event.data == null) return;
            var next = field.value.slice(0, field.selectionStart) + event.data + field.value.slice(field.selectionEnd);
            if (count(next) > 300) {
                event.preventDefault();
                insert(field, event.data);
            }
        });
        field.addEventListener('paste', function (event) {
            if (!event.clipboardData) return;
            event.preventDefault();
            insert(field, event.clipboardData.getData('text/plain'));
        });
        function enforceLimit() {
            // Preserve the text after the cursor when an insertion exceeds the limit.
            if (count(field.value) > 300 && count(previous) <= 300) {
                var cursor = field.selectionStart;
                var prefix = field.value.slice(0, cursor);
                var suffix = field.value.slice(cursor);
                var allowed = Math.max(0, 300 - count(suffix));
                var kept = keepCharacters(prefix, allowed);
                field.value = kept + suffix;
                field.setSelectionRange(kept.length, kept.length);
            }
            previous = field.value;
            update(field);
        }
        field.addEventListener('compositionstart', function () { previous = field.value; });
        field.addEventListener('compositionend', enforceLimit);
        field.addEventListener('input', function (event) {
            if (!event.isComposing) enforceLimit();
        });
        update(field);
    });

    // admin.js populates the modal in its click handler before this handler runs.
    document.addEventListener('click', function (event) {
        if (event.target.closest('[data-modal-open="team-modal"]')) {
            fields.forEach(update);
        }
    });
})();
