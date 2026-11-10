/**
 * Builds the standalone static HTML demo in `static-site/`.
 *
 * For every page:
 *   1. render the untouched Blade template (blade.mjs) for a pre-render pass,
 *   2. execute the page in jsdom with its data scripts intact, so the page's
 *      own render functions produce the service cards, portfolio grids, team
 *      roster and review list (prerender.mjs),
 *   3. capture that markup,
 *   4. re-render the template for the shipped page, apply the final transforms
 *      (scripts.mjs: data scripts removed, UI scripts kept, forms inert),
 *   5. splice the captured markup into the shipped page and write it out.
 *
 * Run with:  node scripts/static-demo/build.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderPage, ROUTES } from "./blade.mjs";
import { transformScripts, injectRuntime, replaceOnce } from "./scripts.mjs";
import { prerender } from "./prerender.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");
const OUT = join(ROOT, "static-site");
const DATA_SCRIPT = "data/site-data.js";

const PAGES = [
  { file: "index.html", template: "home" },
  { file: "work.html", template: "work" },
  { file: "service.html", template: "service" },
  { file: "team.html", template: "team" },
  { file: "review.html", template: "reviews" },
  { file: "book.html", template: "booking" },
];

const siteData = JSON.parse(readFileSync(join(OUT, "data/site-data.json"), "utf8"));

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function baseTokens(phase) {
  return {
    assetVersion: "1",
    publicVideosJson: JSON.stringify(siteData.videos),
    serviceIntro: siteData.content.services_intro,
    routes: ROUTES,
    bootstrapHtml:
      phase === "prerender"
        ? '<script id="demo-bridge">\n' +
          `window.__MM_SNAPSHOT__ = ${JSON.stringify(prerenderSnapshot(siteData))};\n` +
          `window.__MM_DEMO_DATA__ = ${JSON.stringify(siteData)};\n` +
          "</script>"
        : '<script id="demo-bridge"></script>',
  };
}

/** API-shaped snapshot the page scripts expect (same shape as the Laravel one). */
function prerenderSnapshot(data) {
  return {
    "/api/public/content": { ...data.content, purchase: data.purchase },
    "/api/public/services": { services: data.services },
    "/api/public/packages": { packages: data.packages },
    "/api/public/team": data.team,
    "/api/public/work": data.work,
    "/api/public/reviews": data.reviews,
    "/api/public/contact": data.contact,
    "/api/public/videos": { videos: data.videos },
  };
}

function writeDataBundle() {
  const bundle = `/* Static demo content — generated from database/seeders/data/site-snapshot.json.
   The standalone demo has no backend, database or API: this file is the only
   source of content and it is read-only. */
window.__MM_DEMO_DATA__ = ${JSON.stringify(siteData)};
`;
  writeFileSync(join(OUT, DATA_SCRIPT), bundle);
}

function copyAssets() {
  const cssOut = join(OUT, "assets/css");
  const jsOut = join(OUT, "assets/js");
  mkdirSync(cssOut, { recursive: true });
  mkdirSync(jsOut, { recursive: true }); // removed again if nothing is left

  for (const name of readdirSync(join(ROOT, "public/css"))) {
    if (name.endsWith(".css")) copyFileSync(join(ROOT, "public/css", name), join(cssOut, name));
  }
  for (const adminOnly of ["admin.css", "admin-refresh.css", "admin-management.css", "team-profile.css"]) {
    rmSync(join(cssOut, adminOnly), { force: true });
  }
  // The public pages keep their UI scripts; admin-only bundles are not shipped.
  const ADMIN_JS = ["admin.js", "video-preview.js", "team-profile.js"];
  for (const name of readdirSync(join(ROOT, "public/js"))) {
    if (!name.endsWith(".js") || ADMIN_JS.includes(name)) continue;
    copyFileSync(join(ROOT, "public/js", name), join(jsOut, name));
  }
  for (const name of readdirSync(jsOut)) {
    if (ADMIN_JS.includes(name)) rmSync(join(jsOut, name), { force: true });
  }
  if (!readdirSync(jsOut).length) rmdirSync(jsOut);
}

/**
 * Splices captured markup back into the shipped page. Only the inner HTML of
 * the captured containers is touched; attributes, classes and the surrounding
 * markup stay exactly as rendered from the template.
 */
function applyPrerendered(html, { htmlById, textById }, page) {
  for (const [id, inner] of Object.entries(htmlById)) {
    const open = new RegExp(`<([a-zA-Z0-9-]+)[^>]*\\bid="${id}"[^>]*>`);
    const match = html.match(open);
    if (!match) throw new Error(`[${page}] cannot find #${id} to pre-render`);
    const tag = match[1];
    const contentStart = match.index + match[0].length;
    // Walk nested same-name tags to find the matching close tag.
    const tagRe = new RegExp(`<(/?)${tag}\\b`, "gi");
    tagRe.lastIndex = contentStart;
    let depth = 1;
    let closeAt = -1;
    let next;
    while ((next = tagRe.exec(html))) {
      depth += next[1] === "/" ? -1 : 1;
      if (depth === 0) {
        closeAt = next.index;
        break;
      }
    }
    if (closeAt === -1) throw new Error(`[${page}] cannot find closing </${tag}> for #${id}`);
    html = html.slice(0, contentStart) + "\n" + inner + "\n" + html.slice(closeAt);
  }

  for (const [id, value] of Object.entries(textById)) {
    if (!value) continue;
    const re = new RegExp(`(<([a-zA-Z0-9-]+)[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)(</\\2>)`);
    const match = html.match(re);
    if (!match) throw new Error(`[${page}] cannot find #${id} text target`);
    const markup = /<[a-z]/i.test(value) ? value : escapeHtml(value);
    html = html.slice(0, match.index) + match[1] + markup + match[4] + html.slice(match.index + match[0].length);
  }
  return html;
}

async function buildPage({ file, template }) {
  // -- pass 1: execute the page to capture its data-driven markup ------------
  const prerenderHtml = renderPage({ root: ROOT, page: template, tokens: baseTokens("prerender"), phase: "prerender" });
  const captured = await prerender({ html: transformScripts(prerenderHtml, template, "prerender"), page: template });

  // -- pass 2: the page that ships ------------------------------------------
  const finalRaw = renderPage({ root: ROOT, page: template, tokens: baseTokens("final"), phase: "final" });
  let html = transformScripts(finalRaw, template, "final");
  html = applyPrerendered(html, captured, template);
  html = injectRuntime(html, template, DATA_SCRIPT);

  if (/window\.__MM_SNAPSHOT__|!!\s*\$[a-zA-Z_]|@include\s*\(|\{\{/.test(html)) {
    throw new Error(`[${template}] server syntax left in the static page`);
  }

  writeFileSync(join(OUT, file), html);
  console.log(`  ${file.padEnd(14)} ${(html.length / 1024).toFixed(0)} KB  <- ${template}.blade.php`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeDataBundle();
  copyAssets();
  console.log("building static demo pages:");
  for (const page of PAGES) await buildPage(page);
  console.log("done ->", OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
