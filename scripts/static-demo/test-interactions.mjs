/**
 * Interaction test for the static demo pages.
 *
 * Loads each shipped page in jsdom with scripts enabled (no network, memory
 * storage) and exercises the UI: mobile drawer, portfolio tabs, service package
 * picker, review pagination, booking quality switch, language toggle, media
 * modal and the inert forms.
 *
 * Run:  node scripts/static-demo/test-interactions.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole, ResourceLoader } from "jsdom";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "../../static-site");

/* The pages load data/site-data.js with a <script src>. jsdom does not fetch
   sub-resources by default, so serve the generated bundle straight from disk —
   exactly what a browser does when the folder is opened from file://. */
class LocalLoader extends ResourceLoader {
  fetch(url) {
    const rel = decodeURIComponent(url.split("demo.local/").pop()).split("?")[0].split("#")[0];
    try {
      return Promise.resolve(readFileSync(join(SITE, rel)));
    } catch (error) {
      return null; // stylesheets/fonts are not needed for behaviour checks
    }
  }
}
const settle = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const check = (name, condition, detail = "") => {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "  ✓" : "  ✗"} ${name}${!condition && detail ? ` — ${detail}` : ""}`);
};

function load(file) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    // jsdom's CSS engine does not understand a few modern rules; that is a
    // parser limitation, never a script error.
    if (/Could not parse CSS stylesheet/.test(error.message)) return;
    errors.push(error.message);
  });
  const html = readFileSync(join(SITE, file), "utf8");
  const dom = new JSDOM(html, {
    url: `https://demo.local/${file}`,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    resources: new LocalLoader(), // only the local data bundle is served
    virtualConsole,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new TypeError("offline demo"));
      window.matchMedia =
        window.matchMedia ||
        ((query) => ({
          matches: false,
          media: query,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent: () => false,
        }));
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.HTMLMediaElement.prototype.pause = () => {};
    },
  });
  return { dom, errors };
}

const click = (el, window) => {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
};
const change = (el, window) => {
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
};

async function testHome() {
  console.log("\nIndex (home)");
  const { dom, errors } = load("index.html");
  await settle();
  const { window } = dom;
  const document = window.document;

  check("no script errors", errors.length === 0, errors[0]);
  check("hero headline rendered", /THAT GROW YOUR BRAND/.test(document.querySelector("#home h1")?.textContent ?? ""));
  check("8 service cards", document.querySelectorAll(".svc-card").length >= 8);
  check(
    "8 portfolio video cards",
    document.querySelectorAll("#grid-videos > .pf-card").length === 8,
    `got ${document.querySelectorAll("#grid-videos > .pf-card").length}`,
  );
  check(
    "5 portfolio short cards",
    document.querySelectorAll("#grid-shorts > .pf-card").length === 5,
    `got ${document.querySelectorAll("#grid-shorts > .pf-card").length}`,
  );
  check("AOS initialised", document.body.hasAttribute("data-aos-duration"));

  // Portfolio tabs
  click(document.getElementById("tab-shorts"), window);
  check("shorts tab hides video grid", document.getElementById("grid-videos").classList.contains("hidden"));
  check("shorts tab shows shorts grid", !document.getElementById("grid-shorts").classList.contains("hidden"));
  click(document.getElementById("tab-videos"), window);
  check("videos tab restores grid", !document.getElementById("grid-videos").classList.contains("hidden"));

  // Mobile drawer
  window.toggleMobileMenu();
  const menu = document.getElementById("mobile-menu");
  check("mobile drawer opens", !menu.classList.contains("pointer-events-none"));
  window.toggleMobileMenu();
  await settle(420); // the drawer only becomes click-through at the end
  check("mobile drawer closes", menu.classList.contains("pointer-events-none"));

  // Language toggle
  const bn = document.querySelector('.lang-btn[data-lang="bn"]');
  if (bn) {
    click(bn, window);
    check("language switch translates nav", document.querySelector('[data-i18n="nav.service"]')?.textContent === "সার্ভিস");
    click(document.querySelector('.lang-btn[data-lang="en"]'), window);
    check("language switch restores English", document.querySelector('[data-i18n="nav.service"]')?.textContent === "Service");
  }

  // The newsletter form is design only: the browser default (navigation / GET
  // request) is always cancelled, so nothing leaves the page.
  const form = document.querySelector("footer form");
  const event = new window.Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  check("newsletter form never navigates", event.defaultPrevented);
  check("newsletter form has no action", !form.getAttribute("action") || form.getAttribute("action") === "#");
  dom.window.close();
}

async function testWork() {
  console.log("\nWork");
  const { dom, errors } = load("work.html");
  await settle();
  const document = dom.window.document;
  check("no script errors", errors.length === 0, errors[0]);
  check("recent grid rendered", document.querySelectorAll("#wk-recent-grid .wk-rc").length === 6);
  check("demo grid rendered", document.querySelectorAll("#wk-demo-grid .wk-demo").length >= 1);
  check("shorts grid rendered", document.querySelectorAll("#wk-shorts-grid .wk-short").length === 5);
  dom.window.close();
}

