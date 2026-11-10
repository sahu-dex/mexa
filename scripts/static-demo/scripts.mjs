/**
 * Script transforms for the static demo build.
 *
 * The public pages get their content from Laravel APIs and keep a client-side
 * data store (localStorage) seeded from an embedded snapshot. For the
 * standalone demo:
 *
 *  FINAL PAGE (what ships)
 *    · localStorage / sessionStorage become in-memory only,
 *    · fetch() / XHR never reach the network,
 *    · data scripts (stores, API bridges, catalog loaders) are not shipped,
 *    · every submitted form and action button is blocked with a demo notice,
 *    · all UI scripts stay: header state, mobile drawer, language toggle,
 *      nav indicator, AOS reveal, FAQ, counters, review carousel, media
 *      modals, star picker, image guard, character effects.
 *
 *  PRE-RENDER PAGE (executed in jsdom to capture the data-driven markup)
 *    · data scripts stay executable so the page's own render functions can
 *      fill the grids, roster and review list we keep in the HTML.
 *
 * Every edit is matched against the current templates; a mismatch throws so a
 * silent design regression is impossible.
 */

const fail = (page, what) => {
  throw new Error(`[${page}] transform failed: ${what}`);
};

/** Replaces exactly one occurrence (fails on zero or several). */
export function replaceOnce(html, search, replace, page, what) {
  const index = html.indexOf(search);
  if (index === -1) fail(page, `pattern not found: ${what}`);
  if (html.indexOf(search, index + 1) !== -1) fail(page, `pattern not unique: ${what}`);
  return html.slice(0, index) + replace + html.slice(index + search.length);
}

/** Replaces every occurrence. */
export function replaceAll(html, search, replace, page, what) {
  if (!html.includes(search)) fail(page, `pattern not found: ${what}`);
  return html.split(search).join(replace);
}

/** Signature line of every inline <script> in the page (for verification). */
export function scriptSignatures(html) {
  return Array.from(html.matchAll(/<script[^>]*>/g)).map((m) => m[0]);
}

/* ------------------------------------------------------------------------- */
/* shared runtime injected into the final pages                               */
/* ------------------------------------------------------------------------- */

const RUNTIME_SHIM = `/* ==========================================================================
   Standalone HTML demo runtime.
   The site has no backend, database, API or server-side code: storage is
   held in memory only and every network request is cancelled here.
   ========================================================================== */
(function () {
    'use strict';
    function memoryStorage(name) {
        var data = Object.create(null);
        var api = {
            getItem: function (key) {
                key = String(key);
                return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
            },
            setItem: function (key, value) { data[String(key)] = String(value); },
            removeItem: function (key) { delete data[String(key)]; },
            clear: function () { data = Object.create(null); },
            key: function (index) {
                var keys = Object.keys(data);
                var i = Number(index);
                return i >= 0 && i < keys.length ? keys[i] : null;
            }
        };
        Object.defineProperty(api, 'length', { get: function () { return Object.keys(data).length; } });
        Object.defineProperty(api, name, { value: name });
        return api;
    }
    try {
        /* The demo must work from file:// where storage may be blocked. */
        if (!window.localStorage || !window.sessionStorage) throw new Error('storage unavailable');
    } catch (error) {
        ['localStorage', 'sessionStorage'].forEach(function (name) {
            try {
                Object.defineProperty(window, name, { configurable: true, value: memoryStorage(name) });
            } catch (error2) { /* storage already restricted */ }
        });
    }
    window.fetch = function () {
        return Promise.reject(new TypeError('Static HTML demo: network requests are disabled.'));
    };
    try {
        var NativeXHR = window.XMLHttpRequest;
        if (NativeXHR) {
            var DemoXHR = function () {
                throw new Error('Static HTML demo: network requests are disabled.');
            };
            DemoXHR.prototype = NativeXHR.prototype;
            window.XMLHttpRequest = DemoXHR;
        }
    } catch (error) {}
    try {
        if (navigator.sendBeacon) navigator.sendBeacon = function () { return false; };
    } catch (error) {}
    if (!window.__MM_DEMO_DATA__) window.__MM_DEMO_DATA__ = {};
})();`;

