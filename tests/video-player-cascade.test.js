/**
 * Cascade tests for the video player's control bar.
 *
 * These exist because a colour written in one stylesheet can silently lose to a
 * stronger rule in another. That is exactly what happened here: the theme paints
 * every non-checkbox input white with
 *
 *     body :is(input:not([type=radio])…,textarea,select) { background:#fff!important }
 *
 * which outranks a single-class player rule, so the timeline and the volume
 * slider stayed white pills in a real browser while the source looked correct.
 *
 * The test therefore resolves the cascade itself — specificity (with the max-of
 * -arguments rule for :is/:not/:has), !important, and document order — across
 * every stylesheet the site loads, in the order includes/functions.php loads
 * them. The parser is the repository's own (no extra dependency at run time).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* ---------------------------- CSS parsing ---------------------------- */

/** Remove comments, keeping strings and parens intact. */
function stripComments(css) {
    let out = '';
    for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            out += ch;
            for (i++; i < css.length; i++) {
                out += css[i];
                if (css[i] === '\\') { out += css[++i]; continue; }
                if (css[i] === quote) break;
            }
            continue;
        }
        if (ch === '/' && css[i + 1] === '*') {
            i += 2;
            while (i < css.length && !(css[i] === '*' && css[i + 1] === '/')) i++;
            i++;
            continue;
        }
        out += ch;
    }
    return out;
}

/** Split on a separator that is not inside (), [], or a string. */
function splitTop(text, sep) {
    const parts = [];
    let depth = 0, cur = '', quote = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            cur += ch;
            if (ch === '\\') { cur += text[++i]; continue; }
            if (ch === quote) quote = '';
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (ch === sep && depth === 0) { parts.push(cur); cur = ''; continue; }
        cur += ch;
    }
    if (cur.trim() !== '') parts.push(cur);
    return parts;
}

