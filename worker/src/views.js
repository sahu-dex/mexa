// Renders the repository's untouched Laravel Blade templates (`resources/views/**/*.blade.php`)
// directly inside the Cloudflare Worker with 1:1 fidelity to PHP/Blade.

import tplAdminDashboard from "../../resources/views/admin/dashboard.blade.php";
import tplAdminLogin from "../../resources/views/admin/login.blade.php";
import tplAdminSetup from "../../resources/views/admin/setup.blade.php";
import tplError404 from "../../resources/views/errors/404.blade.php";
import tplPageBooking from "../../resources/views/pages/booking.blade.php";
import tplPageHome from "../../resources/views/pages/home.blade.php";
import tplPageReviews from "../../resources/views/pages/reviews.blade.php";
import tplPageService from "../../resources/views/pages/service.blade.php";
import tplPageTeamProfile from "../../resources/views/pages/team-profile.blade.php";
import tplPageTeam from "../../resources/views/pages/team.blade.php";
import tplPageWork from "../../resources/views/pages/work.blade.php";
import tplPartialHeadAssets from "../../resources/views/pages/partials/head-assets.blade.php";
import tplPartialMobileBooking from "../../resources/views/pages/partials/mobile-booking.blade.php";
import tplPartialVideoAssets from "../../resources/views/pages/partials/video-assets.blade.php";

import { ASSET_VERSIONS } from "./assets.js";
import { escapeHtml, isPhpEmpty, nl2brEscaped } from "./support.js";

const PAGE_TEMPLATES = {
  home: tplPageHome,
  service: tplPageService,
  work: tplPageWork,
  reviews: tplPageReviews,
  team: tplPageTeam,
  booking: tplPageBooking,
};

const NAMED_ROUTES = {
  home: "/",
  service: "/service",
  work: "/work",
  reviews: "/reviews",
  team: "/team",
  booking: "/book",
  "admin.setup": "/admin/setup",
  "admin.login": "/admin/login",
  "admin.dashboard": "/admin",
};

