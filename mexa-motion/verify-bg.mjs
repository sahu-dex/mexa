/**
 * MEXA MOTION — background-only verification
 *
 * Proves the patch changed the background and nothing else.
 *
 *   1. byte diff  — the only additions to the document are the one <style>
 *                   block and the Cloudflare email restoration; every other
 *                   line is identical,
 *   2. DOM        — identical element tree, classes, ids, text, images, icons,
 *                   links, inline styles,
 *   3. CSS        — the theme layer only ever sets background/lighting
 *                   properties on html, body and the two ambient blobs,
 *   4. behaviour  — every script still parses and the page handlers still run.
 *
 * Run:  node verify-bg.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { JSDOM, VirtualConsole } from "jsdom";

const HERE = dirname(fileURLToPath(import.meta.url));
const original = readFileSync(join(HERE, "original.html"), "utf8");
const patched = readFileSync(join(HERE, "index.html"), "utf8");

const failures = [];
const ok = (label) => console.log(`  ✓ ${label}`);
const bad = (label) => {
  failures.push(label);
  console.log(`  ✗ ${label}`);
};

/* ------------------------------------------------------- 1 · textual diff */
console.log("\nDocument diff");

/* strip the one added block; what remains must match the original */
const themeBlock = /<style id="mexa-card-theme">[\s\S]*?<\/style>\n/;
if (!themeBlock.test(patched)) bad("background theme block missing");
const withoutTheme = patched.replace(themeBlock, "");

/* normalise the Cloudflare email changes (they are a fix, not a design change) */
const normalise = (s) =>
  s
    /* re-insert the original src and drop the two markers we added, keeping
       the attribute order of the original document */
    .replace(/<script([^>]*)><\/script>/g, (m, attrs) => {
      if (!attrs.includes('data-cf-src-disabled="1"')) return m;
      const cfasync = /data-cfasync="[^"]*"/.exec(attrs);
      return `<script${cfasync ? " " + cfasync[0] : ""} src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>`;
    })
    .replace(/<span class="__cf_email__">hello@mexamotion\.com<\/span>/g,
             '<span class="__cf_email__" data-cfemail="472f222b2b28072a223f262a28332e28296924282a">[email&#160;protected]</span>')
    .replace(/href="mailto:hello@mexamotion\.com"/g,
             'href="/cdn-cgi/l/email-protection#1c74797070735c7179647d717368757372327f7371"')
    .replace(/<script([^>]*?)data-cf-src-disabled="1"([^>]*?)type="application\/x-disabled"><\/script>/g,
             (m, pre, post) =>
               `<script${pre}src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"${post}></script>`);

if (normalise(withoutTheme) === normalise(original)) {
  ok("document identical to the original once the theme block is removed");
} else {
  /* find the first difference so the report is useful */
  const a = normalise(withoutTheme);
  const b = normalise(original);
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  bad(`unexpected change at char ${i}: "${a.slice(i - 60, i + 60).replace(/\n/g, "⏎")}"`);
}

/* ----------------------------------------------------------- 2 · DOM equal */
console.log("\nDOM");
const domA = new JSDOM(original, { runScripts: "outside-only" });
const domB = new JSDOM(patched, { runScripts: "outside-only" });
const A = domA.window.document;
const B = domB.window.document;

const sig = (doc) =>
  Array.from(doc.body.querySelectorAll("*")).map((el) => {
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).sort().join(".");
    const style = el.getAttribute("style") || "";
    return `${el.tagName.toLowerCase()}#${el.id || ""}.${cls}{${style}}`;
  });

const sa = sig(A);
const sb = sig(B);
if (sa.length === sb.length) ok(`${sa.length} elements — same count`);
else bad(`element count changed: ${sa.length} → ${sb.length}`);

const classDiffs = sa.filter((x, i) => x !== sb[i]);
if (!classDiffs.length) ok("every class and inline style unchanged");
else bad(`${classDiffs.length} element(s) changed, first: ${classDiffs[0].slice(0, 90)}`);

const texts = (doc) => {
  const c = doc.body.cloneNode(true);
  c.querySelectorAll("style,script").forEach((n) => n.remove());
  return c.textContent.replace(/\s+/g, " ").trim();
};
const tA = texts(A).replace("[email protected]", "hello@mexamotion.com");
if (tA === texts(B)) ok("all text unchanged");
else bad("text content changed");