/** index of the brace matching the one at `start`. */
function matchBrace(css, start) {
    let depth = 0;
    for (let i = start; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return css.length;
}

/** Flatten a stylesheet into { selector, decls, order, at } rules (no @media handling needed). */
function parseRules(css, file, startOrder) {
    const clean = stripComments(css);
    const rules = [];
    let order = startOrder;
    let i = 0;
    while (i < clean.length) {
        const braceAt = clean.indexOf('{', i);
        if (braceAt === -1) break;
        const prelude = clean.slice(i, braceAt).trim();
        const end = matchBrace(clean, braceAt);
        const body = clean.slice(braceAt + 1, end);
        const at = /^@([a-z-]+)/i.test(prelude) ? prelude.match(/^@([a-z-]+)/i)[1].toLowerCase() : '';

        if (at === 'media' || at === 'supports' || at === 'container' || at === 'layer') {
            // Nested rules: keep them, in order (their condition is checked elsewhere).
            const inner = parseRules(body, file, order);
            inner.forEach((r) => { r.condition = at + ' ' + prelude.slice(prelude.indexOf(prelude.split(/\s+/)[0]) + prelude.split(/\s+/)[0].length); });
            rules.push(...inner);
            order = inner.length ? inner[inner.length - 1].order + 1 : order;
        } else if (!at && prelude) {
            const decls = [];
            splitTop(body, ';').forEach((chunk) => {
                const colon = chunk.indexOf(':');
                if (colon === -1) return;
                const prop = chunk.slice(0, colon).trim().toLowerCase();
                if (!/^--?[a-z]/i.test(prop) && !/^[a-z-]+$/.test(prop)) return;
                let value = chunk.slice(colon + 1).trim();
                const important = /!\s*important\s*$/i.test(value);
                value = value.replace(/!\s*important\s*$/i, '').trim();
                decls.push({ prop, value, important });
            });
            splitTop(prelude, ',').forEach((sel) => {
                rules.push({ selector: sel.trim(), decls, order: order++, file });
            });
        }
        i = end + 1;
    }
    return rules;
}

/* -------------------------- specificity ------------------------------ */

const pack = (s) => s[0] * 1e6 + s[1] * 1e3 + s[2];
const maxSpec = (a, b) => (pack(a) >= pack(b) ? a : b);

/** Specificity [ids, classes/attrs/pseudo-classes, types] of one complex selector. */
function specificity(selector) {
    let total = [0, 0, 0];
    let i = 0;
    const s = selector;
    const readIdent = () => { let out = ''; while (i < s.length && /[\w\-\\]/.test(s[i])) out += s[i++]; return out; };
    const readParen = () => {           // returns the inside of (...) and moves past it
        if (s[i] !== '(') return null;
        let depth = 0, out = '';
        for (; i < s.length; i++) {
            const ch = s[i];
            if (ch === '(') { depth++; if (depth === 1) continue; }
            if (ch === ')') { depth--; if (depth === 0) { i++; break; } }
            out += ch;
        }
        return out;
    };
    while (i < s.length) {
        const ch = s[i];
        if (ch === '#' || ch === '.') {
            i++; readIdent();
            total[ch === '#' ? 0 : 1]++;
        } else if (ch === '[') {
            let depth = 0;
            for (; i < s.length; i++) {
                if (s[i] === '[') depth++;
                if (s[i] === ']') { depth--; if (depth === 0) { i++; break; } }
            }
            total[1]++;
        } else if (ch === ':') {
            i++;
            if (s[i] === ':') i++;               // ::before counts as a type selector
            const doubleColon = s[i - 1] === ':' && s[i - 2] === ':';
            const name = readIdent().toLowerCase();
            const args = s[i] === '(' ? readParen() : null;
            if (doubleColon) { total[2]++; continue; }
            if (name === 'where') continue;                       // :where() contributes nothing
            if (['is', 'not', 'has', 'matches', 'any'].includes(name) && args !== null) {
                let best = [0, 0, 0];
                splitTop(args, ',').forEach((inner) => { best = maxSpec(best, specificity(inner.trim())); });
                total = [total[0] + best[0], total[1] + best[1], total[2] + best[2]];
                continue;
            }
            if (['before', 'after', 'first-line', 'first-letter'].includes(name)) { total[2]++; continue; }
            total[1]++;
            if (args !== null && ['nth-child', 'nth-last-child'].includes(name)) {
                const of = args.match(/\bof\b([\s\S]*)$/i);
                if (of) {
                    let best = [0, 0, 0];
                    splitTop(of[1], ',').forEach((inner) => { best = maxSpec(best, specificity(inner.trim())); });
                    total = [total[0] + best[0], total[1] + best[1], total[2] + best[2]];
                }
            }
        } else if (/[\w\-*\\]/.test(ch)) {
            const ident = readIdent();
            if (ident && ident !== '*') total[2]++;
        } else {
            i++;                                   // combinators, whitespace, commas
        }
    }
    return total;
}

/* ---------------------------- the site ------------------------------- */

function stylesheetOrder() {
    const php = fs.readFileSync('includes/functions.php', 'utf8');
    const tailStart = php.indexOf('$stylesheets = array_merge(');
    const head = php.slice(php.indexOf('$map = ['), tailStart);
    const tail = php.slice(tailStart, php.indexOf('return $stylesheets;', tailStart));
    const seen = [];
    [...head.matchAll(/'assets\/css\/([^']+)'/g), ...tail.matchAll(/'assets\/css\/([^']+)'/g)].forEach((m) => {
        const file = m[1].split('?')[0];
        if (!seen.includes(file)) seen.push(file);
    });
    const player = 'video-player.css';
    return seen.filter((f) => f !== player).concat([player]);   // the player sheet loads last
}

function allRules() {
    const rules = [];
    let order = 0;
    for (const file of stylesheetOrder()) {
        const full = path.join('assets', 'css', file);
        if (!fs.existsSync(full)) continue;
        const parsed = parseRules(fs.readFileSync(full, 'utf8'), file, order);
        order = parsed.length ? parsed[parsed.length - 1].order + 1 : order;
        rules.push(...parsed);
    }
    return rules;
}

/** Which rule wins for one property on one element shape? */
function winner(rules, selectorProbe, prop, extraProps = []) {
    const names = [prop, ...extraProps];
    const hits = [];
    rules.forEach((rule) => {
        // Does the rule's selector apply to this element? Compare on the element
        // chain only: the probe is a selector for the element itself.
        const target = rule.selector.replace(/\s*>\s*/g, ' > ').trim();
        const element = target.split(' > ').pop().trim();
        const wanted = selectorProbe;
        // The element part must be compatible with the probe.
        const elementMatches = wanted.every((cls) => element.includes(cls));
        if (!elementMatches) return;
        rule.decls.forEach((decl) => {
            if (!names.includes(decl.prop)) return;
            hits.push({ ...decl, spec: specificity(rule.selector), order: rule.order, selector: rule.selector, file: rule.file });
        });
    });
    hits.sort((a, b) => (b.important - a.important) || (pack(b.spec) - pack(a.spec)) || (b.order - a.order));
    return hits[0];
}

/* ------------------------------- tests ------------------------------- */

test('the timeline and volume sliders beat the theme\'s white input skin', () => {
    const rules = allRules();
    const theme = rules.find((r) => r.file === 'premium-design-system.css'
        && /:is\(input:not\(\[type=radio\]\)/.test(r.selector));
    assert.ok(theme, 'the theme rule that paints inputs white must still be accounted for');
    const themeSpec = specificity(theme.selector);
    assert.deepEqual(themeSpec, [0, 3, 2], 'the theme rule is (0,3,2) — anything weaker loses');

    for (const [probe, prop] of [
        [['mxvp__seek', 'type="range"'], 'background'],
        [['mxvp__volume', 'type="range"'], 'background'],
        [['mxvp__seek', 'type="range"'], 'border-radius'],
        [['mxvp__volume', 'type="range"'], 'border-radius']
    ]) {
        const win = winner(rules, probe, prop);
        assert.ok(win, 'a rule must style ' + probe[0] + ' ' + prop);
        assert.equal(win.file, 'video-player.css', probe[0] + ' ' + prop + ' must come from the player, not ' + win.file);
        assert.ok(pack(specificity(win.selector)) > pack(themeSpec),
            probe[0] + ' ' + prop + ' selector must outrank the theme: ' + win.selector);
        assert.ok(win.important, probe[0] + ' ' + prop + ' must be pinned, because the theme uses !important');
    }
});

test('the played colour follows the source: red for YouTube and Shorts, blue for uploads', () => {
    const rules = allRules();
    const accent = rules.filter((r) => r.decls.some((d) => d.prop === '--mxvp-accent' && /#ff0033/i.test(d.value)));
    assert.ok(accent.length, 'a red accent rule exists');

    const defaultRule = rules.find((r) => r.selector.includes('mxvp__seek') &&
        r.decls.some((d) => d.prop === '--mxvp-accent' && /#2f7cf6/i.test(d.value)));
    assert.ok(defaultRule, 'the blue default exists');

    accent.forEach((rule) => {
        assert.ok(pack(specificity(rule.selector)) > pack(specificity(defaultRule.selector)),
            'the red rule must outrank the blue default: ' + rule.selector);
    });
});

test('no element outside the player\'s own parts can paint in the control bar', () => {
    const rules = allRules();
    const guard = rules.find((r) => /\.mxvp__bar\s*>\s*:not\(\.mxvp__scrub\):not\(\.mxvp__row\)/.test(r.selector));
    assert.ok(guard, 'the bar has a guard against stray children');
    assert.ok(guard.decls.some((d) => d.prop === 'display' && d.value === 'none' && d.important));
    assert.ok(pack(specificity(guard.selector)) >= 5e3, 'the guard is specific enough to hold');
});

test('a vertical Short can never push the fullscreen control out of the player', () => {
    const css = fs.readFileSync('assets/css/video-player.css', 'utf8');
    // The fullscreen button is last in the row and pushed right, but the bar is
    // laid out from the player's own width, so it always fits.
    assert.match(css, /body \.mxvp \.mxvp__stage \.mxvp__btn--fs \{\s*margin-inline-start:\s*auto !important;/);
    assert.match(css, /\.mxvp__row \{[^}]*flex-wrap:\s*nowrap/);
    assert.match(css, /container-type:\s*inline-size/);
    assert.match(css, /@container mxvp-stage \(max-width: 430px\)/);
    assert.match(css, /@container mxvp-stage \(max-width: 340px\)/);
    assert.match(css, /@container mxvp-stage \(max-width: 310px\)/);
    // The narrowest bucket keeps every control on one row.
    const narrow = css.match(/@container mxvp-stage \(max-width: 310px\) \{([\s\S]*?)\n\}/)[1];
    assert.match(narrow, /\.mxvp__volume \{/, 'the slider stays, only smaller');
    assert.doesNotMatch(narrow, /\.mxvp__time \{\s*display:\s*none/, 'the time label is never dropped');
});

test('nothing is parked in the middle of the picture for any provider', () => {
    const js = fs.readFileSync('assets/js/video-player.js', 'utf8');
    const template = js.slice(js.indexOf('var TEMPLATE ='), js.indexOf('var refs = {}'));
    assert.doesNotMatch(template, /mxvp__center|mxvp__cc|data-mxvp-center/);
    // The only thing that may appear there is the double-tap badge, hidden by default.
    assert.match(template, /data-mxvp-hint/);
    const css = fs.readFileSync('assets/css/video-player.css', 'utf8');
    const hint = css.match(/\.mxvp__hint \{([^}]*)\}/)[1];
    assert.match(hint, /opacity:\s*0/);
    assert.match(hint, /pointer-events:\s*none/);
});

test('the cascade maths match hand-computed values', () => {
    const cases = [
        ['body', [0, 0, 1]],
        ['.mxvp', [0, 1, 0]],
        ['#x', [1, 0, 0]],
        ['body .a .b', [0, 2, 1]],
        // :is() takes its strongest argument (0,1,1), plus body itself: (0,1,2)
        ['body :is(input:not([type=radio]))', [0, 1, 2]],
        ['body .a > :not(.b):not(.c)', [0, 3, 1]],
        ['body .a .b[type="range"]', [0, 3, 1]],
        [':where(.a, #b)', [0, 0, 0]],
        ['div:not(#a, .b)', [1, 0, 1]]
    ];
    cases.forEach(([selector, expected]) => {
        assert.deepEqual(specificity(selector), expected, selector);
    });
});
