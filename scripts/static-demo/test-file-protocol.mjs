/**
 * file:// smoke test.
 *
 * The demo must work by double-clicking index.html — no server at all. This
 * loads every page over the file: protocol with scripts enabled, allows only
 * file: sub-resources, and fails on any uncaught script error.
 *
 * Run:  node scripts/static-demo/test-file-protocol.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole, ResourceLoader } from "jsdom";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "../../static-site");
class L extends ResourceLoader {
  fetch(url) {
    if (!url.startsWith("file://")) return null;
    const p = decodeURIComponent(url.replace("file://","")).split("?")[0];
    try { return Promise.resolve(readFileSync(p)); } catch { return null; }
  }
}
let failed = 0;
for (const page of ["index","work","service","team","review","book"]) {
  const vc = new VirtualConsole();
  const errs = [];
  vc.on("jsdomError", e => { if (!/CSS stylesheet/.test(e.message)) errs.push(e.message.split("\n")[0]); });
  const dom = new JSDOM(readFileSync(`${SITE}/${page}.html`,"utf8"), {
    url: `file://${SITE}/${page}.html`, runScripts: "dangerously", pretendToBeVisual: true,
    virtualConsole: vc, resources: new L(),
  });
  await new Promise(r=>setTimeout(r,500));
  const w = dom.window, d = w.document;
  const data = (w.__MM_DEMO_DATA__||{});
  const cards = d.querySelectorAll(".sv2-card,.svc-card,.t3-card,.rvx-card,.pf-card,.wk-rc").length;
  if (!(data.services || []).length) errs.push("content bundle did not load");
  if (errs.length) failed++;
  console.log(
    `${errs.length ? "  ✗" : "  ✓"} ${page.padEnd(8)} services=${(data.services || []).length} cards=${cards}` +
      (errs.length ? ` — ${errs[0]}` : ""),
  );
  w.close();
}
console.log(failed ? `\n✗ ${failed} page(s) fail over file://` : "\n✓ every page runs from file:// with no script errors");
process.exit(failed ? 1 : 0);
