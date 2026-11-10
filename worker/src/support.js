// Shared domain helpers matching Laravel's App\Support\{MediaFiles,SiteData,VideoEmbed}
// and App\Http\Controllers\SitePageController.

import rawSiteSnapshot from "../../database/seeders/data/site-snapshot.json";

export const SECTIONS = [
  "settings",
  "services",
  "packages",
  "team",
  "portfolio",
  "reviews",
  "bookings",
];

export const WORK_SECTIONS = ["items", "recent", "demos", "shorts", "videos"];

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "application/ogg": "ogg",
};

const PUBLIC_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "ogg"];

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function nl2brEscaped(value) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br />\n");
}

/**
 * Safe JSON serializer for embedding inside <script> blocks, matching PHP's
 * JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES.
 */
export function jsonForScript(value) {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/'/g, "\\u0027")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function isPhpEmpty(value) {
  if (value === null || value === undefined || value === false || value === "" || value === 0 || value === "0") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

export function isActiveFlag(value, defaultVal = true) {
  const v = value === undefined ? defaultVal : value;
  return v !== false && v !== 0 && v !== "0";
}

export function extensionForMime(mime) {
  return MIME_EXTENSIONS[String(mime || "").trim().toLowerCase()] ?? null;
}

export function containsInlineMedia(value) {
  if (Array.isArray(value)) {
    return value.some((child) => containsInlineMedia(child));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((child) => containsInlineMedia(child));
  }
  if (typeof value !== "string") {
    return false;
  }
  const text = value.trim();
  return (
    /data:(?:image|video)\//i.test(text) ||
    /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base\d{2},/i.test(text) ||
    /^[A-Za-z0-9+/]{1000,}={0,2}$/.test(text)
  );
}

export function isHttpUrl(value) {
  const str = String(value || "").trim();
  if (!str || str.length > 2048) return false;
  try {
    const parsed = new URL(str);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function isSafeMediaUrl(value) {
  const text = String(value ?? "").trim();
  if (text === "") return true;
  if (containsInlineMedia(text) || /[\x00-\x1F\x7F]/.test(text) || text.includes("\\")) {
    return false;
  }
  if (text.startsWith("/")) {
    return !text.startsWith("//");
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(text)) {
    return isHttpUrl(text);
  }
  return true;
}

export function isSafeLink(value) {
  const text = String(value ?? "").trim();
  if (text.startsWith("/") || text.startsWith("#")) {
    return !text.startsWith("//");
  }
  const colonIdx = text.indexOf(":");
  if (colonIdx > 0) {
    const scheme = text.slice(0, colonIdx).toLowerCase();
    if (scheme === "mailto" || scheme === "tel") {
      return true;
    }
  }
  return isHttpUrl(text);
}

const SAFE_FILENAME_RE = new RegExp(
  `^[a-f0-9-]{36}\\.(?:${PUBLIC_EXTENSIONS.join("|")})$`,
  "i",
);

export function isSafeFilename(filename) {
  return SAFE_FILENAME_RE.test(String(filename || ""));
}

export function resolveVideoEmbed(input) {
  const url = String(input ?? "").trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { provider: "unsupported", type: "link", url: "", embed_url: "" };
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
    return { provider: "unsupported", type: "link", url: "", embed_url: "" };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname || "";

  if (
    ["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host) ||
    host === "youtu.be"
  ) {
    let id = "";
    if (host === "youtu.be") {
      id = path.replace(/^\/+|\/+$/g, "");
    } else {
      const vParam = parsed.searchParams.get("v");
      if (vParam) {
        id = vParam;
      } else {
        const m = path.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
        id = m ? m[1] : "";
      }
    }
    if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
      return {
        provider: "youtube",
        type: "iframe",
        url,
        embed_url: `https://www.youtube-nocookie.com/embed/${id}`,
        thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  if (host === "drive.google.com" || host === "docs.google.com") {
    const qId = parsed.searchParams.get("id");
    const m = path.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
    const id = qId || (m ? m[1] : "");
    if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) {
      return {
        provider: "google-drive",
        type: "iframe",
        url,
        embed_url: `https://drive.google.com/file/d/${id}/preview`,
      };
    }
  }

  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch") {
    return {
      provider: "facebook",
      type: "iframe",
      url,
      embed_url: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=1280`,
    };
  }

  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    const m = path.match(/\/(?:video\/)?(\d+)/);
    if (m) {
      return {
        provider: "vimeo",
        type: "iframe",
        url,
        embed_url: `https://player.vimeo.com/video/${m[1]}`,
      };
    }
  }

  if (host === "dailymotion.com" || host === "dai.ly") {
    const m = path.match(/\/video\/([A-Za-z0-9]+)/);
    const id = host === "dai.ly" ? path.replace(/^\/+|\/+$/g, "") : m ? m[1] : "";
    if (id && /^[A-Za-z0-9]+$/.test(id)) {
      return {
        provider: "dailymotion",
        type: "iframe",
        url,
        embed_url: `https://www.dailymotion.com/embed/video/${id}`,
      };
    }
  }

  if (host === "streamable.com") {
    const m = path.match(/^\/([A-Za-z0-9]+)/);
    if (m) {
      return {
        provider: "streamable",
        type: "iframe",
        url,
        embed_url: `https://streamable.com/e/${m[1]}`,
      };
    }
  }

  const extMatch = path.match(/\.([A-Za-z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "";
  if (["mp4", "webm", "ogv", "ogg", "m4v", "mov", "m3u8"].includes(ext)) {
    return {
      provider: host === "catbox.moe" || host.endsWith(".catbox.moe") ? "catbox" : host,
      type: "video",
      url,
      embed_url: url,
      stream_type: ext === "m3u8" ? "hls" : "file",
    };
  }

  return { provider: host, type: "link", url, embed_url: "", thumbnail_url: "" };
}

export function decorateVideoItem(item, urlKey = "url") {
  if (!item || typeof item !== "object") return item;
  const copy = { ...item };
  if ((copy.kind ?? "") === "image" || !copy[urlKey]) {
    return copy;
  }
  const embed = resolveVideoEmbed(String(copy[urlKey]));
  copy.embed_provider = embed.provider;
  copy.embed_type = embed.type;
  copy.embed_url = embed.embed_url;
  if (!copy.thumbnail_url && embed.thumbnail_url) {
    copy.thumbnail_url = embed.thumbnail_url;
  }
  return copy;
}

export function decorateServices(services) {
  return (Array.isArray(services) ? services : []).map((svc) => {
    if (!svc || typeof svc !== "object") return svc;
    const service = { ...svc };
    if (service.main_video_url) {
      const embed = resolveVideoEmbed(String(service.main_video_url));
      service.main_video_embed_type = embed.type;
      service.main_video_embed_url = embed.embed_url;
      service.main_video_provider = embed.provider;
    }
    if (Array.isArray(service.demo_videos)) {
      service.demo_videos = service.demo_videos.map((v) => decorateVideoItem(v, "video_url"));
    }
    return service;
  });
}

export function sortRecords(rows, ...fields) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row, index) => {
      let order = index;
      for (const field of fields) {
        if (row && row[field] !== undefined && row[field] !== null && row[field] !== "" && Number.isFinite(Number(row[field]))) {
          order = Number(row[field]);
          break;
        }
      }
      return { index, order, row };
    })
    .sort((a, b) => (a.order - b.order) || (a.index - b.index))
    .map((entry) => entry.row);
}

let cachedDefaults = null;

export function getRawSnapshot() {
  return structuredClone(rawSiteSnapshot);
}

export function getSiteDefaults() {
  if (cachedDefaults) {
    return structuredClone(cachedDefaults);
  }
  const snapshot = getRawSnapshot();
  const content = snapshot["/api/public/content"] ?? {};
  const contact = snapshot["/api/public/contact"] ?? {};
  const team = snapshot["/api/public/team"] ?? { heading: "Our Team", intro: "", members: [] };
  const services = snapshot["/api/public/services"]?.services ?? [];
  const packageTemplates = snapshot["/api/public/packages"]?.packages ?? [];

  const templateByQuality = {};
  for (const tpl of packageTemplates) {
    if (tpl && typeof tpl === "object") {
      templateByQuality[tpl.quality_level ?? ""] = tpl;
    }
  }

  const tiers = [
    ["premium", 3.98, "Premium Quality", "1–2 business days", "Unlimited revisions", "Best Value", false],
    ["high", 1.98, "High Quality", "2–3 business days", "3 revisions", "Most Popular", true],
    ["normal", 0.87, "Normal Quality", "3–4 business days", "1 revision", "", false],
  ];

  const packages = [];
  for (const service of services) {
    const base = Number(service.price_from ?? 40) || 40;
    const rawFeatures = Array.isArray(service.features)
      ? service.features
      : String(service.bullet_points ?? "")
          .split(/\r?\n/)
          .filter(Boolean);
    const features = rawFeatures.slice(0, 4);
    for (const [quality, multiplier, name, delivery, revisions, badge, highlight] of tiers) {
      const tpl = templateByQuality[quality] ?? {};
      packages.push({
        id: `${service.id ?? packages.length}:${quality}`,
        serviceId: Number.parseInt(String(service.id ?? 0), 10) || 0,
        quality,
        name: tpl.name ?? name,
        price: Math.max(1, Math.round(base * multiplier)),
        currency: tpl.currency ?? "USD",
        description: tpl.description ?? "",
        features: Array.isArray(tpl.features) ? [...tpl.features] : [...features],
        delivery: tpl.delivery_time ?? delivery,
        revisions: tpl.revision_limit ?? revisions,
        badge: tpl.badge ?? badge,
        highlight: Boolean(tpl.is_highlight ?? highlight),
        seedName: name,
      });
    }
  }

  const work = {
    ...(snapshot["/api/public/work"] ?? {
      items: [],
      demos: [],
      shorts: [],
      recent: [],
      categories: [],
      channels: [],
    }),
    videos: snapshot["/api/public/videos"]?.videos ?? [],
  };

  const reviews = (snapshot["/api/public/reviews"]?.items ?? []).map((review) => ({
    ...review,
    status: "approved",
  }));

  cachedDefaults = {
    settings: {
      content,
      contact,
      page_content: {},
      review_stats: snapshot["/api/public/reviews"]?.stats ?? {},
    },
    services,
    packages,
    team,
    portfolio: work,
    reviews,
    bookings: [],
  };

  return structuredClone(cachedDefaults);
}

export function filterPublishedPackages(packagesList) {
  const filtered = (Array.isArray(packagesList) ? packagesList : []).filter((pkg) => {
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return false;
    const enabled = pkg.is_enabled ?? pkg.active ?? true;
    if (!isActiveFlag(enabled, true)) return false;
    const status = String(pkg.status ?? "published").toLowerCase();
    return !["draft", "unpublished", "disabled"].includes(status);
  });

  const mapped = filtered.map((pkg) => {
    const copy = { ...pkg };
    const rawCurrency = String(copy.currency ?? "USD").toUpperCase();
    const prices = copy.prices;
    if (prices && typeof prices === "object" && !Array.isArray(prices) && prices[rawCurrency] !== undefined && prices[rawCurrency] !== "" && Number.isFinite(Number(prices[rawCurrency]))) {
      copy.price = Number(prices[rawCurrency]);
    }
    copy.currency = ["USD", "USDT", "BDT"].includes(rawCurrency) ? rawCurrency : "USD";
    return copy;
  });

  return sortRecords(mapped, "display_order");
}

export function filterPublishedPortfolio(portfolio) {
  const result = { ...(portfolio || {}) };
  for (const key of WORK_SECTIONS) {
    if (!Array.isArray(result[key])) continue;
    const visible = result[key].filter((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const enabled = item.is_enabled ?? item.is_published ?? true;
      if (!isActiveFlag(enabled, true)) return false;
      const status = String(item.status ?? "published").toLowerCase();
      return !["draft", "unpublished", "disabled", "rejected"].includes(status);
    });
    result[key] = sortRecords(visible, "display_order", "sort_order");
  }
  return result;
}

export function defaultHomeSections() {
  return [
    { key: "hero", label: "Hero", selector: "#home", enabled: true, order: 1 },
    { key: "services", label: "Services", selector: "#services", enabled: true, order: 2 },
    { key: "work", label: "Featured work", selector: "#portfolio", enabled: true, order: 3 },
    { key: "process", label: "Our process", selector: "#process", enabled: true, order: 4 },
    { key: "reviews", label: "Reviews", selector: "#reviews", enabled: true, order: 5 },
    { key: "team", label: "Team", selector: "#team", enabled: true, order: 6 },
    { key: "about", label: "About", selector: "#about", enabled: true, order: 7 },
    { key: "contact", label: "Contact", selector: "#contact", enabled: true, order: 8 },
  ];
}

export function buildBridgeScript(
  bootstrapJson,
  page,
  overridesJson,
  baseJson,
  homeSectionsJson,
  homeMediaJson,
  siteSettingsJson,
) {
  const pageJson = jsonForScript(page);
  return (
    '(function(){"use strict";var base=' +
    baseJson +
    ';if(base.slice(-1)!=="/")base+="/";var seed=' +
    bootstrapJson +
    ";var page=" +
    pageJson +
    ";var overrides=" +
    overridesJson +
    ";var homeSections=" +
    homeSectionsJson +
    ";var homeMedia=" +
    homeMediaJson +
    ";var siteSettings=" +
    siteSettingsJson +
    ';var meta=document.querySelector("meta[name=csrf-token]");var token=meta?meta.content:"";var nativeFetch=window.fetch.bind(window);window.fetch=function(input,options){var raw=typeof input==="string"?input:(input&&input.url)||"";if(raw.charAt(0)!=="/"||raw.indexOf("//")===0)return nativeFetch(input,options);var target=new URL(raw.slice(1),base).toString();return nativeFetch(typeof input==="string"?target:new Request(target,input),options);};try{Object.keys(seed).forEach(function(k){localStorage.setItem(k,JSON.stringify(seed[k]));});}catch(e){}var set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){set.call(this,k,v);if(k==="mm_bookings_v1"){try{fetch(base+"api/public/storage",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","X-CSRF-TOKEN":token},body:JSON.stringify({key:k,value:JSON.parse(v)})}).catch(function(){});}catch(e){}}};function applyOverrides(){Object.keys(overrides||{}).forEach(function(selector){var data=overrides[selector];var el;try{el=document.querySelector(selector);}catch(e){return;}if(!el)return;if(data.text!==undefined&&(data.replace===true||el.children.length===0)&&el.textContent!==data.text)el.textContent=data.text;if(data.label!==undefined){var labelNode=[...el.childNodes].find(function(node){return node.nodeType===3;});if(labelNode)labelNode.nodeValue=" "+data.label+" ";else el.insertBefore(document.createTextNode(data.label),el.firstChild);}if(el.tagName==="IMG"){if(data.src!==undefined)el.setAttribute("src",data.src);if(data.alt!==undefined)el.setAttribute("alt",data.alt);}if(el.tagName==="A"&&data.href!==undefined)el.setAttribute("href",data.href);if(data.title!==undefined)el.setAttribute("title",data.title);});}function applyHome(){if(page!=="home")return;var roots={hero:"#home",services:"#services",work:"#portfolio",process:"#process",reviews:"#reviews",team:"#team",about:"#about",contact:"#contact"};var entries=(Array.isArray(homeSections)?homeSections:[]).slice().sort(function(a,b){return Number(a.order||0)-Number(b.order||0);});var nodes=[];entries.forEach(function(item){var node=document.querySelector(roots[item.key]||item.selector);if(!node)return;node.hidden=item.enabled===false||item.enabled===0||item.enabled==="0";node.style.display=node.hidden?"none":"";nodes.push(node);});if(nodes.length>1){var ordered=entries.filter(function(item){return roots[item.key]||item.selector;}).map(function(item){return document.querySelector(roots[item.key]||item.selector);}).filter(Boolean);var current=nodes.slice().sort(function(a,b){return a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1;});if(ordered.some(function(node,index){return current[index]!==node;})){var parent=ordered[0].parentNode;var anchor=ordered[0].nextSibling;while(anchor&&ordered.indexOf(anchor)>=0)anchor=anchor.nextSibling;var fragment=document.createDocumentFragment();ordered.forEach(function(node){fragment.appendChild(node);});if(anchor&&anchor.parentNode===parent)parent.insertBefore(fragment,anchor);else parent.appendChild(fragment);}}var hero=document.querySelector("#home");if(hero&&homeMedia){if(homeMedia.image){hero.style.backgroundImage="linear-gradient(120deg,rgba(5,24,56,.78),rgba(5,24,56,.24)),url(\\""+String(homeMedia.image).replace(/["\\\\]/g,"")+"\\")";hero.style.backgroundSize="cover";hero.style.backgroundPosition="center";}var video=String(homeMedia.video||"");if(video&&/\\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(video)){var player=hero.querySelector("video[data-home-background]");if(!player){player=document.createElement("video");player.dataset.homeBackground="1";player.autoplay=true;player.muted=true;player.loop=true;player.playsInline=true;player.setAttribute("aria-hidden","true");player.style.cssText="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none";hero.insertBefore(player,hero.firstChild);}if(player.src!==video)player.src=video;}}}function applyGlobal(){if(siteSettings.seo&&siteSettings.seo.title)document.title=siteSettings.seo.title;var description=siteSettings.seo&&siteSettings.seo.description;if(description){var tag=document.querySelector("meta[name=description]");if(!tag){tag=document.createElement("meta");tag.name="description";document.head.appendChild(tag);}tag.content=description;}if(siteSettings.favicon_url){var icon=document.querySelector("link[rel~=icon]")||document.createElement("link");icon.rel="icon";icon.href=siteSettings.favicon_url;document.head.appendChild(icon);}if(siteSettings.logo_url){document.querySelectorAll("#header img,header img,.site-logo img,.brand img,a[href=\\"/\\"] img,img[alt*=\\"Mexa\\"]").forEach(function(img){img.src=siteSettings.logo_url;});}var footer=siteSettings.footer||{};if(footer.copyright){document.querySelectorAll("footer p").forEach(function(item){if(/©|copyright/i.test(item.textContent))item.textContent=footer.copyright;});}var social=siteSettings.social||{};var socialIcons={facebook:"facebook",instagram:"instagram",youtube:"youtube",linkedin:"linkedin",telegram:"telegram",whatsapp:"whatsapp"};Object.keys(socialIcons).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(social,key))return;var icon=socialIcons[key];var link=document.querySelector("a[data-social=\\""+key+"\\"]")||Array.from(document.querySelectorAll("a")).find(function(item){return item.querySelector("[class*=\\""+icon+"\\"]")||String(item.className).includes(icon);});if(!link)return;if(social[key]){link.href=social[key];link.hidden=false;}else link.hidden=true;});}function apply(){applyOverrides();applyHome();applyGlobal();}apply();new MutationObserver(function(){applyOverrides();applyGlobal();}).observe(document.body,{subtree:true,childList:true});if(new URLSearchParams(location.search).get("cms_preview")==="1"){var style=document.createElement("style");style.textContent="[data-mexa-hover]{outline:2px solid #3184ff!important;outline-offset:3px!important;cursor:crosshair!important}";document.head.appendChild(style);function selector(el){if(el.id)return "#"+CSS.escape(el.id);var parts=[];while(el&&el.nodeType===1&&el!==document.body){var part=el.tagName.toLowerCase();if(el.classList.length)part+="."+[...el.classList].slice(0,3).map(CSS.escape).join(".");var siblings=el.parentElement?[...el.parentElement.children].filter(function(n){return n.tagName===el.tagName;}):[];if(siblings.length>1)part+=":nth-of-type("+(siblings.indexOf(el)+1)+")";parts.unshift(part);el=el.parentElement;if(el&&el.id){parts.unshift("#"+CSS.escape(el.id));break;}}return parts.join(" > ");}document.addEventListener("mouseover",function(e){var el=e.target.closest("body *");if(!el||/^(SCRIPT|STYLE|SVG|PATH|HTML)$/.test(el.tagName))return;document.querySelectorAll("[data-mexa-hover]").forEach(function(n){n.removeAttribute("data-mexa-hover");});el.setAttribute("data-mexa-hover","1");},true);document.addEventListener("click",function(e){var el=e.target.closest("body *");if(!el||/^(SCRIPT|STYLE|SVG|PATH|HTML)$/.test(el.tagName))return;e.preventDefault();e.stopImmediatePropagation();var tag=el.tagName;parent.postMessage({type:"mexa-cms-select",page:page,selector:selector(el),tag:tag,text:el.children.length===0?el.textContent.trim():"",href:tag==="A"?el.getAttribute("href"):"",src:tag==="IMG"?el.getAttribute("src"):"",alt:tag==="IMG"?el.getAttribute("alt"):"",title:el.getAttribute("title")||""},location.origin);},true);}})();'
  );
}

export function buildPageLayoutScript(overridesJson) {
  return (
    '(function(){"use strict";var overrides=' +
    overridesJson +
    '||{};function findData(el){var found=null;Object.keys(overrides).some(function(selector){try{if(document.querySelector(selector)===el){found=overrides[selector];return true;}}catch(e){}return false;});return found;}function apply(){var parents=new Set();Object.keys(overrides).forEach(function(selector){var data=overrides[selector],el;try{el=document.querySelector(selector);}catch(e){return;}if(!el)return;if(data.enabled!==undefined){el.hidden=data.enabled===false||data.enabled===0||data.enabled==="0";el.style.display=el.hidden?"none":"";}if(data.order!==undefined&&el.tagName==="SECTION"&&el.parentElement)parents.add(el.parentElement);});parents.forEach(function(parent){var current=Array.from(parent.children).filter(function(el){return el.tagName==="SECTION";});if(current.length<2)return;var ordered=current.map(function(el,index){var data=findData(el),hasOrder=data&&data.order!==undefined&&Number.isFinite(Number(data.order));return {el:el,index:index,order:hasOrder?Number(data.order):index+1,explicit:hasOrder};}).sort(function(a,b){return a.order-b.order||Number(b.explicit)-Number(a.explicit)||a.index-b.index;}).map(function(item){return item.el;});if(ordered.every(function(el,index){return current[index]===el;}))return;var markers=current.map(function(el){var marker=document.createComment("page-layout");parent.insertBefore(marker,el);return marker;});ordered.forEach(function(el,index){parent.insertBefore(el,markers[index]);});markers.forEach(function(marker){marker.remove();});});}apply();new MutationObserver(apply).observe(document.body,{subtree:true,childList:true});})();'
  );
}

// --- WebCrypto password hashing & SHA-256 helpers ----------------------------

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export function randomToken(length = 48) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    256,
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 100_000) {
    return false;
  }
  const salt = hexToBytes(parts[2]);
  const expected = hexToBytes(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    expected.length * 8,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}