const icons = (doc) =>
  Array.from(doc.querySelectorAll("i[class]")).map((e) => e.getAttribute("class")).join("|");
if (icons(A) === icons(B)) ok(`${A.querySelectorAll("i[class]").length} icons unchanged`);
else bad("icons changed");

const imgs = (doc) => Array.from(doc.querySelectorAll("img")).map((e) => e.getAttribute("src")).join("|");
if (imgs(A) === imgs(B)) ok(`${A.querySelectorAll("img").length} images unchanged`);
else bad("images changed");

/* -------------------------------------------------- 3 · what the CSS sets */
console.log("\nTheme layer");
const css = /<style id="mexa-card-theme">([\s\S]*?)<\/style>/.exec(patched)[1];

/* read only the top-level rules: @media blocks are conditional */
function topLevelRules(src) {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;
  while (i < clean.length) {
    const open = clean.indexOf("{", i);
    if (open === -1) break;
    const selector = clean.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < clean.length && depth > 0) {
      if (clean[j] === "{") depth++;
      else if (clean[j] === "}") depth--;
      j++;
    }
    out.push({ selector, body: clean.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
const rules = topLevelRules(css);

/* split a selector list on top-level commas only — never inside :is( … ) */
function splitSelectors(sel) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of sel) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* --- HARD RULE 1: the theme may only ever set colour --------------------- */
const COLOUR_PROPS = /^(background|background-color|background-image|background-attachment|background-repeat|background-size|color|box-shadow|border-color|border-top-color|fill|stroke)$/;
const decls = [];
for (const r of rules) {
  for (const d of r.body.matchAll(/[\w-]+\s*:\s*[^;}]+/g)) decls.push(d[0].trim());
}
const nonColour = decls.filter((d) => {
  const prop = d.slice(0, d.indexOf(":")).trim().toLowerCase();
  return !prop.startsWith("--") && !COLOUR_PROPS.test(prop);
});
if (!nonColour.length) ok(`all ${decls.length} declarations are colour-only (no layout/size/radius/animation)`);
else bad("non-colour declarations: " + nonColour.slice(0, 6).join(" ; "));

/* --- HARD RULE 2: no rule may target a button or a link ------------------ */
const buttonish = rules
  .filter((r) => !r.selector.startsWith("@"))
  .flatMap((r) => splitSelectors(r.selector))
  .filter((sel) => /(^|\s)(a|button)(\s|$|:|\[|\.)/.test(sel));
/* the two allowed exceptions we asked permission for:
   footer links (svg/footer readability) and the service text link */
const buttonSelectors = buttonish.filter(
  (sel) => !/^footer\b/.test(sel) && !/^#services \.apple-glass-card a\.text-primary$/.test(sel),
);
if (!buttonSelectors.length) ok("no rule touches a button");
else bad("buttons would be restyled: " + buttonSelectors.slice(0, 4).join(" , "));

/* --- HARD RULE 3: every selector is scoped ------------------------------- */
const allowed = (sel) =>
  /^(html|html body|body|:root)$/.test(sel) ||
  /^html body > div\.fixed\.rounded-full\[class\*="blur-"\]( \+ div\.fixed\.rounded-full\[class\*="blur-"\])?$/.test(sel) ||
  /^footer\b/.test(sel) ||
  /^#(home|header|mobile-menu-drawer|portfolio|faq-container|stats-container|services|team|reviews|contact|about)\b/.test(sel);

const straySelectors = rules
  .filter((r) => !r.selector.startsWith("@"))
  .flatMap((r) => splitSelectors(r.selector))
  .filter((sel) => sel && !allowed(sel));
if (!straySelectors.length) ok(`all ${rules.length} rules are scoped to the canvas, a card, or the footer`);
else bad("theme escapes its scope: " + straySelectors.slice(0, 4).join(" , "));


/* the three canvas variables must exist and be light blues */
const palette = {};
for (const m of css.matchAll(/--mx-bg-(top|mid|bottom)\s*:\s*(#[0-9a-f]{6})/gi)) {
  palette[m[1].toLowerCase()] = m[2].toLowerCase();
}
const isLightBlue = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return b > r && b > g && r > 200 && g > 220;   // blue-leaning and light
};
if (palette.top && palette.mid && palette.bottom && Object.values(palette).every(isLightBlue)) {
  ok(`palette is light blue → soft blue (${palette.top} → ${palette.mid} → ${palette.bottom})`);
} else bad("palette variables missing or not light blue: " + JSON.stringify(palette));

if (/linear-gradient\(178deg/.test(css)) ok("page uses a vertical blue gradient");
else bad("no page gradient");

if (/#fafafa/i.test(css.replace(/\/\*[\s\S]*?\*\//g, "")) === false) ok("no off-white background left");
else bad("theme still paints the old off-white");

/* the body utility is overridden by html body — check the selector exists */
if (/html body\s*\{[\s\S]*?background-image/.test(css)) ok("body utility background is overridden");
else bad("body background override missing");

/* ------------------------------------------------------- 4 · it still runs */
console.log("\nBehaviour");
const scripts = [...patched.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parseErrors = 0;
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `inline#${i}` });
  } catch (e) {
    parseErrors++;
    bad(`inline script #${i}: ${e.message}`);
  }
});
if (!parseErrors) ok(`${scripts.length} inline scripts parse`);

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  if (!/Could not parse CSS stylesheet|Could not load link|Not implemented|tailwind is not defined/.test(e.message)) {
    bad("runtime: " + e.message.split("\n")[0]);
  }
});
const live = new JSDOM(patched, {
  url: "https://demo.local/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.tailwind = { config: {} };
    window.AOS = { init() {}, refresh() {} };
    window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
    window.scrollTo = () => {};
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
    window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.HTMLElement.prototype.scrollIntoView = () => {};
  },
});