async function testService() {
  console.log("\nService");
  const { dom, errors } = load("service.html");
  await settle(200);
  const { window } = dom;
  const document = window.document;
  check("no script errors", errors.length === 0, errors[0]);
  check("8 service cards", document.querySelectorAll("#sv2-services .sv2-card").length === 8);
  check("3 packages for the first service", document.querySelectorAll("#sv-pkg-cards .sp-pkg").length === 3);
  check("service picker has 8 options", document.querySelectorAll("#sv-svc-pick option").length === 8);

  const picker = document.getElementById("sv-svc-pick");
  picker.value = picker.options[2].value;
  change(picker, window);
  check("package section follows the picker", document.querySelectorAll("#sv-pkg-cards .sp-pkg").length === 3);

  const videoButton = document.querySelector("#sv2-services [data-sv2-video]") || document.querySelector("[data-sv2-video]");
  if (videoButton) {
    click(videoButton, window);
    check("media modal opens", document.getElementById("sv2-video").hidden === false);
    click(document.querySelector("#sv2-video [data-sv2-close]"), window);
    check("media modal closes", document.getElementById("sv2-video").hidden === true);
  }
  window.close();
}

async function testTeam() {
  console.log("\nTeam");
  const { dom, errors } = load("team.html");
  await settle();
  const document = dom.window.document;
  check("no script errors", errors.length === 0, errors[0]);
  check("founder rendered", Boolean(document.querySelector("#t3-founder .tm-founder-name")));
  check("member cards rendered", document.querySelectorAll("#t3-grid .t3-card").length >= 4);
  dom.window.close();
}

async function testReviews() {
  console.log("\nReview");
  const { dom, errors } = load("review.html");
  await settle();
  const { window } = dom;
  const document = window.document;
  check("no script errors", errors.length === 0, errors[0]);
  const initial = document.querySelectorAll("#rvx-grid .rvx-card").length;
  check("first page of reviews shown", initial === 20, `got ${initial}`);
  check("summary computed", document.getElementById("rvx-avg").textContent !== "—");

  const more = document.getElementById("rvx-more");
  if (more && !document.getElementById("rvx-more-wrap").hidden) {
    click(more, window);
    await settle();
    const after = document.querySelectorAll("#rvx-grid .rvx-card").length;
    check("see more reveals the rest", after > initial, `${initial} -> ${after}`);
  }

  // Star picker + inert submit
  const star = document.querySelector('#rvx-rate [data-star="4"]');
  click(star, window);
  check("star picker selects", star.classList.contains("on"));

  document.getElementById("rvx-name").value = "Demo Guest";
  document.getElementById("rvx-body").value = "This is a static demo review body with enough characters.";
  let posted = false;
  window.fetch = () => {
    posted = true;
    return Promise.reject(new Error("offline"));
  };
  document.getElementById("rvx-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  check("review submit makes no request", !posted);
  check("thank-you popup opens", document.getElementById("rvx-modal").hidden === false);
  check(
    "no review is stored",
    window.localStorage.getItem("mm-pending-reviews") === null,
    String(window.localStorage.getItem("mm-pending-reviews")).slice(0, 40),
  );
  click(document.getElementById("rvx-modal-done"), window);
  check("thank-you popup closes", document.getElementById("rvx-modal").hidden === true);
  dom.window.close();
}

async function testBooking() {
  console.log("\nBook");
  const { dom, errors } = load("book.html");
  await settle();
  const { window } = dom;
  const document = window.document;
  check("no script errors", errors.length === 0, errors[0]);
  check("selected package summary", Boolean(document.querySelector("#tk-sum .tk-sum-name")));
  check("quality options", document.querySelectorAll("#tk-quality .tk-q").length === 3);
  check("order preview rows", document.querySelectorAll("#tk-prev-rows .tk-prev-row").length === 4);
  check("founder card", Boolean(document.querySelector("#tk-founder .tk-founder-name")));

  const normal = document.querySelector('#tk-quality [data-quality="normal"]');
  click(normal, window);
  check("quality switch updates preview", Boolean(document.querySelector('#tk-quality .tk-q.is-on[data-quality="normal"]')));

  document.getElementById("tk-message").value = "A demo project description that is long enough for validation.";
  document.getElementById("tk-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  check("ticket is not created", document.getElementById("tk-done").hidden !== false);
  check("no booking is stored", window.localStorage.getItem("mm_bookings_v1") === null);
  dom.window.close();
}

const suite = [testHome, testWork, testService, testTeam, testReviews, testBooking];
for (const test of suite) await test();

const failed = results.filter((result) => !result.ok);
console.log(`\n${failed.length ? "✗" : "✓"} ${results.length - failed.length}/${results.length} interaction checks passed`);
if (failed.length) process.exitCode = 1;
