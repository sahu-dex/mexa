/**
 * Isolated-files test.
 *
 * Copies the six shipped pages into an empty temporary folder — no assets/, no
 * data/, no stylesheets — and loads each one over file:// with scripts enabled.
 * Styles, content, navigation and behaviour must all still work.
 *
 * Run:  node scripts/static-demo/test-isolated.mjs
 */

import { readFileSync, copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole, ResourceLoader } from "jsdom";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "../../static-site");
const PAGES = ["index", "work", "service", "team", "review", "book"];
const dir = mkdtempSync(join(tmpdir(), "mexa-demo-"));

for (const page of PAGES) copyFileSync(join(SITE, `${page}.html`), join(dir, `${page}.html`));
const files = readdirSync(dir);
if (files.length !== PAGES.length) throw new Error("unexpected files copied: " + files.join(", "));

const missing = [];
class LocalOnly extends ResourceLoader {
  fetch(url) {
    if (!url.startsWith("file://")) return null;
    try {
      return Promise.resolve(readFileSync(decodeURIComponent(url.replace("file://", "")).split("?")[0]));
    } catch {
      missing.push(url); // any external file would show up here
      return null;
    }
  }
}

let failed = 0;
for (const page of PAGES) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    if (!/Could not parse CSS stylesheet/.test(error.message)) errors.push(error.message.split("\n")[0]);
  });
  const dom = new JSDOM(readFileSync(join(dir, `${page}.html`), "utf8"), {
    url: `file://${dir}/${page}.html`,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    resources: new LocalOnly(),
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const { window } = dom;
  const { document } = window;
  const data = window.__MM_DEMO_DATA__ || {};
  const styles = document.querySelectorAll("style").length;
  const nav = document.querySelectorAll("header a.nav-link").length;
  // book.html has no card grid: its content target is the ticket summary
  const cards = document.querySelectorAll(".sv2-card,.svc-card,.t3-card,.rvx-card,.pf-card,.wk-rc").length;
  const content = page === "book" ? document.querySelectorAll("#tk-sum .tk-sum-name").length : cards;
  const problems = [...errors];
  if (!Object.keys(data).length) problems.push("content bundle missing");
  if (styles < 5) problems.push(`styles not inlined (${styles})`);
  if (nav !== 5) problems.push(`navigation broken (${nav} links)`);
  if (!content) problems.push("content not rendered");
  if (problems.length) failed++;
  console.log(
    `${problems.length ? "  ✗" : "  ✓"} ${page.padEnd(8)} styles=${styles} nav=${nav} content=${content}` +
      (problems.length ? " — " + problems[0] : ""),
  );
  window.close();
}
if (missing.length) {
  failed++;
  console.log("  ✗ pages still request external files: " + missing.slice(0, 3).join(", "));
}

rmSync(dir, { recursive: true, force: true });
console.log(
  failed
    ? `\n✗ ${failed} problem(s) — the pages are not self-contained`
    : "\n✓ six isolated HTML files: styles, content, navigation and scripts all work",
);
process.exit(failed ? 1 : 0);