export function makeUrlBuilder(origin) {
  const cleanOrigin = String(origin || "").replace(/\/+$/, "");
  return function buildUrl(path = "/") {
    const raw = String(path ?? "");
    if (raw === "" || raw === "/") {
      return cleanOrigin;
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    return `${cleanOrigin}/${raw.replace(/^\/+/, "")}`;
  };
}

function csrfHiddenInput(csrfToken) {
  return `<input type="hidden" name="_token" value="${escapeHtml(csrfToken)}" autocomplete="off">`;
}

function renderHeadAssetsPartial(page, csrfToken, url) {
  let html = tplPartialHeadAssets;
  if (page === "home") {
    html = html.replace(
      /@if\s*\(\$page\s*===\s*'home'\)([\s\S]*?)@endif/,
      "$1",
    );
  } else {
    html = html.replace(/@if\s*\(\$page\s*===\s*'home'\)[\s\S]*?@endif\s*/, "");
  }
  html = html.replace(/\{\{\s*csrf_token\(\)\s*\}\}/g, () => escapeHtml(csrfToken));
  html = html.replace(
    /\{\{\s*filemtime\(public_path\('([^']+)'\)\)\s*\}\}/g,
    (_, assetPath) => escapeHtml(ASSET_VERSIONS[assetPath] ?? "1"),
  );
  html = html.replace(
    /\{\{\s*asset\('([^']+)'\)\s*\}\}/g,
    (_, assetPath) => escapeHtml(url(assetPath)),
  );
  return html;
}

function renderMobileBookingPartial(url) {
  return tplPartialMobileBooking.replace(
    /\{\{\s*route\('([^']+)'\)\s*\}\}/g,
    (_, name) => escapeHtml(url(NAMED_ROUTES[name] ?? "/")),
  );
}

function renderVideoAssetsPartial(publicVideosJson, url) {
  return tplPartialVideoAssets
    .replace(/\{!!\s*\$publicVideosJson\s*!!\}/g, () => publicVideosJson)
    .replace(
      /\{\{\s*asset\('([^']+)'\)\s*\}\}/g,
      (_, assetPath) => escapeHtml(url(assetPath)),
    );
}

function renderBookingPurchaseBlocks(html, purchaseInfo) {
  const info = purchaseInfo && typeof purchaseInfo === "object" && !Array.isArray(purchaseInfo)
    ? purchaseInfo
    : {};

  const headingHtml = !isPhpEmpty(info.heading)
    ? `<h1 class="tk-h1">${escapeHtml(info.heading)}</h1>`
    : `<h1 class="tk-h1">Book your <span>ticket</span></h1>`;

  const defaultDesc =
    "Your selected service and package are already loaded. Add your project details and the ticket goes straight to the founder with status Pending.";
  const leadText = !isPhpEmpty(info.description) ? info.description : defaultDesc;

  let out = html.replace(
    /@if\s*\(!empty\(\$purchaseInfo\['heading'\]\)\)[\s\S]*?@endif/,
    () => headingHtml,
  );

  out = out.replace(
    /\{\{\s*!empty\(\$purchaseInfo\['description'\]\)\s*\?\s*\$purchaseInfo\['description'\]\s*:\s*'[^']*'\s*\}\}/g,
    () => escapeHtml(leadText),
  );

  const hasNote =
    !isPhpEmpty(info.instructions) ||
    !isPhpEmpty(info.button_link) ||
    !isPhpEmpty(info.whatsapp) ||
    !isPhpEmpty(info.telegram) ||
    !isPhpEmpty(info.email) ||
    !isPhpEmpty(info.phone);

  const contactFields = [
    ["whatsapp", "WhatsApp"],
    ["telegram", "Telegram"],
    ["email", "Email"],
    ["phone", "Phone"],
  ];

  let asideHtml = "";
  if (hasNote) {
    const parts = ['<aside class="tk-box tk-purchase-note">'];
    if (!isPhpEmpty(info.instructions)) {
      const iHeading = info.instructions_heading ?? "Order information";
      parts.push(`<h2 class="tk-box-title">${escapeHtml(iHeading)}</h2>`);
      parts.push(`<p class="tk-box-hint">${nl2brEscaped(info.instructions)}</p>`);
    }
    for (const [field, label] of contactFields) {
      if (!isPhpEmpty(info[field])) {
        parts.push(
          `<p class="tk-box-hint"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(info[field])}</p>`,
        );
      }
    }
    if (!isPhpEmpty(info.button_link)) {
      const btnText = info.button_text ?? "Contact to order";
      parts.push(
        `<a class="tk-submit inline-flex items-center justify-center gap-2" href="${escapeHtml(info.button_link)}" target="_blank" rel="noopener">${escapeHtml(btnText)} <span>→</span></a>`,
      );
    }
    parts.push("</aside>");
    asideHtml = parts.join("\n                    ");
  }

  out = out.replace(
    /@if\s*\(!empty\(\$purchaseInfo\['instructions'\]\)[\s\S]*?<\/aside>\s*@endif/,
    () => asideHtml,
  );

  return out;
}

export function renderPublicPage({
  page,
  origin,
  csrfToken,
  snapshotJson,
  bridgeScript,
  publicVideosJson,
  serviceIntro,
  purchaseInfo,
}) {
  const url = makeUrlBuilder(origin);
  let html = PAGE_TEMPLATES[page];
  if (!html) {
    throw new Error(`Unknown public page template: ${page}`);
  }

  html = html
    .replace(
      /@include\('pages\.partials\.head-assets'\)/g,
      () => renderHeadAssetsPartial(page, csrfToken, url),
    )
    .replace(
      /@include\('pages\.partials\.mobile-booking'\)/g,
      () => renderMobileBookingPartial(url),
    )
    .replace(
      /@include\('pages\.partials\.video-assets'\)/g,
      () => renderVideoAssetsPartial(publicVideosJson, url),
    );

  if (page === "booking") {
    html = renderBookingPurchaseBlocks(html, purchaseInfo);
  }

  if (page === "service") {
    html = html.replace(/\{\{\s*\$serviceIntro\s*\}\}/g, () => escapeHtml(serviceIntro));
  }

  html = html
    .replace(
      /\{\{\s*asset\('([^']+)'\)\s*\}\}/g,
      (_, assetPath) => escapeHtml(url(assetPath)),
    )
    .replace(
      /\{\{\s*route\('([^']+)'\)\s*\}\}/g,
      (_, routeName) => escapeHtml(url(NAMED_ROUTES[routeName] ?? "/")),
    )
    .replace(/\{!!\s*\$snapshotJson\s*!!\}/g, () => snapshotJson)
    .replace(/\{!!\s*\$bridgeScript\s*!!\}/g, () => bridgeScript);

  return html;
}

export function renderAdminSetup({ origin, csrfToken, errorMessage = "", old = {} }) {
  const url = makeUrlBuilder(origin);
  let html = tplAdminSetup;
  html = html.replace(
    /@if\s*\(\$errors->any\(\)\)<div class="alert">\{\{\s*\$errors->first\(\)\s*\}\}<\/div>@endif/,
    () => (errorMessage ? `<div class="alert">${escapeHtml(errorMessage)}</div>` : ""),
  );
  html = html
    .replace(/@csrf/g, () => csrfHiddenInput(csrfToken))
    .replace(/\{\{\s*csrf_token\(\)\s*\}\}/g, () => escapeHtml(csrfToken))
    .replace(/\{\{\s*url\('([^']+)'\)\s*\}\}/g, (_, p) => escapeHtml(url(p)))
    .replace(/\{\{\s*old\('([^']+)'\)\s*\}\}/g, (_, field) => escapeHtml(old[field] ?? ""));
  return html;
}

export function renderAdminLogin({ origin, csrfToken, errorMessage = "", old = {} }) {
  const url = makeUrlBuilder(origin);
  let html = tplAdminLogin;
  html = html.replace(
    /@if\s*\(\$errors->any\(\)\)<div class="alert">\{\{\s*\$errors->first\(\)\s*\}\}<\/div>@endif/,
    () => (errorMessage ? `<div class="alert">${escapeHtml(errorMessage)}</div>` : ""),
  );
  html = html
    .replace(/@csrf/g, () => csrfHiddenInput(csrfToken))
    .replace(/\{\{\s*csrf_token\(\)\s*\}\}/g, () => escapeHtml(csrfToken))
    .replace(/\{\{\s*url\('([^']+)'\)\s*\}\}/g, (_, p) => escapeHtml(url(p)))
    .replace(/\{\{\s*old\('([^']+)'\)\s*\}\}/g, (_, field) => escapeHtml(old[field] ?? ""));
  return html;
}

export function renderAdminDashboard({ origin, csrfToken, admin }) {
  const url = makeUrlBuilder(origin);
  const name = String(admin?.name ?? "Admin");
  const initial = Array.from(name)[0]?.toUpperCase() ?? "A";
  const role = String(admin?.role ?? "owner");

  return tplAdminDashboard
    .replace(/@csrf/g, () => csrfHiddenInput(csrfToken))
    .replace(/\{\{\s*csrf_token\(\)\s*\}\}/g, () => escapeHtml(csrfToken))
    .replace(/\{\{\s*\$admin->role\s*\}\}/g, () => escapeHtml(role))
    .replace(
      /\{\{\s*mb_strtoupper\(mb_substr\(\$admin->name,\s*0,\s*1\)\)\s*\}\}/g,
      () => escapeHtml(initial),
    )
    .replace(/\{\{\s*\$admin->name\s*\}\}/g, () => escapeHtml(name))
    .replace(/\{\{\s*url\('([^']+)'\)\s*\}\}/g, (_, p) => escapeHtml(url(p)));
}

export function renderTeamProfile({ origin, csrfToken, member, token }) {
  const url = makeUrlBuilder(origin);
  const m = member && typeof member === "object" ? member : {};
  const skillsText = Array.isArray(m.skills) ? m.skills.join("\n") : "";
  const respText = Array.isArray(m.responsibilities) ? m.responsibilities.join("\n") : "";
  const apiUrl = url(`/api/public/team-profile/${token}`);

  return tplPageTeamProfile
    .replace(/@csrf/g, () => csrfHiddenInput(csrfToken))
    .replace(
      /@js\(url\('\/api\/public\/team-profile\/'\.\$token\)\)/g,
      () => JSON.stringify(apiUrl),
    )
    .replace(/\{\{\s*csrf_token\(\)\s*\}\}/g, () => escapeHtml(csrfToken))
    .replace(/\{\{\s*asset\('([^']+)'\)\s*\}\}/g, (_, p) => escapeHtml(url(p)))
    .replace(/\{\{\s*url\('([^']+)'\)\s*\}\}/g, (_, p) => escapeHtml(url(p)))
    .replace(
      /\{\{\s*\$member\['designation'\]\s*\?\?\s*\$member\['role'\]\s*\?\?\s*''\s*\}\}/g,
      () => escapeHtml(m.designation ?? m.role ?? ""),
    )
    .replace(
      /\{\{\s*implode\("\\n",\s*\$member\['skills'\]\s*\?\?\s*\[\]\)\s*\}\}/g,
      () => escapeHtml(skillsText),
    )
    .replace(
      /\{\{\s*implode\("\\n",\s*\$member\['responsibilities'\]\s*\?\?\s*\[\]\)\s*\}\}/g,
      () => escapeHtml(respText),
    )
    .replace(
      /\{\{\s*\$member\['([^']+)'\]\s*\?\?\s*''\s*\}\}/g,
      (_, key) => escapeHtml(m[key] ?? ""),
    );
}

export function renderError404({ origin }) {
  const url = makeUrlBuilder(origin);
  return tplError404.replace(
    /\{\{\s*url\('([^']+)'\)\s*\}\}/g,
    (_, p) => escapeHtml(url(p)),
  );
}
