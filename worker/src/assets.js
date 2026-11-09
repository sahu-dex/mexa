// Static public assets imported directly as text modules via wrangler.jsonc `rules`.
// Served at the Worker edge with zero Durable Object round-trip and zero external storage needed.

import cssAdminManagement from "../../public/css/admin-management.css";
import cssAdminRefresh from "../../public/css/admin-refresh.css";
import cssAdmin from "../../public/css/admin.css";
import cssHeaderRestoration from "../../public/css/header-restoration.css";
import cssHomeHero from "../../public/css/home-hero.css";
import cssMobileMenu from "../../public/css/mobile-menu.css";
import cssServiceBookingTheme from "../../public/css/service-booking-theme.css";
import cssSiteBackgroundTheme from "../../public/css/site-background-theme.css";
import cssSiteBlueGlassTheme from "../../public/css/site-blue-glass-theme.css";
import cssSiteBrandLighting from "../../public/css/site-brand-lighting.css";
import cssSiteDarkTheme from "../../public/css/site-dark-theme.css";
import cssSiteHeaderLockup from "../../public/css/site-header-lockup.css";
import cssSiteImageFallbacks from "../../public/css/site-image-fallbacks.css";
import cssSitePageHero from "../../public/css/site-page-hero.css";
import cssSitePerformance from "../../public/css/site-performance.css";
import cssSiteTypography from "../../public/css/site-typography.css";
import cssSiteVendorBase from "../../public/css/site-vendor-base.css";
import cssTeamProfile from "../../public/css/team-profile.css";
import cssVideoLibrary from "../../public/css/video-library.css";
import cssVideoPreview from "../../public/css/video-preview.css";
import cssWorkVendorOverrides from "../../public/css/work-vendor-overrides.css";

import jsAdmin from "../../public/js/admin.js";
import jsVideoPreview from "../../public/js/video-preview.js";

const CSS_TYPE = "text/css; charset=utf-8";
const JS_TYPE = "application/javascript; charset=utf-8";

export const PUBLIC_ASSETS = new Map([
  ["/css/admin-management.css", { body: cssAdminManagement, type: CSS_TYPE }],
  ["/css/admin-refresh.css", { body: cssAdminRefresh, type: CSS_TYPE }],
  ["/css/admin.css", { body: cssAdmin, type: CSS_TYPE }],
  ["/css/header-restoration.css", { body: cssHeaderRestoration, type: CSS_TYPE }],
  ["/css/home-hero.css", { body: cssHomeHero, type: CSS_TYPE }],
  ["/css/mobile-menu.css", { body: cssMobileMenu, type: CSS_TYPE }],
  ["/css/service-booking-theme.css", { body: cssServiceBookingTheme, type: CSS_TYPE }],
  ["/css/site-background-theme.css", { body: cssSiteBackgroundTheme, type: CSS_TYPE }],
  ["/css/site-blue-glass-theme.css", { body: cssSiteBlueGlassTheme, type: CSS_TYPE }],
  ["/css/site-brand-lighting.css", { body: cssSiteBrandLighting, type: CSS_TYPE }],
  ["/css/site-dark-theme.css", { body: cssSiteDarkTheme, type: CSS_TYPE }],
  ["/css/site-header-lockup.css", { body: cssSiteHeaderLockup, type: CSS_TYPE }],
  ["/css/site-image-fallbacks.css", { body: cssSiteImageFallbacks, type: CSS_TYPE }],
  ["/css/site-page-hero.css", { body: cssSitePageHero, type: CSS_TYPE }],
  ["/css/site-performance.css", { body: cssSitePerformance, type: CSS_TYPE }],
  ["/css/site-typography.css", { body: cssSiteTypography, type: CSS_TYPE }],
  ["/css/site-vendor-base.css", { body: cssSiteVendorBase, type: CSS_TYPE }],
  ["/css/team-profile.css", { body: cssTeamProfile, type: CSS_TYPE }],
  ["/css/video-library.css", { body: cssVideoLibrary, type: CSS_TYPE }],
  ["/css/video-preview.css", { body: cssVideoPreview, type: CSS_TYPE }],
  ["/css/work-vendor-overrides.css", { body: cssWorkVendorOverrides, type: CSS_TYPE }],
  ["/js/admin.js", { body: jsAdmin, type: JS_TYPE }],
  ["/js/video-preview.js", { body: jsVideoPreview, type: JS_TYPE }],
]);

function quickHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export const ASSET_VERSIONS = {
  "css/header-restoration.css": quickHash(cssHeaderRestoration),
  "css/home-hero.css": quickHash(cssHomeHero),
};

export function tryServePublicAsset(request, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }
  const asset = PUBLIC_ASSETS.get(pathname);
  if (!asset) {
    return null;
  }
  const etag = `"${quickHash(asset.body)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
  return new Response(request.method === "HEAD" ? null : asset.body, {
    status: 200,
    headers: {
      "Content-Type": asset.type,
      ETag: etag,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
