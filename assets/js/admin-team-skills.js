(function () {
    'use strict';

    var manager = document.querySelector('[data-skill-manager]');
    if (!manager) return;

    var limit = parseInt(manager.getAttribute('data-limit'), 10) || 4;
    var hidden = manager.querySelector('input[name="skills"]');
    var input = manager.querySelector('#team-skill-input');
    var addBtn = manager.querySelector('#team-skill-add');
    var list = manager.querySelector('#team-skills-list');
    var counter = manager.querySelector('#team-skills-count');
    var hint = manager.querySelector('#team-skills-hint');
    if (!hidden || !input || !addBtn || !list || !counter || !hint) return;

    function clean(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function parse(value) {
        var seen = {};
        return String(value || '')
            .split(/[\r\n,]+/)
            .map(clean)
            .filter(function (skill) {
                if (!skill) return false;
                var key = skill.toLowerCase();
                if (seen[key]) return false;
                seen[key] = true;
                return true;
            });
    }

    function values() {
        return parse(hidden.value);
    }

    function defaultHint() {
        return 'Add up to ' + limit + ' skills. Click a skill to edit it, or × to remove it.';
    }

    function setHint(message) {
        hint.textContent = message || defaultHint();
        hint.classList.toggle('is-warning', !!message && message.indexOf('Add up to') !== 0);
    }

    function sync(valuesToSave, message) {
        var unique = [];
        var seen = {};
        (valuesToSave || []).forEach(function (skill) {
            var value = clean(skill);
            if (!value) return;
            var key = value.toLowerCase();
            if (seen[key]) return;
            seen[key] = true;
            unique.push(value);
        });
        hidden.value = unique.join('\n');
        render(message);
    }

    function render(message) {
        var current = values();
        list.innerHTML = '';

        current.forEach(function (skill, index) {
            var chip = document.createElement('li');
            chip.className = 'adm-skill-chip' + (index >= limit ? ' is-over' : '');

            var edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'adm-skill-edit';
            edit.textContent = skill;
            edit.title = 'Edit this skill';
            edit.setAttribute('aria-label', 'Edit skill: ' + skill);

            var remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'adm-skill-remove';
            remove.innerHTML = '&times;';
            remove.title = 'Remove this skill';
            remove.setAttribute('aria-label', 'Remove skill: ' + skill);

            edit.addEventListener('click', function () {
                var next = values();
                next.splice(index, 1);
                sync(next);
                input.value = skill;
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            });

            remove.addEventListener('click', function () {
                var next = values();
                next.splice(index, 1);
                sync(next);
                input.focus();
            });

            chip.appendChild(edit);
            chip.appendChild(remove);
            list.appendChild(chip);
        });

        if (!current.length) {
            var empty = document.createElement('li');
            empty.className = 'adm-skill-empty';
            empty.textContent = 'No skills added yet.';
            list.appendChild(empty);
        }

        counter.textContent = current.length + ' / ' + limit + ' skills';
        counter.classList.toggle('is-over', current.length > limit);
        counter.classList.toggle('is-full', current.length === limit);

        input.disabled = current.length >= limit;
        addBtn.disabled = current.length >= limit;

        if (message) {
            setHint(message);
        } else if (current.length > limit) {
            setHint('Remove ' + (current.length - limit) + ' skill' + (current.length - limit === 1 ? '' : 's') + ' to meet the limit of ' + limit + '.');
        } else if (current.length === limit) {
            setHint('Maximum ' + limit + ' skills reached. Remove one to add another.');
        } else {
            setHint('');
        }
    }

    function addFromInput() {
        var incoming = parse(input.value);
        if (!incoming.length) return;

        var current = values();
        var existing = {};
        current.forEach(function (skill) { existing[skill.toLowerCase()] = true; });

        var available = limit - current.length;
        if (available <= 0) {
            input.value = '';
            setHint('Maximum ' + limit + ' skills reached. Remove one to add another.');
            return;
        }

        var accepted = [];
        var duplicate = false;
        incoming.forEach(function (skill) {
            if (accepted.length >= available) return;
            if (existing[skill.toLowerCase()]) { duplicate = true; return; }
            existing[skill.toLowerCase()] = true;
            accepted.push(skill);
        });

        input.value = '';
        var message = '';
        if (incoming.length > available) {
            message = 'Only ' + limit + ' skills are allowed. ' + accepted.length + ' skill' + (accepted.length === 1 ? '' : 's') + ' added.';
        } else if (duplicate && !accepted.length) {
            message = 'That skill is already in the list.';
        } else if (duplicate) {
            message = 'Duplicate skills were skipped.';
        }

        sync(current.concat(accepted), message);
        input.focus();
    }

    addBtn.addEventListener('click', addFromInput);

    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            addFromInput();
        }
    });

    // admin.js populates the form fields from data-row in its own document
    // click listener. This listener is registered later, so reading the hidden
    // field here always sees the freshly populated skill list.
    document.addEventListener('click', function (event) {
        var opener = event.target.closest('[data-modal-open="team-modal"]');
        if (!opener) return;
        // Hidden inputs mirror the attribute when scripted, so form.reset()
        // alone can keep the previously edited member's list. Clear it for
        // the "Add Team Member" flow before rendering.
        if (!opener.getAttribute('data-row')) {
            hidden.value = '';
            input.value = '';
        }
        render();
    });

    // Capture the submit before admin.js's bubble listener so an over-limit
    // card cannot be posted from the browser. The API enforces the same limit.
    document.addEventListener('submit', function (event) {
        var form = event.target;
        if (!form || !form.querySelector || !form.querySelector('[data-skill-manager]')) return;
        var count = values().length;
        if (count > limit) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setHint('Remove ' + (count - limit) + ' skill' + (count - limit === 1 ? '' : 's') + ' before saving.');
            input.focus();
        }
    }, true);

    render();
})();