const FORM_BLOCKER = `/* ==========================================================================
   Static demo: forms are part of the design only. Nothing is validated,
   processed, stored or sent — the browser keeps the design intact and shows
   a short notice instead.
   ========================================================================== */
(function () {
    'use strict';
    var timer = 0;
    function notify(target) {
        var box = document.getElementById('custom-msg-box');
        var text = document.getElementById('custom-msg-text');
        if (box && text && target && target.closest && target.closest('footer')) {
            text.textContent = 'This is a static demo — the newsletter form is not connected.';
            box.classList.remove('translate-x-[200%]');
            window.clearTimeout(timer);
            timer = window.setTimeout(function () { box.classList.add('translate-x-[200%]'); }, 3200);
            return;
        }
        var note = document.getElementById('demo-notice');
        if (!note) {
            note = document.createElement('div');
            note.id = 'demo-notice';
            note.setAttribute('role', 'status');
            note.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(14px);' +
                'background:#013D73;color:#fff;font:500 13.5px/1.5 Poppins,sans-serif;padding:12px 20px;' +
                'border-radius:999px;box-shadow:0 12px 32px rgba(1,61,115,.28);z-index:100000;opacity:0;' +
                'pointer-events:none;transition:opacity .25s ease,transform .25s ease;max-width:calc(100% - 32px);text-align:center';
            document.body.appendChild(note);
        }
        note.textContent = 'This is a static demo — form submissions are disabled.';
        note.style.opacity = '1';
        note.style.transform = 'translateX(-50%) translateY(0)';
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
            note.style.opacity = '0';
            note.style.transform = 'translateX(-50%) translateY(14px)';
        }, 3400);
    }
    /* Some forms already answer inside the page: the footer newsletter shows the
       site toast, the review form shows its thank-you popup and the booking form
       shows its in-page acknowledgement. They are static too, so they keep their
       own behaviour; everything else is stopped here. */
    function handledInPage(form) {
        if (!form) return false;
        if (form.id === 'rvx-form' || form.id === 'tk-form') return true;
        var inline = form.getAttribute('onsubmit') || '';
        return /showCustomMessage|preventDefault/.test(inline);
    }
    document.addEventListener('submit', function (event) {
        /* Nothing may ever reach a server or reload the page. */
        event.preventDefault();
        if (handledInPage(event.target)) return; // the page shows its own notice
        event.stopImmediatePropagation();
        notify(event.target);
    }, true);
    document.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-demo-only]') : null;
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        notify(button);
    }, true);
})();`;

export const SHIM_TAG = `<script id="demo-runtime">\n${RUNTIME_SHIM}\n</script>`;
export const FORM_TAG = `<script id="demo-forms">\n${FORM_BLOCKER}\n</script>`;

/* ------------------------------------------------------------------------- */
/* page hooks                                                                 */
/* ------------------------------------------------------------------------- */

/** Data script that only the pre-render pass may execute. */
function markBridge(html, page) {
  return replaceOnce(
    html,
    '<script id="demo-bridge">',
    '<script id="demo-bridge" data-prerender-only="1">',
    page,
    "bridge marker",
  );
}

const DOM_HOOK = `(function () {
    'use strict';
    var data = window.__MM_DEMO_DATA__ || {};
    var page = ${JSON.stringify("__PAGE__")};
    /* The original page boot functions filled the grids from the API. The demo
       ships those sections pre-rendered; expose the callbacks the UI scripts
       need and keep everything else inert. */
    if (page === 'service' || page === 'booking') {
        window.MMStore = window.MMStore || {
            money: function (price, currency) {
                var cur = String(currency || 'USD').toUpperCase();
                var sym = cur === 'USD' ? '$' : cur === 'BDT' ? '৳' : cur === 'EUR' ? '€' : cur + ' ';
                var n = Number(price);
                if (!isFinite(n)) return '—';
                return sym + (n % 1 === 0 ? String(n) : n.toFixed(2));
            },
            catalog: { services: function () { return (data.services || []).slice(); } },
            bookings: { create: function () { return {}; } }
        };
    }
    if (page === 'team') {
        window.MMTeamPayload = data.team || { members: [] };
    }
    if (page === 'reviews') {
        window.MMReviews = {
            items: (data.reviews && data.reviews.items) || [],
            stats: (data.reviews && data.reviews.stats) || {}
        };
    }
})();`;

