/**
 * Minimal Blade renderer for the static demo build.
 *
 * The project's public pages only use a small Blade subset:
 *   @include, @if/@else/@endif, @foreach, {{ asset() }}, {{ route() }},
 *   {{ csrf_token() }}, {{ $serviceIntro }}, {!! $snapshotJson !!},
 *   {!! $bridgeScript !!}.
 *
 * This module expands that subset without touching CSS at-rules such as
 * @media, @supports, @keyframes or @font-face, which appear inside <style>.
 * All page content (text, markup, classes, inline CSS) is passed through
 * byte-for-byte so the rendered design stays identical.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Laravel route name -> static HTML file. */
export const ROUTES = {
  home: "index.html",
  service: "service.html",
  work: "work.html",
  reviews: "review.html",
  team: "team.html",
  booking: "book.html",
};

const PARTIALS = {
  "pages.partials.head-assets": "resources/views/pages/partials/head-assets.blade.php",
  "pages.partials.mobile-booking": "resources/views/pages/partials/mobile-booking.blade.php",
  "pages.partials.video-assets": "resources/views/pages/partials/video-assets.blade.php",
};

/** Public asset path (`css/x.css`, `js/y.js`) -> local demo path. */
export function assetPath(path) {
  return `assets/${String(path).replace(/^\/+/, "")}`;
}

function readPartial(name, root) {
  const rel = PARTIALS[name];
  if (!rel) throw new Error(`Unknown partial: ${name}`);
  return readFileSync(join(root, rel), "utf8");
}

export function renderHeadAssets(root, page, tokens) {
  let html = readPartial("pages.partials.head-assets", root);

  const homeBlock = html.match(/@if\s*\(\s*\$page\s*===\s*'home'\s*\)([\s\S]*?)@endif/);
  if (!homeBlock) throw new Error("head-assets: home conditional not found");
  html = page === "home" ? html.replace(homeBlock[0], homeBlock[1]) : html.replace(homeBlock[0], "");

  html = html.replace(/\{\{\s*csrf_token\(\)\s*\}\}/g, "");
  html = html.replace(/\s*<meta name="csrf-token"[^>]*>/g, "");
  html = html.replace(/\{\{\s*filemtime\(public_path\('[^']+'\)\)\s*\}\}/g, "1");
  html = html.replace(
    /\{\{\s*asset\('([^']+)'\)\s*\}\}/g,
    (_, path) => assetPath(path),
  );
  return html;
}

export function renderMobileBooking(root, tokens) {
  return readPartial("pages.partials.mobile-booking", root).replace(
    /\{\{\s*route\('([^']+)'\)\s*\}\}/g,
    (_, name) => tokens.routes[name] ?? "index.html",
  );
}

/**
 * @param {boolean} include true for the pre-render pass, false for the shipped
 *   page. The video catalog + preview loader belongs to the admin video modal,
 *   so the standalone demo drops it.
 */
export function renderVideoAssets(root, tokens, include) {
  if (!include) return "";
  return readPartial("pages.partials.video-assets", root)
    .replace(/\{!!\s*\$publicVideosJson\s*!!\}/g, () => tokens.publicVideosJson)
    .replace(
      /\{\{\s*asset\('([^']+)'\)\s*\}\}/g,
      (_, path) => assetPath(path),
    );
}

/**
 * Booking purchase blocks. The demo has no purchase settings configured, so
 * every `!empty($purchaseInfo[...])` branch resolves to its default/else path,
 * exactly like the production site does with an empty purchase section.
 */
function renderBookingPurchaseBlocks(html) {
  html = html.replace(
    /@if\s*\(!empty\(\$purchaseInfo\['heading'\]\)\)[\s\S]*?@endif/,
    () => '<h1 class="tk-h1">Book your <span>ticket</span></h1>',
  );
  html = html.replace(
    /\{\{\s*!empty\(\$purchaseInfo\['description'\]\)\s*\?\s*\$purchaseInfo\['description'\]\s*:\s*'[^']*'\s*\}\}/,
    () =>
      "Your selected service and package are already loaded. Add your project details and the ticket goes straight to the founder with status Pending.",
  );
  html = html.replace(
    /@if\s*\(!empty\(\$purchaseInfo\['instructions'\]\)[\s\S]*?<\/aside>\s*@endif/,
    "",
  );
  if (/@(if|else|elseif|endif|foreach|endforeach|php)\b/.test(html)) {
    throw new Error("booking: unhandled Blade directive left in template");
  }
  return html;
}

/**
 * Renders one page to HTML.
 *
 * @param {object} options
 * @param {string} options.root repository root
 * @param {string} options.page template name (home|work|service|team|reviews|booking)
 * @param {object} options.tokens replacement values
 * @param {"prerender"|"final"} [options.phase]
 */
export function renderPage({ root, page, tokens, phase = "final" }) {
  const file = join(root, "resources/views/pages", `${page}.blade.php`);
  let html = readFileSync(file, "utf8");

  html = html.replace(/@include\('pages\.partials\.head-assets'\)/g, () =>
    renderHeadAssets(root, page, tokens),
  );
  html = html.replace(/@include\('pages\.partials\.mobile-booking'\)/g, () =>
    renderMobileBooking(root, tokens),
  );
  html = html.replace(/@include\('pages\.partials\.video-assets'\)/g, () =>
    renderVideoAssets(root, tokens, phase === "prerender"),
  );

  if (page === "booking") html = renderBookingPurchaseBlocks(html);

  html = html.replace(/\{\{\s*\$serviceIntro\s*\}\}/g, () => tokens.serviceIntro);

  html = html.replace(
    /\{\{\s*route\('([^']+)'\)\s*\}\}/g,
    (_, name) => tokens.routes[name] ?? "index.html",
  );
  html = html.replace(
    /\{\{\s*asset\('([^']+)'\)\s*\}\}/g,
    (_, path) => assetPath(path),
  );
  html = html.replace(/\s*<meta name="csrf-token"[^>]*>/g, "");

  // The server-rendered bootstrap block (snapshot + bridge script).
  const bootstrap = html.match(
    /<script>\s*window\.__MM_SNAPSHOT__ = \{!! \$snapshotJson !!\};[\s\S]*?\{!! \$bridgeScript !!\}[\s\S]*?<\/script>/,
  );
  if (!bootstrap) throw new Error(`${page}: bootstrap script block not found`);
  html = html.replace(bootstrap[0], () => tokens.bootstrapHtml ?? "");

  const leftover = html.match(/@include|\{\{|\{!!/g);
  if (leftover) {
    throw new Error(`Unhandled Blade syntax in ${page}: ${leftover.slice(0, 5).join(", ")}`);
  }

  return html;
}
