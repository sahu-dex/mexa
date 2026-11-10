/**
 * Single-file build step.
 *
 * The demo must survive with nothing but the six HTML documents. This module
 * folds every external dependency into the page itself:
 *
 *   · <link rel="stylesheet" href="…">  →  <style>…</style>
 *   · <script src="…">                  →  <script>…</script>
 *
 * Only local files inside static-site/ are inlined — remote images, video
 * posters and social links stay exactly as they are.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STYLESHEET = /<link\b([^>]*?)\bhref="([^"]+)"([^>]*)>/gi;
const SCRIPT = /<script\b([^>]*?)\bsrc="([^"]+)"([^>]*)><\/script>/gi;

/** Local path for a href/src, or null when it is remote/anchor/data. */
function localPath(ref) {
  if (!ref || /^(https?:|\/\/|data:|#|mailto:|tel:|javascript:)/i.test(ref)) return null;
  const clean = ref.split("#")[0].split("?")[0];
  return clean || null;
}

/** A CSS/JS block must never be able to close its own tag early. */
const guard = (code, tag) => code.replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");

/**
 * @param {string} html page markup
 * @param {string} siteDir folder the relative href/src resolve against
 * @param {string} page template name, for error messages
 */
export function inlineLocalAssets(html, siteDir, page) {
  let out = html;
  const inlined = [];

  out = out.replace(STYLESHEET, (tag, before, href, after) => {
    if (!/rel="stylesheet"/i.test(before) && !/rel="stylesheet"/i.test(after)) return tag;
    const rel = localPath(href);
    if (!rel) return tag;
    const file = join(siteDir, rel);
    if (!existsSync(file)) throw new Error(`[${page}] stylesheet not found: ${href}`);
    const media = /media="([^"]+)"/i.exec(before + after);
    const attr = media ? ` media="${media[1]}"` : "";
    inlined.push(rel);
    return `<style data-source="${rel}"${attr}>\n${guard(readFileSync(file, "utf8"), "style")}\n</style>`;
  });

  out = out.replace(SCRIPT, (tag, before, src, after) => {
    const rel = localPath(src);
    if (!rel) return tag;
    const file = join(siteDir, rel);
    if (!existsSync(file)) throw new Error(`[${page}] script not found: ${src}`);
    const keep = `${before} ${after}`.replace(/\bsrc="[^"]*"/gi, "").replace(/\s+/g, " ").trim();
    inlined.push(rel);
    return `<script${keep ? " " + keep : ""}>\n${guard(readFileSync(file, "utf8"), "script")}\n</script>`;
  });

  return { html: out, inlined };
}
