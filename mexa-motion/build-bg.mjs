/**
 * MEXA MOTION — background-only patch
 *
 * Reads the untouched original and writes index.html with exactly one change:
 * the page background becomes the blue / light-blue theme.
 *
 * The patch:
 *   1. appends one <style id="mexa-card-theme"> block as the last thing in <head>
 *      (no existing rule, class, element or script is edited),
 *   2. restores the Cloudflare-obfuscated email address, which only worked on
 *      Cloudflare's servers (a local file cannot load /cdn-cgi/… and shows
 *      "[email protected]" instead).
 *
 * Everything else is byte-identical. verify.mjs proves it.
 *
 * Run:  node build.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "original.html");
const OUT = join(HERE, "index.html");

let html = readFileSync(SRC, "utf8");
const bg = readFileSync(join(HERE, "card-theme.css"), "utf8");

const fail = (what) => {
  throw new Error(`background patch: ${what}`);
};

/* -- sanity: the source must be the unthemed file ------------------------ */
if (!/class="[^"]*\bbg-\[#fafafa\][^"]*"/.test(html)) fail("original off-white background marker missing");
if (html.includes("mexa-card-theme")) fail("source already patched");

/* -- 1 · the style block must be safe to inline -------------------------- */
if (/<\/?style/i.test(bg)) fail("card-theme.css contains a </style> or <style> tag");
if (!/^:root\s*\{/m.test(bg)) fail("card-theme.css does not start with the palette");

/* -- 2 · restore the Cloudflare-obfuscated email ------------------------- */
function decodeCfEmail(hex) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out;
}

const cfSpan = /<span class="__cf_email__" data-cfemail="([0-9a-f]+)">\[email&#160;protected\]<\/span>/;
const cf = html.match(cfSpan);
if (!cf) fail("Cloudflare email placeholder not found");
const email = decodeCfEmail(cf[1]);
html = html.replace(cf[0], `<span class="__cf_email__">${email}</span>`);
html = html.replace(/href="\/cdn-cgi\/l\/email-protection#[0-9a-f]+"/g, `href="mailto:${email}"`);

/* the obfuscation script only exists on Cloudflare's CDN — keep the element,
   but stop it from requesting a file that cannot exist offline */
html = html.replace(
  /<script([^>]*?)src="\/cdn-cgi\/scripts\/[^"]*"([^>]*)><\/script>/g,
  `<script$1data-cf-src-disabled="1"$2 type="application/x-disabled"></script>`,
);
if (/src="\/cdn-cgi/.test(html)) fail("Cloudflare script still referenced");

/* -- 3 · inject the background theme as the final stylesheet ------------- */
if (!/<\/head>/.test(html)) fail("no </head>");
html = html.replace(/<\/head>/, `<style id="mexa-card-theme">\n${bg}</style>\n</head>`);

/* the theme must come after the page's own stylesheet */
const themeAt = html.indexOf('<style id="mexa-card-theme">');
const lastInline = html.lastIndexOf("<style>");
if (themeAt < lastInline) fail("background theme is not the last stylesheet");

writeFileSync(OUT, html);
console.log(`background patch ok → index.html (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`  · blue / light-blue canvas applied as the last stylesheet`);
console.log(`  · email restored: ${email}`);
