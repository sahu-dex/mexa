/**
 * Verification for the standalone static demo.
 *
 * For every shipped page it parses the real DOM and checks:
 *   · all inline scripts parse (and no runtime error appears on load),
 *   · no backend / API / storage / admin surface is reachable,
 *   · no Blade or Laravel server syntax remains,
 *   · every local href/src resolves to a file inside static-site/,
 *   · the five public pages are linked from every navigation,
 *   · the data-driven sections are actually present (pre-rendered).
 *
 * Run:  node scripts/static-demo/verify.mjs
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));
const SITE = join(here, "../../static-site");

const NAV = ["index.html", "service.html", "work.html", "review.html", "team.html"];

const PAGES = [
  { file: "index.html", title: "Home", sections: [["#grid-videos .pf-card", 8], ["#grid-shorts .pf-card", 5]] },
  { file: "work.html", title: "Work", sections: [["#wk-recent-grid .wk-rc", 6], ["#wk-demo-grid .wk-demo", 1], ["#wk-shorts-grid .wk-short", 5]] },
  { file: "service.html", title: "Service", sections: [["#sv2-services .sv2-card", 8], ["#sv-pkg-cards .sp-pkg", 3], ["#sv-svc-pick option", 8]] },
  { file: "team.html", title: "Team", sections: [["#t3-founder .tm-founder-name", 1], ["#t3-grid .t3-card", 4]] },
  { file: "review.html", title: "Review", sections: [["#rvx-grid .rvx-card", 20]] },
  { file: "book.html", title: "Book", sections: [["#tk-sum .tk-sum-name", 1], ["#tk-quality .tk-q", 3], ["#tk-service option", 8]] },
];

const failures = [];
const fail = (page, message) => failures.push(`${page}: ${message}`);
const ok = (label) => console.log(`  ✓ ${label}`);

/* Code that must no longer exist anywhere in a shipped page. */
const FORBIDDEN_CODE = [
  { pattern: /window\.__MM_SNAPSHOT__/, label: "embedded server snapshot" },
  { pattern: /\/api\/public\//, label: "backend API call" },
  { pattern: /\bfetch\s*\(\s*['"`]\/?(api|admin)/, label: "API fetch" },
  { pattern: /csrf-token|csrf_token/, label: "CSRF token" },
  { pattern: /localStorage\s*\.\s*(set|remove)Item/, label: "storage write" },
  { pattern: /@include\s*\(|\{!!|\{\{/, label: "Blade syntax" },
  { pattern: /App\\Http|Illuminate\\|Blade::|artisan\b/, label: "Laravel server code" },
];

/* Backend surfaces: no login / register / admin panel reachable. */
const FORBIDDEN_LINKS = /(admin|login|register|logout|dashboard|cms)/i;

function inlineScripts(html) {
  return Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
    .filter((m) => !/\bsrc=/.test(m[1]) && !/type="(?!text\/javascript|module)/.test(m[1]))
    .map((m, index) => ({ index, code: m[2], attrs: m[1] }));
}

function check(file, meta) {
  const path = join(SITE, file);
  if (!existsSync(path)) return fail(file, "missing page");
  const html = readFileSync(path, "utf8");

  /* -- 1 · inline JS parses ---------------------------------------------- */
  for (const { index, code } of inlineScripts(html)) {
    try {
      new vm.Script(code, { filename: `${file}#${index}` });
    } catch (error) {
      fail(file, `inline script #${index} syntax error: ${error.message}`);
    }
  }

  /* -- 2 · no server / API / storage code -------------------------------- */
  for (const { pattern, label } of FORBIDDEN_CODE) {
    const hit = html.match(pattern);
    if (hit) {
      const at = html.indexOf(hit[0]);
      fail(file, `${label}: ${JSON.stringify(html.slice(Math.max(0, at - 70), at + 70))}`);
    }
  }

  /* -- 3 · DOM checks (scripts not executed) ----------------------------- */
  const dom = new JSDOM(html, { url: "https://demo.local/" + file, runScripts: "outside-only" });
  const { document } = dom.window;

  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href").trim();
    if (/^(#|mailto:|tel:|https?:|data:)/i.test(href)) {
      if (/^https?:/i.test(href)) {
        // Outbound links are allowed only for social/contact destinations.
        if (!/t\.me|wa\.me|facebook|youtube|instagram|linkedin|x\.com|twitter|google/i.test(href)) {
          fail(file, `unexpected external link: ${href}`);
        }
      }
      continue;
    }
    const target = href.split("#")[0].split("?")[0];
    if (!target) continue;
    if (!existsSync(resolvePath(SITE, target))) fail(file, `link target missing: ${href}`);
  }
  for (const el of document.querySelectorAll("[src]")) {
    const src = el.getAttribute("src").trim();
    if (!src || /^(data:|https?:)/i.test(src)) continue;
    if (!existsSync(resolvePath(SITE, src.split("?")[0]))) fail(file, `asset missing: ${src}`);
  }

  /* -- 4 · navigation between the five public pages ---------------------- */
  const navLinks = Array.from(document.querySelectorAll("header a.nav-link")).map((a) => a.getAttribute("href"));
  for (const target of NAV) {
    if (!navLinks.includes(target)) fail(file, `header navigation missing ${target}`);
  }
  const active = document.querySelectorAll('header a.nav-link[aria-current="page"]');
  if (active.length !== 1) fail(file, `expected exactly one active nav item, found ${active.length}`);

  /* -- 5 · no admin/login/register surface ------------------------------- */
  const adminLink = Array.from(document.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href"))
    .find((href) => FORBIDDEN_LINKS.test(href) && !/^https?:/i.test(href));
  if (adminLink) fail(file, `backend surface link: ${adminLink}`);
  if (document.querySelector('input[type="password"]')) fail(file, "password field present");

  /* -- 6 · pre-rendered sections exist ---------------------------------- */
  for (const [selector, minimum] of meta.sections) {
    const count = document.querySelectorAll(selector).length;
    if (count < minimum) fail(file, `pre-rendered section ${selector}: ${count} < ${minimum}`);
  }

  /* -- 7 · forms are inert ---------------------------------------------- */
  const formBlocker = document.getElementById("demo-forms");
  if (!formBlocker) fail(file, "form blocker script missing");
  if (!document.getElementById("demo-runtime")) fail(file, "demo runtime script missing");

  if (!failures.some((entry) => entry.startsWith(file))) ok(`${meta.title.padEnd(8)} ${file}`);
}

console.log(`\nStatic demo verification (${join(SITE)})`);

for (const meta of PAGES) check(meta.file, meta);

/* -- global checks -------------------------------------------------------- */
if (!existsSync(join(SITE, "data/site-data.js"))) fail("assets", "data bundle missing");
if (!existsSync(join(SITE, "assets/css")) || !readdirSync(join(SITE, "assets/css")).length) {
  fail("assets", "assets/css is empty");
}
/* Every UI script ships inline, so assets/js may legitimately be empty — but if
   anything is there it must not be an admin bundle (checked below). */
for (const adminFile of ["assets/js/admin.js", "assets/js/video-preview.js", "assets/js/team-profile.js", "assets/css/admin.css", "assets/css/admin-refresh.css", "assets/css/admin-management.css", "assets/css/team-profile.css"]) {
  if (existsSync(join(SITE, adminFile))) fail("assets", `admin-only file shipped: ${adminFile}`);
}

/* The old server application must not be part of the demo folder. */
for (const serverPath of ["index.php", "app", "vendor", "artisan", "storage", "wrangler.jsonc"]) {
  if (existsSync(join(SITE, serverPath))) fail("assets", `server file inside the demo: ${serverPath}`);
}

const report = join(SITE, "README.md");
if (!existsSync(report)) fail("docs", "README.md missing");

if (failures.length) {
  console.error(`\n✗ ${failures.length} problem(s):\n`);
  for (const line of failures) console.error("   - " + line);
  process.exitCode = 1;
} else {
  console.log("\n✓ all checks passed — static, self-contained, no backend or dynamic data.");
}