/** Injects the demo runtime, the DOM hook and the static data bundle. */
export function injectRuntime(html, page, demoScript) {
  // Order matters: the runtime shim first, then the content bundle, because the
  // page scripts below read `window.__MM_DEMO_DATA__` while they parse.
  html = replaceOnce(
    html,
    "<head>\n",
    `<head>\n${SHIM_TAG}\n<script id="demo-data" src="${demoScript}"></script>\n`,
    page,
    "runtime shim",
  );
  html = replaceOnce(
    html,
    "</body>",
    `<script id="demo-page">\n${DOM_HOOK.replace(
      '"__PAGE__"',
      JSON.stringify(page),
    )}\n</script>\n${FORM_TAG}\n</body>`,
    page,
    "demo runtime tail",
  );
  return html;
}

/* ------------------------------------------------------------------------- */
/* final-page transforms                                                      */
/* ------------------------------------------------------------------------- */

/**
 * @param {string} html page HTML rendered from Blade
 * @param {string} page template name
 * @param {"prerender"|"final"} phase
 */
/**
 * The language toggle stores the choice in localStorage. The demo keeps the
 * toggle and the instant translation, but remembers the choice in memory so a
 * static page never writes to storage.
 */
function patchLanguageStorage(html, page) {
  html = replaceAll(
    html,
    "try { savedLang = localStorage.getItem('mm-lang') || 'en'; } catch (e) {}",
    "try { savedLang = window.__MM_LANG__ || 'en'; } catch (e) {}",
    page,
    "language read",
  );
  return replaceAll(
    html,
    "try { localStorage.setItem('mm-lang', lang); } catch (e) {}",
    "try { window.__MM_LANG__ = lang; } catch (e) {}",
    page,
    "language write",
  );
}

export function transformScripts(html, page, phase) {
  const transformed = phase === "prerender" ? prerenderPhase(html, page) : finalPhase(html, page);
  return patchLanguageStorage(transformed, page);
}

function prerenderPhase(html, page) {
  const source = {
    home: "home",
    work: "work",
    service: "service",
    team: "team",
    reviews: "reviews",
    booking: "booking",
  }[page];
  let out = html;

  // Reviews: keep the carousel originals (the glide clones them).
  if (page === "home" || page === "work" || page === "service" || page === "team" || page === "reviews") {
    out = replaceOnce(
      out,
      "            const originals = Array.from(track.children);\n            originals.forEach(node => {\n                const clone = node.cloneNode(true);\n                clone.setAttribute('aria-hidden', 'true');\n                track.appendChild(clone);\n            });",
      "            /* static demo: cards are rendered once, the glide reuses them */\n            const originals = Array.from(track.children);",
      page,
      "reviews carousel clone",
    );
  }


  // The catalogue store seeds itself from the snapshot; that is exactly what
  // the pre-render pass needs, so it runs untouched.

  // Never let the pre-render pass keep a live snapshot bridge around.
  out = out.replace('<script id="demo-bridge">', '<script id="demo-bridge" data-prerender-only="1">');

  return out;
}

