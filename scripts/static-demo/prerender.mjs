/**
 * Pre-render step for the static demo build.
 *
 * The original pages render their service cards, portfolio grids, team roster
 * and review list at runtime from a data snapshot. Dropping those scripts would
 * remove visible UI, so instead the build loads each page in jsdom, lets the
 * page's *own* render functions run against the static data bundle, and copies
 * the resulting markup back into the HTML file.
 *
 * In jsdom the runtime is deliberately inert:
 *   · fetch() rejects (no backend),
 *   · localStorage/sessionStorage are memory-only (no persistence),
 *   · script/style/link resources are never loaded,
 *   · only DOMContentLoaded is dispatched (no load/scroll media queries).
 *
 * The result is the same DOM the browser builds on the live site, frozen.
 */

import { JSDOM, VirtualConsole } from "jsdom";

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** IDs whose server-rendered content must survive the pre-render pass. */
export const KEEP_SERVER_HTML = {
  home: ["grid-videos", "grid-shorts"],
  work: ["wk-recent-grid", "wk-demo-grid", "wk-shorts-grid"],
  service: ["sv2-hero-video", "sv2-services", "sv-svc-pick", "sv-pkg-cards"],
  team: ["t3-founder", "t3-grid", "t3-count", "t3-intro"],
  reviews: ["rvx-grid"],
  booking: [
    "tk-sum",
    "tk-service",
    "tk-quality",
    "tk-prev-rows",
    "tk-prev-msg",
    "tk-founder",
  ],
};

/** Inline script types that must not be executed by the pre-render pass. */
const SKIP_SCRIPT_IDS = new Set(["mm-team-store", "demo-team-seed"]);

function installInertRuntime(window) {
  const memory = () => {
    const data = new Map();
    return {
      getItem: (key) => (data.has(String(key)) ? data.get(String(key)) : null),
      setItem: (key, value) => data.set(String(key), String(value)),
      removeItem: (key) => data.delete(String(key)),
      clear: () => data.clear(),
      key: (index) => Array.from(data.keys())[Number(index)] ?? null,
      get length() {
        return data.size;
      },
    };
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: memory() });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: memory() });
  window.fetch = () =>
    Promise.reject(new TypeError("static demo build: network requests are disabled"));
  window.XMLHttpRequest = class {
    constructor() {
      throw new Error("static demo build: network requests are disabled");
    }
  };
  window.matchMedia =
    window.matchMedia ||
    function matchMedia(query) {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      };
    };
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  // Deterministic clock so any generated label is stable between runs.
  const RealDate = window.Date;
  const FIXED = new RealDate("2026-11-10T00:00:00.000Z").getTime();
  window.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [FIXED]));
    }
    static now() {
      return FIXED;
    }
  };
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(FIXED), 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  // No network for images either.
  window.HTMLImageElement.prototype.decode = () => Promise.resolve();
}

/**
 * @param {object} options
 * @param {string} options.html final page HTML (after script transforms)
 * @param {string} options.page template name
 * @param {number} [options.wait] milliseconds to let inline scripts settle
 */
export async function prerender({ html, page, wait = 350 }) {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on("jsdomError", (error) => errors.push(error));
  virtualConsole.on("error", (message) => errors.push(new Error(String(message))));

  const dom = new JSDOM(html, {
    url: "https://demo.local/index.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      installInertRuntime(window);
    },
  });
  await settle(wait);
  const { window } = dom;
  const document = window.document;

  const result = {};
  for (const id of KEEP_SERVER_HTML[page] ?? []) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`[${page}] pre-render: missing #${id}`);
    result[id] = node.innerHTML;
  }

  const textTargets = {};
  if (page === "team") {
    textTargets["t3-count"] = document.getElementById("t3-count")?.textContent ?? "";
  }
  if (page === "reviews") {
    for (const id of ["rvx-avg", "rvx-five", "rvx-count", "rvx-count-hero", "rvx-meta", "rvx-hero-stars", "rvx-more-note"]) {
      const node = document.getElementById(id);
      if (node) textTargets[id] = node.innerHTML || node.textContent;
    }
  }

  dom.window.close();

  if (errors.length) {
    const summary = errors.slice(0, 3).map((error) => error.message || String(error));
    throw new Error(`[${page}] pre-render script errors: ${summary.join(" | ")}`);
  }
  return { htmlById: result, textById: textTargets };
}