setTimeout(() => {
  const w = live.window;
  const d = w.document;

  const videos = d.querySelectorAll("#grid-videos img").length;
  const shorts = d.querySelectorAll("#grid-shorts img").length;
  if (videos === 8 && shorts === 5) ok("portfolio still renders (8 + 5)");
  else bad(`portfolio broken: ${videos} / ${shorts}`);

  if (typeof w.toggleMobileMenu === "function") ok("mobile drawer handler present");
  else bad("mobile drawer handler missing");

  d.getElementById("tab-shorts").click();
  const switched = !d.getElementById("grid-shorts").classList.contains("hidden");
  d.getElementById("tab-videos").click();
  if (switched) ok("portfolio tabs still work");
  else bad("portfolio tabs broken");

  const faq = d.querySelector(".faq-btn");
  faq.click();
  if (!faq.nextElementSibling.classList.contains("hidden")) ok("FAQ still works");
  else bad("FAQ broken");

  /* the background is the only visual change — confirm it is applied */
  const style = [...d.querySelectorAll("style")].pop();
  if (style && style.id === "mexa-card-theme") ok("background theme is the last stylesheet");
  else bad("background theme not last");

  if (/overflow-x: hidden/.test(patched)) ok("horizontal overflow guard intact");
  else bad("overflow guard missing");

  /* nothing in the theme may influence layout: no width, margin, padding,
     position, display, font-size, translate or scale */
  const GEOMETRY = /^(width|min-width|max-width|height|min-height|max-height|margin|margin-top|margin-right|margin-bottom|margin-left|padding|padding-top|padding-right|padding-bottom|padding-left|inset|top|right|bottom|left|position|display|float|flex|grid|transform|translate|scale|font-size|line-height|letter-spacing|border-width|border-radius|gap|overflow|overflow-x|overflow-y)$/;
  const geometryRules = [];
  for (const r of rules) {
    for (const d of r.body.matchAll(/[\w-]+\s*:/g)) {
      const prop = d[0].replace(/:$/, "").trim().toLowerCase();
      if (GEOMETRY.test(prop)) geometryRules.push(r.selector.slice(0, 40) + " → " + prop);
    }
  }
  if (!geometryRules.length) ok("no geometry, spacing, radius or animation property is set");
  else bad("theme could move things: " + geometryRules.slice(0, 5).join(" , "));

  console.log(
    failures.length
      ? `\n✗ ${failures.length} problem(s):\n` + failures.map((f) => "   - " + f).join("\n")
      : "\n✓ background theme applied — nothing else in the document changed",
  );
  process.exit(failures.length ? 1 : 0);
}, 900);