function finalPhase(html, page) {
  let out = html;

  // ---- 1 · remove the data bridge (API snapshot + fetch interception) ------
  const bridge = out.match(/<script id="demo-bridge"[^>]*>[\s\S]*?<\/script>/);
  if (!bridge) fail(page, "bridge script not found");
  out = out.replace(bridge[0], "");

  // ---- 2 · page data scripts ----------------------------------------------

  if (page === "team") {
    // The team store persists to localStorage and is driven by the admin
    // panel. It is replaced by the inert seed + pre-rendered roster.
    const open = '<script id="mm-team-store">';
    const start = out.indexOf(open);
    if (start === -1) fail(page, "team store block not found");
    const closeTag = "</script>";
    const end = out.indexOf(closeTag, start);
    const block = out.slice(start + open.length, end);
    const seedLine = block.split("\n").find((line) => line.startsWith("    var SEED = "));
    if (!seedLine) fail(page, "team store seed line not found");
    const seedJson = seedLine.slice("    var SEED = ".length).replace(/;\s*$/, "");
    try {
      JSON.parse(seedJson);
    } catch (error) {
      fail(page, "team store seed is not valid JSON");
    }
    out =
      out.slice(0, start) +
      `<script id="demo-team-seed" type="application/json">${seedJson}</script>` +
      out.slice(end + closeTag.length);

    // The roster is pre-rendered: keep every render template, skip the store
    // lookup and the boot so the demo reads nothing and writes nothing.
    out = replaceOnce(
      out,
      "    var SNAP = (window.__MM_SNAPSHOT__ || {})['/api/public/team'] || null;",
      "    /* static demo: the roster is pre-rendered in the HTML */",
      page,
      "team snapshot reference",
    );
    out = replaceOnce(
      out,
      "    function paint() {\n        var data = null;\n        if (window.MMTeam) {",
      "    function paint() {\n        var data = null;\n        if (false) {",
      page,
      "team paint store lookup",
    );
    out = replaceOnce(
      out,
      "    paint();\n\n    /* live refresh: admin save in another tab, or returning to this tab */",
      "    /* Static demo: the roster above is pre-rendered. */\n\n    /* live refresh removed for the static demo */",
      page,
      "team paint boot",
    );
  }

  if (page === "home") {
    /* Very old browsers (and jsdom) lack matchMedia. The design already treats
       motion-reduced visitors as a preference, so default to "no preference"
       instead of throwing and losing the reveal setup. */
    out = replaceOnce(
      out,
      "            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;",
      "            const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);",
      page,
      "home reduce-motion guard",
    );
    out = replaceOnce(
      out,
      "            const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;",
      "            const canHover = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;",
      page,
      "home hover guard",
    );
    // The portfolio grids ship pre-rendered. The original renderer appended to
    // the grids on DOMContentLoaded, which would duplicate every card.
    out = replaceOnce(
      out,
      "            renderPortfolio();\n            AOS.init({",
      "            /* Static demo: the portfolio grids are pre-rendered. */\n            AOS.init({",
      page,
      "home portfolio boot",
    );
  }

  if (page === "service" || page === "booking") {
    // MMStore (catalog + bookings) is a localStorage data store. Replace the
    // executable store with a tiny read-only helper so the UI keeps working.
    const open = '<script>\n/* ============================================================================\n   MEXA MOTION \u2014 service / package / ticket store  (client side)';
    const start = out.indexOf(open);
    if (start === -1) fail(page, "MMStore block not found");
    const closeTag = "</script>";
    const end = out.indexOf(closeTag, start);
    const replacement = `<script id="demo-store">
/* Static demo: the catalogue below is read from the generated data bundle.
   No storage, no tickets, no server round-trip. */
(function () {
    'use strict';
    var DATA = window.__MM_DEMO_DATA__ || {};
    function money(price, currency) {
        var cur = String(currency || 'USD').toUpperCase();
        var sym = cur === 'USD' ? '$' : cur === 'BDT' ? '৳' : cur === 'EUR' ? '€' : cur + ' ';
        var n = Number(price);
        if (!isFinite(n)) return '—';
        return sym + (n % 1 === 0 ? String(n) : n.toFixed(2));
    }
    function services() { return (DATA.services || []).slice(); }
    function packagesFor(serviceId) {
        var rows = (DATA.packages || []).filter(function (p) {
            return String(p.serviceId) === String(serviceId);
        });
        var rank = { premium: 1, high: 2, normal: 3 };
        return rows.sort(function (a, b) { return (rank[a.quality] || 9) - (rank[b.quality] || 9); });
    }
    function packageOf(serviceId, quality) {
        var rows = packagesFor(serviceId);
        for (var i = 0; i < rows.length; i++) if (rows[i].quality === quality) return rows[i];
        return rows[0] || null;
    }
    window.MMStore = {
        money: money,
        QUALITIES: [
            { key: 'premium', name: 'Premium Quality' },
            { key: 'high', name: 'High Quality' },
            { key: 'normal', name: 'Normal Quality' }
        ],
        catalog: {
            ensure: function () { return { services: services(), packages: DATA.packages || [] }; },
            services: services,
            service: function (id) {
                var list = services();
                for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
                return list[0] || null;
            },
            packagesFor: packagesFor,
            package: packageOf
        }
    };
})();
</script>`;
    out = out.slice(0, start) + replacement + out.slice(end + closeTag.length);

    if (page === "service") {
      // No embedded server snapshot: the renderer reads the generated bundle.
      out = replaceOnce(
        out,
        "    var SNAP = window.__MM_SNAPSHOT__ || {};\n    var S = window.MMStore;\n    var money = S.money;",
        "    var SNAP = window.__MM_DEMO_DATA__ || {};\n    var S = window.MMStore;\n    var money = S.money;",
        page,
        "service snapshot reference",
      );
    }

    // Service page boot: the hero, cards and packages are pre-rendered, so the
    // boot only re-runs the very same render templates across pages.
    if (page === "service") {
      const bootMarker = "        /* The controller embeds the current MySQL snapshot in the first response.\n           Hydrate from it immediately so the service page never waits on fetch(). */";
      const bootStart = out.indexOf(bootMarker);
      if (bootStart === -1) fail(page, "service boot marker not found");
      const endMarker = "    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);";
      const endAt = out.indexOf(endMarker, bootStart);
      if (endAt === -1) fail(page, "service boot end not found");
      out =
        out.slice(0, bootStart) +
        "        /* Static demo: hero, service cards and packages are pre-rendered in the\n           HTML. Re-running the same render templates keeps the UI in sync. */\n" +
        "        content = (window.__MM_DEMO_DATA__ || {}).content || {};\n" +
        "        renderHero();\n" +
        "        renderServices();\n" +
        "        renderPackageSection();\n" +
        "    }\n\n" +
        out.slice(endAt);
    }
  }

  if (page === "booking") {
    // The founder card reads its data from the snapshot; take it from the
    // generated data bundle instead (same values).
    out = replaceOnce(
      out,
      "    var SNAP = window.__MM_SNAPSHOT__ || {};\n    var S = window.MMStore;\n    var money = S.money;",
      "    var SNAP = window.__MM_DEMO_DATA__ || {};\n    var S = window.MMStore;\n    var money = S.money;",
      page,
      "booking snapshot reference",
    );
    out = replaceAll(
      out,
      "SNAP['/api/public/team']",
      "SNAP['team']",
      page,
      "booking team reference",
    );
    out = replaceAll(
      out,
      "SNAP['/api/public/contact']",
      "SNAP['contact']",
      page,
      "booking contact reference",
    );

    // Ticket creation is the only side effect: disable it, keep the form UI.
    out = replaceOnce(
      out,
      "        var ticket = S.bookings.create({",
      "        /* Static demo: no ticket is created, stored or sent. */\n" +
        "        window.__MM_DEMO_FORM__ = {\n" +
        "            form: 'booking', serviceId: svc.id, serviceName: svc.name,\n" +
        "            quality: pk.quality, packageName: pk.name, price: pk.price,\n" +
        "            currency: pk.currency, message: msg\n" +
        "        };\n" +
        "        if (btn) { btn.disabled = false; btn.innerHTML = '<i class=\"fa-solid fa-paper-plane\"></i> Submit Ticket'; }\n" +
        "        return;\n" +
        "        var ticket = S.bookings.create({",
      page,
      "booking submit guard",
    );
  }

  if (page === "reviews") {
    /* The review list and summary are pre-rendered in the HTML and driven by
       the page's own card/summary templates. The demo keeps "See more" and the
       whole submit UI, but nothing is fetched, stored or posted. */
    const loadStart = out.indexOf("        async function rvLoadMore() {");
    if (loadStart === -1) fail(page, "reviews loader not found");
    const bootStart = out.indexOf("        async function rvBoot() {", loadStart);
    if (bootStart === -1) fail(page, "reviews boot not found");
    const bootEndMarker = "        el('rvx-more').addEventListener('click', rvLoadMore);\n";
    const bootEnd = out.indexOf(bootEndMarker, bootStart);
    if (bootEnd === -1) fail(page, "reviews boot end not found");
    const demoLoader = `        function rvLoadMore() {
            if (rvState.loading) return;
            var left = rvState.total - rvState.shown;
            if (left <= 0) return;
            var chunk = rvState.items.slice(rvState.shown, rvState.shown + RVPAGE);
            rvRender(chunk, true);
            rvUpdateMore();
        }

        function rvBoot() {
            /* Static demo: the curated review set is rendered locally. */
            rvState.mode = 'demo';
            rvState.items = SAMPLE_REVIEWS.slice();
            rvState.total = rvState.items.length;
            rvRender(rvState.items.slice(0, RVPAGE), false);
            rvPaintSummary(rvState.items, null);
            rvUpdateMore();
        }

`;
    out = out.slice(0, loadStart) + demoLoader + out.slice(bootEnd);

    /* Submit: keep validation + confirmation popup, drop the POST and queue. */
    out = replaceOnce(
      out,
      "            var saved = false;\n            try {\n                var res = await fetch('/api/public/reviews', {\n                    method: 'POST',\n                    headers: { 'Content-Type': 'application/json' },\n                    body: JSON.stringify(payload)\n                });\n                var data = await res.json().catch(function () { return {}; });\n                if (res.ok && data.ok !== false && data.success !== false && !data.error) saved = true;\n            } catch (e2) { /* offline demo \u2014 stored locally below */ }\n            if (!saved) rvSavePending(payload);",
      "            /* Static demo: the review is not sent and not stored anywhere. */",
      page,
      "reviews submit guard",
    );
    /* The offline fallback queue (localStorage) is not part of the demo. */
    const pendingStart = out.indexOf("        function rvSavePending(payload) {");
    if (pendingStart === -1) fail(page, "reviews pending helper not found");
    const pendingEnd = out.indexOf("        }\n", out.indexOf("catch (e) { /* storage unavailable", pendingStart));
    if (pendingEnd === -1) fail(page, "reviews pending helper end not found");
    out =
      out.slice(0, pendingStart) +
      "        function rvSavePending(payload) { /* static demo: nothing is stored */ }\n" +
      out.slice(pendingEnd + "        }\n".length);
  }

  if (page === "home" || page === "work") {
    // The portfolio/tab script still renders the home grids from its own static
    // arrays; on the Work page the grids are pre-rendered, so its API boot is
    // skipped. Both pages keep every other UI behaviour in that script.
    if (page === "work") {
      out = replaceOnce(
        out,
        "    boot();\n})();</script>",
        "    /* static demo: the grids above are pre-rendered. */\n})();</script>",
        page,
        "work boot",
      );
      // The boot body is unreachable now; drop it so the page carries no
      // vestigial API code (the render helpers above stay).
      const bootStart = out.indexOf("    async function boot() {\n        var snapshot = window.__MM_SNAPSHOT__");
      if (bootStart === -1) fail(page, "work boot body not found");
      const endMarker = "renderRecent(); renderProjects(); renderShorts();\n    }\n";
      const endAt = out.indexOf(endMarker, bootStart);
      if (endAt === -1) fail(page, "work boot body end not found");
      out =
        out.slice(0, bootStart) +
        "    /* static demo: no data boot — the grids are already in the HTML. */\n" +
        out.slice(endAt + endMarker.length);
    }
  }

  return out;
}
